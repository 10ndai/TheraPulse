import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UserRole, UserStatus } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AuthService } from '../../../src/modules/auth/auth.service';
import { USER_REPOSITORY } from '../../../src/modules/users/users.repository.interface';
import { REFRESH_TOKEN_REPOSITORY } from '../../../src/modules/auth/refresh-token.repository.interface';
import { BACKUP_CODE_REPOSITORY } from '../../../src/modules/auth/backup-code.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../../../src/modules/audit-logs/audit-log.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';
import { LoginRateLimiter } from '../../../src/modules/auth/login-rate-limiter';
import { TotpService } from '../../../src/modules/auth/totp.service';

vi.mock('bcrypt', () => ({
  hash: vi.fn(),
  compare: vi.fn(),
}));

// Stable random bytes for deterministic token generation
vi.mock('crypto', () => ({
  randomBytes: vi.fn().mockReturnValue(Buffer.from('a'.repeat(32))),
}));

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  passwordHash: '$2b$12$validhash',
  role: UserRole.CLIENT,
  status: UserStatus.ACTIVE,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockTherapistPending = {
  ...mockUser,
  id: '00000000-0000-0000-0000-000000000002',
  role: UserRole.THERAPIST,
  status: UserStatus.PENDING,
};

const mockRefreshRecord = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  userId: mockUser.id,
  tokenHash: '$2b$12$refreshhash',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

describe('AuthService — login() and refreshTokens()', () => {
  let service: AuthService;
  let mockUserRepo: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let mockRefreshTokenRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
  };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };
  let mockJwtService: { sign: ReturnType<typeof vi.fn> };
  let mockRateLimiter: {
    check: ReturnType<typeof vi.fn>;
    recordFailure: ReturnType<typeof vi.fn>;
    reset: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
    };
    mockRefreshTokenRepo = {
      create: vi.fn().mockResolvedValue(mockRefreshRecord),
      findById: vi.fn(),
      revoke: vi.fn().mockResolvedValue({ ...mockRefreshRecord, revokedAt: new Date() }),
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };
    mockJwtService = { sign: vi.fn().mockReturnValue('mock.access.token') };
    mockRateLimiter = {
      check: vi.fn(),
      recordFailure: vi.fn(),
      reset: vi.fn(),
    };

    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        AuditLogService,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: REFRESH_TOKEN_REPOSITORY, useValue: mockRefreshTokenRepo },
        {
          provide: BACKUP_CODE_REPOSITORY,
          useValue: {
            createMany: vi.fn(),
            findUnusedByUser: vi.fn(),
            markUsed: vi.fn(),
            deleteAllForUser: vi.fn(),
          },
        },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: LoginRateLimiter, useValue: mockRateLimiter },
        {
          provide: TotpService,
          useValue: { generateSecret: vi.fn(), verifyToken: vi.fn(), generateBackupCodes: vi.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue(12) },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── login() ───────────────────────────────────────────────────────────────

  describe('login()', () => {
    it('returns access token, refresh token, and expiresIn on success', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await service.login(
        { email: 'user@example.com', password: 'P@ssw0rd!secure1' },
        mockMeta,
      );

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toContain(mockRefreshRecord.id);
      expect(result.expiresIn).toBe(900);
    });

    it('returns safe user data (no passwordHash, no totpSecret) on success', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await service.login(
        { email: 'user@example.com', password: 'P@ssw0rd!secure1' },
        mockMeta,
      );

      expect(result.user).not.toHaveProperty('passwordHash');
      expect(result.user).not.toHaveProperty('totpSecret');
      expect(result.user).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });
    });

    it('signs access token with sub, email, and role payload', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta);

      expect(mockJwtService.sign).toHaveBeenCalledWith(
        { sub: mockUser.id, email: mockUser.email, role: mockUser.role },
        expect.objectContaining({ expiresIn: '15m' }),
      );
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        service.login({ email: 'nobody@example.com', password: 'P@ssw0rd!secure1' }, mockMeta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when password does not match', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'user@example.com', password: 'WrongPassword!1' }, mockMeta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('records a rate-limit failure when password is wrong', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'user@example.com', password: 'WrongPassword!1' }, mockMeta),
      ).rejects.toThrow();

      expect(mockRateLimiter.recordFailure).toHaveBeenCalledWith('user@example.com');
    });

    it('resets the rate limit counter on successful login', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta);

      expect(mockRateLimiter.reset).toHaveBeenCalledWith('user@example.com');
    });

    it('throws TooManyRequestsException when rate limiter check fires', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      mockRateLimiter.check.mockImplementation(() => {
        throw new ThrottlerException();
      });

      await expect(
        service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta),
      ).rejects.toThrow(ThrottlerException);
    });

    it('throws UnauthorizedException for a PENDING therapist (after password check)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockTherapistPending);

      await expect(
        service.login({ email: 'therapist@example.com', password: 'P@ssw0rd!secure1' }, mockMeta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a SUSPENDED user (after password check)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ ...mockUser, status: UserStatus.SUSPENDED });

      await expect(
        service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException for a DELETED user (after password check)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue({ ...mockUser, status: UserStatus.DELETED });

      await expect(
        service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('writes a success audit log on login', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.login',
          actorId: mockUser.id,
          resourceType: 'user',
          resourceId: mockUser.id,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent/1.0',
        }),
      );
    });

    it('writes a failure audit log when password is wrong', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(
        service.login({ email: 'user@example.com', password: 'WrongPassword!1' }, mockMeta),
      ).rejects.toThrow();

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.login.failed',
          actorId: mockUser.id,
          ipAddress: '127.0.0.1',
        }),
      );
    });

    it('stores a bcrypt hash of the refresh token (not plaintext)', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await service.login({ email: 'user@example.com', password: 'P@ssw0rd!secure1' }, mockMeta);

      expect(mockRefreshTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ tokenHash: '$2b$12$newhash' }),
      );
      // Ensure the raw token hex is NOT stored
      const call = mockRefreshTokenRepo.create.mock.calls[0][0] as { tokenHash: string };
      expect(call.tokenHash).not.toMatch(/^[0-9a-f]{64}$/);
    });
  });

  // ── refreshTokens() ───────────────────────────────────────────────────────

  describe('refreshTokens()', () => {
    const rawToken = 'a'.repeat(64); // matches mocked randomBytes
    const validRefreshToken = `${mockRefreshRecord.id}:${rawToken}`;

    beforeEach(() => {
      mockRefreshTokenRepo.findById.mockResolvedValue(mockRefreshRecord);
      mockUserRepo.findById.mockResolvedValue(mockUser);
    });

    it('returns new access token, refresh token, and expiresIn', async () => {
      const result = await service.refreshTokens(validRefreshToken, mockMeta);

      expect(result.accessToken).toBe('mock.access.token');
      expect(result.refreshToken).toContain(mockRefreshRecord.id);
      expect(result.expiresIn).toBe(900);
    });

    it('revokes the old refresh token', async () => {
      await service.refreshTokens(validRefreshToken, mockMeta);

      expect(mockRefreshTokenRepo.revoke).toHaveBeenCalledWith(mockRefreshRecord.id);
    });

    it('creates a new refresh token record in the DB', async () => {
      await service.refreshTokens(validRefreshToken, mockMeta);

      expect(mockRefreshTokenRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockUser.id,
          tokenHash: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      );
    });

    it('throws UnauthorizedException when token format is invalid', async () => {
      await expect(service.refreshTokens('notvalidformat', mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token ID is not found in DB', async () => {
      mockRefreshTokenRepo.findById.mockResolvedValue(null);

      await expect(service.refreshTokens(validRefreshToken, mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException and revokes all user tokens when token is already revoked', async () => {
      mockRefreshTokenRepo.findById.mockResolvedValue({
        ...mockRefreshRecord,
        revokedAt: new Date('2026-01-05'),
      });

      await expect(service.refreshTokens(validRefreshToken, mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(mockRefreshTokenRepo.revokeAllForUser).toHaveBeenCalledWith(mockRefreshRecord.userId);
    });

    it('throws UnauthorizedException when token is expired', async () => {
      mockRefreshTokenRepo.findById.mockResolvedValue({
        ...mockRefreshRecord,
        expiresAt: new Date('2025-01-01'), // in the past
      });

      await expect(service.refreshTokens(validRefreshToken, mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when hash comparison fails', async () => {
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.refreshTokens(validRefreshToken, mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when the associated user is not ACTIVE', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...mockUser,
        status: UserStatus.SUSPENDED,
      });

      await expect(service.refreshTokens(validRefreshToken, mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('writes an audit log on successful refresh', async () => {
      await service.refreshTokens(validRefreshToken, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.token.refresh',
          actorId: mockUser.id,
          resourceType: 'user',
        }),
      );
    });
  });
});
