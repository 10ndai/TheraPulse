import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { JwtAuthGuard } from '../../../src/common/guards/jwt-auth.guard';
import type { AccessTokenPayload } from '../../../src/modules/auth/auth.service';

const mockPayload: AccessTokenPayload = {
  sub: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  role: UserRole.CLIENT,
};

function makeContext(
  overrides: {
    authorization?: string;
    handlerMeta?: Record<string, unknown>;
    classMeta?: Record<string, unknown>;
  } = {},
) {
  const request = {
    headers: {
      authorization: overrides.authorization,
    },
    user: undefined as unknown,
  };

  const reflector = {
    getAllAndOverride: vi.fn().mockReturnValue(false),
  };

  if (overrides.handlerMeta?.['is_public'] || overrides.classMeta?.['is_public']) {
    reflector.getAllAndOverride.mockReturnValue(true);
  }

  return {
    request,
    context: {
      switchToHttp: () => ({ getRequest: () => request }),
      getHandler: () => ({}),
      getClass: () => ({}),
    } as never,
    reflector,
  };
}

describe('JwtAuthGuard', () => {
  let guard: JwtAuthGuard;
  let mockJwtService: { verify: ReturnType<typeof vi.fn> };
  let mockReflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockJwtService = { verify: vi.fn().mockReturnValue(mockPayload) };
    mockReflector = { getAllAndOverride: vi.fn().mockReturnValue(false) };

    const module = await Test.createTestingModule({
      providers: [
        JwtAuthGuard,
        { provide: JwtService, useValue: mockJwtService },
        { provide: Reflector, useValue: mockReflector },
      ],
    }).compile();

    guard = module.get<JwtAuthGuard>(JwtAuthGuard);
  });

  // ── @Public bypass ────────────────────────────────────────────────────────

  describe('@Public() bypass', () => {
    it('returns true and skips token check when route is @Public', () => {
      mockReflector.getAllAndOverride.mockReturnValue(true);

      const { context } = makeContext();
      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(mockJwtService.verify).not.toHaveBeenCalled();
    });
  });

  // ── token extraction ──────────────────────────────────────────────────────

  describe('token extraction', () => {
    it('throws UnauthorizedException when Authorization header is absent', () => {
      const { context } = makeContext();

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Authorization type is not Bearer', () => {
      const { context } = makeContext({ authorization: 'Basic dXNlcjpwYXNz' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when Bearer token is invalid', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('invalid signature');
      });

      const { context } = makeContext({ authorization: 'Bearer badtoken' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });

    it('throws UnauthorizedException when token is expired', () => {
      mockJwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      const { context } = makeContext({ authorization: 'Bearer expiredtoken' });

      expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
    });
  });

  // ── successful authentication ─────────────────────────────────────────────

  describe('successful authentication', () => {
    it('returns true when a valid Bearer token is provided', () => {
      const { context } = makeContext({ authorization: 'Bearer valid.jwt.token' });

      const result = guard.canActivate(context);

      expect(result).toBe(true);
    });

    it('sets request.user with the decoded JWT payload', () => {
      const { context, request } = makeContext({ authorization: 'Bearer valid.jwt.token' });

      guard.canActivate(context);

      expect(request.user).toEqual(mockPayload);
    });

    it('calls jwtService.verify with the extracted token string', () => {
      const { context } = makeContext({ authorization: 'Bearer my.test.token' });

      guard.canActivate(context);

      expect(mockJwtService.verify).toHaveBeenCalledWith('my.test.token');
    });
  });
});
