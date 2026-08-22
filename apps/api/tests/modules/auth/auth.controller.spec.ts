import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, HttpStatus, UnauthorizedException } from '@nestjs/common';
import { ThrottlerException } from '@nestjs/throttler';
import { UserRole, UserStatus } from '@prisma/client';
import { AuthController } from '../../../src/modules/auth/auth.controller';
import { AuthService } from '../../../src/modules/auth/auth.service';
import type {
  RegisterResponseData,
  LoginResponseData,
  RefreshResponseData,
} from '../../../src/modules/auth/auth.service';

const mockRegisterResult: RegisterResponseData = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  role: UserRole.THERAPIST,
  status: UserStatus.PENDING,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockLoginResult: LoginResponseData = {
  accessToken: 'mock.access.token',
  refreshToken: 'aaaaaaaa-0000-0000-0000-000000000001:randomhex64',
  expiresIn: 900,
  user: {
    id: '00000000-0000-0000-0000-000000000001',
    email: 'user@example.com',
    role: UserRole.CLIENT,
    status: UserStatus.ACTIVE,
    totpEnabled: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
};

const mockRefreshResult: RefreshResponseData = {
  accessToken: 'mock.new.access.token',
  refreshToken: 'bbbbbbbb-0000-0000-0000-000000000001:newrandomhex',
  expiresIn: 900,
};

function makeRequest(overrides: Record<string, unknown> = {}) {
  return {
    ip: '127.0.0.1',
    headers: { 'user-agent': 'TestAgent/1.0' },
    ...overrides,
  };
}

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: {
    register: ReturnType<typeof vi.fn>;
    login: ReturnType<typeof vi.fn>;
    refreshTokens: ReturnType<typeof vi.fn>;
    getCurrentUser: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    mockAuthService = {
      register: vi.fn(),
      login: vi.fn(),
      refreshTokens: vi.fn(),
      getCurrentUser: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  // ── register() ────────────────────────────────────────────────────────────

  describe('POST /auth/register', () => {
    it('returns 201 with success envelope on valid therapist registration', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);

      const result = await controller.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        makeRequest() as never,
      );

      expect(result).toEqual({ success: true, data: mockRegisterResult });
    });

    it('returns 201 with ACTIVE status for client registration', async () => {
      const clientResult = {
        ...mockRegisterResult,
        role: UserRole.CLIENT,
        status: UserStatus.ACTIVE,
      };
      mockAuthService.register.mockResolvedValue(clientResult);

      const result = await controller.register(
        { email: 'client@example.com', password: 'P@ssw0rd!secure1', role: 'CLIENT' },
        makeRequest() as never,
      );

      expect(result.data.status).toBe(UserStatus.ACTIVE);
    });

    it('passes IP address and user-agent from request to service', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);

      await controller.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        makeRequest({ ip: '203.0.113.1', headers: { 'user-agent': 'Chrome/120' } }) as never,
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(expect.anything(), {
        ipAddress: '203.0.113.1',
        userAgent: 'Chrome/120',
      });
    });

    it('propagates ConflictException from service (duplicate email)', async () => {
      mockAuthService.register.mockRejectedValue(new ConflictException('Email already registered'));

      await expect(
        controller.register(
          { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
          makeRequest() as never,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it('calls service with the validated DTO', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);
      const dto = {
        email: 'therapist@example.com',
        password: 'P@ssw0rd!secure1',
        role: 'THERAPIST' as const,
      };

      await controller.register(dto, makeRequest() as never);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto, expect.any(Object));
    });

    it('uses unknown as fallback when request.ip is undefined', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);

      await controller.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        makeRequest({ ip: undefined }) as never,
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ ipAddress: 'unknown' }),
      );
    });

    it('uses unknown as fallback when user-agent header is absent', async () => {
      mockAuthService.register.mockResolvedValue(mockRegisterResult);

      await controller.register(
        { email: 'therapist@example.com', password: 'P@ssw0rd!secure1', role: 'THERAPIST' },
        makeRequest({ headers: {} }) as never,
      );

      expect(mockAuthService.register).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ userAgent: 'unknown' }),
      );
    });
  });

  // ── login() ───────────────────────────────────────────────────────────────

  describe('POST /auth/login', () => {
    it('returns 200 with success envelope on valid login', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);

      const result = await controller.login(
        { email: 'user@example.com', password: 'P@ssw0rd!secure1' },
        makeRequest() as never,
      );

      expect(result).toEqual({ success: true, data: mockLoginResult });
    });

    it('passes IP and user-agent to service', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);

      await controller.login(
        { email: 'user@example.com', password: 'P@ssw0rd!secure1' },
        makeRequest({ ip: '10.0.0.1', headers: { 'user-agent': 'Firefox/130' } }) as never,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith(expect.anything(), {
        ipAddress: '10.0.0.1',
        userAgent: 'Firefox/130',
      });
    });

    it('propagates UnauthorizedException from service', async () => {
      mockAuthService.login.mockRejectedValue(new UnauthorizedException('Invalid credentials'));

      await expect(
        controller.login({ email: 'user@example.com', password: 'wrong' }, makeRequest() as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('propagates ThrottlerException from service', async () => {
      mockAuthService.login.mockRejectedValue(new ThrottlerException());

      await expect(
        controller.login(
          { email: 'user@example.com', password: 'P@ssw0rd!secure1' },
          makeRequest() as never,
        ),
      ).rejects.toThrow(ThrottlerException);
    });

    it('uses unknown fallbacks when ip and user-agent are absent', async () => {
      mockAuthService.login.mockResolvedValue(mockLoginResult);

      await controller.login(
        { email: 'user@example.com', password: 'P@ssw0rd!secure1' },
        makeRequest({ ip: undefined, headers: {} }) as never,
      );

      expect(mockAuthService.login).toHaveBeenCalledWith(expect.anything(), {
        ipAddress: 'unknown',
        userAgent: 'unknown',
      });
    });

    it('is annotated with @HttpCode(200)', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.login as object,
      );
      expect(metadata).toBe(HttpStatus.OK);
    });
  });

  // ── refresh() ─────────────────────────────────────────────────────────────

  describe('POST /auth/refresh', () => {
    it('returns 200 with success envelope containing new tokens', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockRefreshResult);

      const result = await controller.refresh(
        { refreshToken: 'aaaaaaaa-0000-0000-0000-000000000001:rawtoken' },
        makeRequest() as never,
      );

      expect(result).toEqual({ success: true, data: mockRefreshResult });
    });

    it('passes raw refresh token and meta to service', async () => {
      mockAuthService.refreshTokens.mockResolvedValue(mockRefreshResult);

      await controller.refresh(
        { refreshToken: 'tokenid:rawtoken' },
        makeRequest({ ip: '10.0.0.2', headers: { 'user-agent': 'Safari/17' } }) as never,
      );

      expect(mockAuthService.refreshTokens).toHaveBeenCalledWith('tokenid:rawtoken', {
        ipAddress: '10.0.0.2',
        userAgent: 'Safari/17',
      });
    });

    it('propagates UnauthorizedException from service', async () => {
      mockAuthService.refreshTokens.mockRejectedValue(
        new UnauthorizedException('Invalid refresh token'),
      );

      await expect(
        controller.refresh({ refreshToken: 'invalid:token' }, makeRequest() as never),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('is annotated with @HttpCode(200)', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.refresh as object,
      );
      expect(metadata).toBe(HttpStatus.OK);
    });
  });

  // ── publicRegisterSchema validation (via ZodValidationPipe) ───────────────

  describe('publicRegisterSchema', () => {
    it('exports a schema that rejects ADMIN role', async () => {
      const { publicRegisterSchema } = await import('../../../src/modules/auth/auth.controller');
      const result = publicRegisterSchema.safeParse({
        email: 'admin@example.com',
        password: 'P@ssw0rd!secure1',
        role: 'ADMIN',
      });
      expect(result.success).toBe(false);
    });

    it('exports a schema that accepts THERAPIST role', async () => {
      const { publicRegisterSchema } = await import('../../../src/modules/auth/auth.controller');
      const result = publicRegisterSchema.safeParse({
        email: 'therapist@example.com',
        password: 'P@ssw0rd!secure1',
        role: 'THERAPIST',
      });
      expect(result.success).toBe(true);
    });

    it('exports a schema that accepts CLIENT role', async () => {
      const { publicRegisterSchema } = await import('../../../src/modules/auth/auth.controller');
      const result = publicRegisterSchema.safeParse({
        email: 'client@example.com',
        password: 'P@ssw0rd!secure1',
        role: 'CLIENT',
      });
      expect(result.success).toBe(true);
    });

    it('rejects weak passwords (fewer than 12 chars)', async () => {
      const { publicRegisterSchema } = await import('../../../src/modules/auth/auth.controller');
      const result = publicRegisterSchema.safeParse({
        email: 'client@example.com',
        password: 'Short1!',
        role: 'CLIENT',
      });
      expect(result.success).toBe(false);
    });

    it('rejects passwords without a special character', async () => {
      const { publicRegisterSchema } = await import('../../../src/modules/auth/auth.controller');
      const result = publicRegisterSchema.safeParse({
        email: 'client@example.com',
        password: 'NoSpecialChar12',
        role: 'CLIENT',
      });
      expect(result.success).toBe(false);
    });

    it('rejects invalid email addresses', async () => {
      const { publicRegisterSchema } = await import('../../../src/modules/auth/auth.controller');
      const result = publicRegisterSchema.safeParse({
        email: 'not-an-email',
        password: 'P@ssw0rd!secure1',
        role: 'CLIENT',
      });
      expect(result.success).toBe(false);
    });
  });

  // ── HTTP status code for register ─────────────────────────────────────────

  describe('HTTP response code', () => {
    it('register is annotated with @HttpCode(201)', () => {
      const metadata = Reflect.getMetadata(
        '__httpCode__',
        AuthController.prototype.register as object,
      );
      expect(metadata).toBe(HttpStatus.CREATED);
    });
  });

  // ── GET /auth/me ───────────────────────────────────────────────────────────

  describe('GET /auth/me', () => {
    const currentUser = {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'therapist@example.com',
      role: 'THERAPIST',
      status: 'ACTIVE',
      totpEnabled: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    };

    it('returns the authenticated user in the success envelope', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(currentUser);

      const req = makeRequest({ user: { sub: currentUser.id, role: 'THERAPIST' } });
      const result = await controller.me(req as never);

      expect(result).toEqual({ success: true, data: currentUser });
    });

    it('resolves the user from the token subject, never from client input', async () => {
      mockAuthService.getCurrentUser.mockResolvedValue(currentUser);

      const req = makeRequest({ user: { sub: currentUser.id, role: 'THERAPIST' } });
      await controller.me(req as never);

      expect(mockAuthService.getCurrentUser).toHaveBeenCalledWith(currentUser.id);
    });
  });
});
