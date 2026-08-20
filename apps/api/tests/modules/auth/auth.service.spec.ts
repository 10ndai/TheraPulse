import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
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
}));

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  passwordHash: '$2b$12$hashedpassword',
  role: UserRole.THERAPIST,
  status: UserStatus.PENDING,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

describe('AuthService', () => {
  let service: AuthService;
  let mockUserRepo: { findByEmail: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockUserRepo = { findByEmail: vi.fn(), create: vi.fn() };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };

    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$hashedpassword' as never);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        AuditLogService,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: REFRESH_TOKEN_REPOSITORY, useValue: { create: vi.fn() } },
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
        { provide: JwtService, useValue: { sign: vi.fn() } },
        {
          provide: LoginRateLimiter,
          useValue: { check: vi.fn(), recordFailure: vi.fn(), reset: vi.fn() },
        },
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

  // ── register() ────────────────────────────────────────────────────────────

  describe('register()', () => {
    it('hashes the password with bcrypt using configured cost factor', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(bcrypt.hash).toHaveBeenCalledWith('P@ssw0rd!secure1', 12);
    });

    it('sets status PENDING for THERAPIST registrations', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({
        ...mockUser,
        role: UserRole.THERAPIST,
        status: UserStatus.PENDING,
      });

      await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.PENDING }),
      );
    });

    it('sets status ACTIVE for CLIENT registrations', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue({
        ...mockUser,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      });

      await service.register(
        { email: 'client@example.com', password: 'P@ssw0rd!secure1', role: 'CLIENT' },
        mockMeta,
      );

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ status: UserStatus.ACTIVE }),
      );
    });

    it('stores the bcrypt hash, NOT the plaintext password', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(mockUserRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ passwordHash: '$2b$12$hashedpassword' }),
      );
      expect(mockUserRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ password: expect.anything() }),
      );
    });

    it('throws ConflictException when email is already registered', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register(
          { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
          mockMeta,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('does NOT hash the password when email is already taken', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register(
          { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
          mockMeta,
        ),
      ).rejects.toThrow();

      expect(bcrypt.hash).not.toHaveBeenCalled();
    });

    it('writes an audit log entry after successful registration', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'user.register',
          resourceType: 'user',
          resourceId: mockUser.id,
          actorId: mockUser.id,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent/1.0',
        }),
      );
    });

    it('does NOT include passwordHash in the returned data', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      const result = await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(result).not.toHaveProperty('passwordHash');
    });

    it('does NOT include totpSecret in the returned data', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      const result = await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(result).not.toHaveProperty('totpSecret');
    });

    it('returns id, email, role, status, totpEnabled, createdAt', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.create.mockResolvedValue(mockUser);

      const result = await service.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        mockMeta,
      );

      expect(result).toMatchObject({
        id: mockUser.id,
        email: mockUser.email,
        role: UserRole.THERAPIST,
        status: UserStatus.PENDING,
        totpEnabled: false,
      });
    });

    it('does not write an audit log when registration fails with duplicate email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        service.register(
          { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
          mockMeta,
        ),
      ).rejects.toThrow();

      expect(mockAuditRepo.create).not.toHaveBeenCalled();
    });
  });
});
