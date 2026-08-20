import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthController } from '../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../src/modules/auth/auth.service';
import type { LoginResponseData } from '../../../src/modules/auth/auth.service';

const mockSetupResult = {
  otpauthUri: 'otpauth://totp/TheraPulse:user%40example.com?secret=ABC123&issuer=TheraPulse',
  qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgo=',
};

const mockEnableResult = {
  backupCodes: [
    'AAAAAAAA',
    'BBBBBBBB',
    'CCCCCCCC',
    'DDDDDDDD',
    'EEEEEEEE',
    'FFFFFFFF',
    'GGGGGGGG',
    'HHHHHHHH',
  ],
};

const _mockTotpPendingResult = {
  requiresTotpVerification: true as const,
  totpPendingToken: 'pending.jwt.token',
};

const mockLoginResult: LoginResponseData = {
  accessToken: 'access.token',
  refreshToken: 'refresh.token',
  expiresIn: 900,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'therapist@example.com',
    role: UserRole.THERAPIST,
    status: UserStatus.ACTIVE,
    totpEnabled: true,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
};

// Minimal Express-like request with user set by JwtAuthGuard
function makeAuthRequest(userId = '00000000-0000-0000-0000-000000000001') {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'TestAgent/1.0' },
    user: { sub: userId, email: 'therapist@example.com', role: UserRole.THERAPIST },
  };
}

describe('AuthController — TOTP endpoints', () => {
  let controller: AuthController;
  let mockAuthService: {
    setupTotp: ReturnType<typeof vi.fn>;
    enableTotp: ReturnType<typeof vi.fn>;
    disableTotp: ReturnType<typeof vi.fn>;
    completeTotpLogin: ReturnType<typeof vi.fn>;
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    refreshTokens: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockAuthService = {
      setupTotp: vi.fn().mockResolvedValue(mockSetupResult),
      enableTotp: vi.fn().mockResolvedValue(mockEnableResult),
      disableTotp: vi.fn().mockResolvedValue(undefined),
      completeTotpLogin: vi.fn().mockResolvedValue(mockLoginResult),
      register: vi.fn(),
      login: vi.fn(),
      refreshTokens: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── POST /auth/totp/setup ─────────────────────────────────────────────────

  describe('POST /auth/totp/setup', () => {
    it('returns 200 with otpauthUri and qrCodeDataUrl', async () => {
      const result = await controller.totpSetup(makeAuthRequest() as never);

      expect(result).toEqual({ success: true, data: mockSetupResult });
    });

    it('calls service with the authenticated user ID', async () => {
      await controller.totpSetup(makeAuthRequest('user-abc') as never);

      expect(mockAuthService.setupTotp).toHaveBeenCalledWith('user-abc');
    });

    it('propagates BadRequestException when TOTP already enabled', async () => {
      mockAuthService.setupTotp.mockRejectedValue(new BadRequestException('TOTP already enabled'));

      await expect(controller.totpSetup(makeAuthRequest() as never)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('is annotated with @HttpCode(200)', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.totpSetup as object,
      );
      expect(metadata).toBe(HttpStatus.OK);
    });
  });

  // ── POST /auth/totp/enable ────────────────────────────────────────────────

  describe('POST /auth/totp/enable', () => {
    it('returns 200 with backup codes on success', async () => {
      const result = await controller.totpEnable({ token: '123456' }, makeAuthRequest() as never);

      expect(result).toEqual({ success: true, data: mockEnableResult });
    });

    it('calls service with user ID and token', async () => {
      await controller.totpEnable({ token: '123456' }, makeAuthRequest('user-abc') as never);

      expect(mockAuthService.enableTotp).toHaveBeenCalledWith('user-abc', '123456');
    });

    it('propagates BadRequestException when token is invalid', async () => {
      mockAuthService.enableTotp.mockRejectedValue(new BadRequestException('Invalid TOTP code'));

      await expect(
        controller.totpEnable({ token: '000000' }, makeAuthRequest() as never),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── POST /auth/totp/disable ───────────────────────────────────────────────

  describe('POST /auth/totp/disable', () => {
    it('returns 200 with empty data on success', async () => {
      const result = await controller.totpDisable({ token: '123456' }, makeAuthRequest() as never);

      expect(result).toEqual({ success: true, data: null });
    });

    it('calls service with user ID and token', async () => {
      await controller.totpDisable({ token: '123456' }, makeAuthRequest('user-abc') as never);

      expect(mockAuthService.disableTotp).toHaveBeenCalledWith('user-abc', '123456');
    });

    it('propagates UnauthorizedException when token is invalid', async () => {
      mockAuthService.disableTotp.mockRejectedValue(new UnauthorizedException('Invalid TOTP code'));

      await expect(
        controller.totpDisable({ token: '000000' }, makeAuthRequest() as never),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ── POST /auth/totp/verify ────────────────────────────────────────────────

  describe('POST /auth/totp/verify', () => {
    it('returns 200 with full tokens on valid TOTP verification', async () => {
      const result = await controller.totpVerify(
        { totpPendingToken: 'pending.jwt', code: '123456' },
        makeAuthRequest() as never,
      );

      expect(result).toEqual({ success: true, data: mockLoginResult });
    });

    it('passes totpPendingToken, code, and meta to service', async () => {
      await controller.totpVerify(
        { totpPendingToken: 'the.token', code: '654321' },
        makeAuthRequest() as never,
      );

      expect(mockAuthService.completeTotpLogin).toHaveBeenCalledWith('the.token', '654321', {
        ipAddress: '127.0.0.1',
        userAgent: 'TestAgent/1.0',
      });
    });

    it('propagates UnauthorizedException when pending token is invalid', async () => {
      mockAuthService.completeTotpLogin.mockRejectedValue(
        new UnauthorizedException('Invalid TOTP token'),
      );

      await expect(
        controller.totpVerify(
          { totpPendingToken: 'bad.token', code: '123456' },
          makeAuthRequest() as never,
        ),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('is annotated with @HttpCode(200)', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.totpVerify as object,
      );
      expect(metadata).toBe(HttpStatus.OK);
    });
  });
});
