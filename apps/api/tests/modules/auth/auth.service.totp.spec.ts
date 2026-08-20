import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
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

vi.mock('crypto', () => ({
  randomBytes: vi.fn().mockReturnValue(Buffer.from('a'.repeat(32))),
}));

const ACTIVE_THERAPIST = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  passwordHash: '$2b$12$validhash',
  role: UserRole.THERAPIST,
  status: UserStatus.ACTIVE,
  totpSecret: null as string | null,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const ACTIVE_THERAPIST_WITH_TOTP = {
  ...ACTIVE_THERAPIST,
  totpSecret: 'JBSWY3DPEHPK3PXP', // example base32 secret (decrypted)
  totpEnabled: true,
};

const _ACTIVE_CLIENT = {
  ...ACTIVE_THERAPIST,
  id: '00000000-0000-0000-0000-000000000002',
  email: 'client@example.com',
  role: UserRole.CLIENT,
};

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

const mockRefreshRecord = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  userId: ACTIVE_THERAPIST.id,
  tokenHash: '$2b$12$refreshhash',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  revokedAt: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const UNUSED_BACKUP_CODES = [
  {
    id: 'bb000001',
    userId: ACTIVE_THERAPIST.id,
    codeHash: '$2b$12$code1',
    usedAt: null,
    createdAt: new Date(),
  },
  {
    id: 'bb000002',
    userId: ACTIVE_THERAPIST.id,
    codeHash: '$2b$12$code2',
    usedAt: null,
    createdAt: new Date(),
  },
];

describe('AuthService — TOTP 2FA methods', () => {
  let service: AuthService;
  let mockUserRepo: {
    findByEmail: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockRefreshTokenRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    revoke: ReturnType<typeof vi.fn>;
    revokeAllForUser: ReturnType<typeof vi.fn>;
  };
  let mockBackupCodeRepo: {
    createMany: ReturnType<typeof vi.fn>;
    findUnusedByUser: ReturnType<typeof vi.fn>;
    markUsed: ReturnType<typeof vi.fn>;
    deleteAllForUser: ReturnType<typeof vi.fn>;
  };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };
  let mockJwtService: { sign: ReturnType<typeof vi.fn>; verify: ReturnType<typeof vi.fn> };
  let mockTotpService: {
    generateSecret: ReturnType<typeof vi.fn>;
    verifyToken: ReturnType<typeof vi.fn>;
    generateBackupCodes: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockUserRepo = {
      findByEmail: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    mockRefreshTokenRepo = {
      create: vi.fn().mockResolvedValue(mockRefreshRecord),
      findById: vi.fn(),
      revoke: vi.fn().mockResolvedValue({ ...mockRefreshRecord, revokedAt: new Date() }),
      revokeAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    mockBackupCodeRepo = {
      createMany: vi.fn().mockResolvedValue(undefined),
      findUnusedByUser: vi.fn().mockResolvedValue(UNUSED_BACKUP_CODES),
      markUsed: vi.fn().mockResolvedValue({ ...UNUSED_BACKUP_CODES[0], usedAt: new Date() }),
      deleteAllForUser: vi.fn().mockResolvedValue(undefined),
    };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };
    mockJwtService = {
      sign: vi.fn().mockReturnValue('mock.access.token'),
      verify: vi.fn(),
    };
    mockTotpService = {
      generateSecret: vi.fn().mockReturnValue({
        secret: 'JBSWY3DPEHPK3PXP',
        otpauthUri:
          'otpauth://totp/TheraPulse:therapist%40example.com?secret=JBSWY3DPEHPK3PXP&issuer=TheraPulse',
      }),
      verifyToken: vi.fn().mockReturnValue(true),
      generateBackupCodes: vi
        .fn()
        .mockReturnValue([
          'AAAAAAAA',
          'BBBBBBBB',
          'CCCCCCCC',
          'DDDDDDDD',
          'EEEEEEEE',
          'FFFFFFFF',
          'GGGGGGGG',
          'HHHHHHHH',
        ]),
    };

    vi.mocked(bcrypt.hash).mockResolvedValue('$2b$12$newhash' as never);
    vi.mocked(bcrypt.compare).mockResolvedValue(true as never);

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        AuditLogService,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: REFRESH_TOKEN_REPOSITORY, useValue: mockRefreshTokenRepo },
        { provide: BACKUP_CODE_REPOSITORY, useValue: mockBackupCodeRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
        { provide: JwtService, useValue: mockJwtService },
        { provide: TotpService, useValue: mockTotpService },
        {
          provide: LoginRateLimiter,
          useValue: { check: vi.fn(), recordFailure: vi.fn(), reset: vi.fn() },
        },
        { provide: ConfigService, useValue: { get: vi.fn().mockReturnValue(12) } },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ── setupTotp() ───────────────────────────────────────────────────────────

  describe('setupTotp()', () => {
    it('returns an otpauth URI and QR code data URL', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST);
      mockUserRepo.update.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });

      const result = await service.setupTotp(ACTIVE_THERAPIST.id);

      expect(result.otpauthUri).toContain('otpauth://totp');
      expect(result.qrCodeDataUrl).toMatch(/^data:image\/png;base64,/);
    });

    it('stores the TOTP secret on the user record', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST);
      mockUserRepo.update.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });

      await service.setupTotp(ACTIVE_THERAPIST.id);

      expect(mockUserRepo.update).toHaveBeenCalledWith(
        ACTIVE_THERAPIST.id,
        expect.objectContaining({ totpSecret: 'JBSWY3DPEHPK3PXP' }),
      );
    });

    it('throws BadRequestException when TOTP is already enabled', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);

      await expect(service.setupTotp(ACTIVE_THERAPIST.id)).rejects.toThrow(BadRequestException);
    });

    it('throws UnauthorizedException when user is not found', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.setupTotp('nonexistent')).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── enableTotp() ──────────────────────────────────────────────────────────

  describe('enableTotp()', () => {
    it('sets totpEnabled to true when the TOTP code is valid', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });
      mockUserRepo.update.mockResolvedValue({ ...ACTIVE_THERAPIST, totpEnabled: true });

      await service.enableTotp(ACTIVE_THERAPIST.id, '123456');

      expect(mockUserRepo.update).toHaveBeenCalledWith(
        ACTIVE_THERAPIST.id,
        expect.objectContaining({ totpEnabled: true }),
      );
    });

    it('returns 8 plaintext backup codes', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });
      mockUserRepo.update.mockResolvedValue({ ...ACTIVE_THERAPIST, totpEnabled: true });

      const result = await service.enableTotp(ACTIVE_THERAPIST.id, '123456');

      expect(result.backupCodes).toHaveLength(8);
    });

    it('stores bcrypt hashes of the backup codes (not plaintext)', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });
      mockUserRepo.update.mockResolvedValue({ ...ACTIVE_THERAPIST, totpEnabled: true });

      await service.enableTotp(ACTIVE_THERAPIST.id, '123456');

      expect(mockBackupCodeRepo.createMany).toHaveBeenCalledWith(
        ACTIVE_THERAPIST.id,
        expect.arrayContaining([expect.stringMatching(/^\$2b\$/)]),
      );
    });

    it('throws BadRequestException when TOTP code is invalid', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: 'JBSWY3DPEHPK3PXP',
      });
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(service.enableTotp(ACTIVE_THERAPIST.id, '000000')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when TOTP secret is not set up yet', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST); // totpSecret: null

      await expect(service.enableTotp(ACTIVE_THERAPIST.id, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws BadRequestException when TOTP is already enabled', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);

      await expect(service.enableTotp(ACTIVE_THERAPIST.id, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── disableTotp() ─────────────────────────────────────────────────────────

  describe('disableTotp()', () => {
    it('sets totpEnabled to false and clears totpSecret when code is valid', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);
      mockUserRepo.update.mockResolvedValue({
        ...ACTIVE_THERAPIST,
        totpSecret: null,
        totpEnabled: false,
      });

      await service.disableTotp(ACTIVE_THERAPIST.id, '123456');

      expect(mockUserRepo.update).toHaveBeenCalledWith(
        ACTIVE_THERAPIST.id,
        expect.objectContaining({ totpEnabled: false, totpSecret: null }),
      );
    });

    it('deletes all backup codes when TOTP is disabled', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);
      mockUserRepo.update.mockResolvedValue({ ...ACTIVE_THERAPIST });

      await service.disableTotp(ACTIVE_THERAPIST.id, '123456');

      expect(mockBackupCodeRepo.deleteAllForUser).toHaveBeenCalledWith(ACTIVE_THERAPIST.id);
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);
      mockTotpService.verifyToken.mockReturnValue(false);

      await expect(service.disableTotp(ACTIVE_THERAPIST.id, '000000')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws BadRequestException when TOTP is not enabled', async () => {
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST); // totpEnabled: false

      await expect(service.disableTotp(ACTIVE_THERAPIST.id, '123456')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── login() — TOTP integration ────────────────────────────────────────────

  describe('login() with TOTP-enabled therapist', () => {
    beforeEach(() => {
      mockUserRepo.findByEmail.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);
    });

    it('returns requiresTotpVerification=true instead of tokens for TOTP-enabled therapist', async () => {
      const result = await service.login(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1' },
        mockMeta,
      );

      expect(result.requiresTotpVerification).toBe(true);
      expect(result).not.toHaveProperty('accessToken');
    });

    it('includes a short-lived totpPendingToken in the response', async () => {
      const result = await service.login(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1' },
        mockMeta,
      );

      expect(result.totpPendingToken).toBeDefined();
      expect(mockJwtService.sign).toHaveBeenCalledWith(
        expect.objectContaining({ sub: ACTIVE_THERAPIST.id, purpose: 'totp_pending' }),
        expect.objectContaining({ expiresIn: '5m' }),
      );
    });

    it('does NOT write a login success audit log when TOTP is pending', async () => {
      await service.login(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1' },
        mockMeta,
      );

      const auditCalls = mockAuditRepo.create.mock.calls as { action: string }[][];
      const loginSuccessCall = auditCalls.find((call) => call[0]?.action === 'user.login');
      expect(loginSuccessCall).toBeUndefined();
    });
  });

  // ── completeTotpLogin() ───────────────────────────────────────────────────

  describe('completeTotpLogin()', () => {
    const totpPendingPayload = { sub: ACTIVE_THERAPIST.id, purpose: 'totp_pending' };

    beforeEach(() => {
      mockJwtService.verify.mockReturnValue(totpPendingPayload);
      mockUserRepo.findById.mockResolvedValue(ACTIVE_THERAPIST_WITH_TOTP);
    });

    it('issues full tokens when TOTP code is valid', async () => {
      const result = await service.completeTotpLogin('pending.token', '123456', mockMeta);

      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
      expect(result.expiresIn).toBe(900);
    });

    it('throws UnauthorizedException when pending token is invalid', async () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      await expect(service.completeTotpLogin('expired.token', '123456', mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when token purpose is not "totp_pending"', async () => {
      mockJwtService.verify.mockReturnValue({ sub: ACTIVE_THERAPIST.id, purpose: 'access' });

      await expect(service.completeTotpLogin('access.token', '123456', mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('throws UnauthorizedException when TOTP code is invalid', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);
      // Also mock compare to return false for backup code check
      vi.mocked(bcrypt.compare).mockResolvedValue(false as never);

      await expect(service.completeTotpLogin('pending.token', '000000', mockMeta)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('accepts a valid backup code in place of TOTP token', async () => {
      mockTotpService.verifyToken.mockReturnValue(false); // TOTP fails
      // Only first backup code matches
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never); // first code matches

      const result = await service.completeTotpLogin('pending.token', 'AAAAAAAA', mockMeta);

      expect(result.accessToken).toBeDefined();
    });

    it('marks the backup code as used when a backup code is consumed', async () => {
      mockTotpService.verifyToken.mockReturnValue(false);
      vi.mocked(bcrypt.compare).mockResolvedValueOnce(true as never);

      await service.completeTotpLogin('pending.token', 'AAAAAAAA', mockMeta);

      expect(mockBackupCodeRepo.markUsed).toHaveBeenCalledWith(UNUSED_BACKUP_CODES[0].id);
    });

    it('writes a login success audit log on successful TOTP completion', async () => {
      const result = await service.completeTotpLogin('pending.token', '123456', mockMeta);

      expect(result.accessToken).toBeDefined();
      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.login' }),
      );
    });
  });
});
