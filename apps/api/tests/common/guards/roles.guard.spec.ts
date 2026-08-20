import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ForbiddenException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RolesGuard } from '../../../src/common/guards/roles.guard';
import type { AccessTokenPayload } from '../../../src/modules/auth/auth.service';

function makeContext(userRole: UserRole | null, _requiredRoles: UserRole[] | null) {
  const user: AccessTokenPayload | undefined = userRole
    ? { sub: '00000000-0000-0000-0000-000000000001', email: 'u@example.com', role: userRole }
    : undefined;

  const request = { user };

  const context = {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as never;

  return { context, request };
}

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let mockReflector: { getAllAndOverride: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockReflector = { getAllAndOverride: vi.fn().mockReturnValue(null) };

    const module = await Test.createTestingModule({
      providers: [RolesGuard, { provide: Reflector, useValue: mockReflector }],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
  });

  // ── no @Roles decorator ───────────────────────────────────────────────────

  describe('no @Roles decorator', () => {
    it('returns true when no roles are required', () => {
      mockReflector.getAllAndOverride.mockReturnValue(null);
      const { context } = makeContext(UserRole.CLIENT, null);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('returns true when roles array is empty', () => {
      mockReflector.getAllAndOverride.mockReturnValue([]);
      const { context } = makeContext(UserRole.CLIENT, null);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  // ── role matching ─────────────────────────────────────────────────────────

  describe('role matching', () => {
    it('returns true when user role is in the required roles list', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN, UserRole.THERAPIST]);
      const { context } = makeContext(UserRole.THERAPIST, null);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('throws ForbiddenException when user role is NOT in the required roles list', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      const { context } = makeContext(UserRole.CLIENT, null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });

    it('allows ADMIN when only ADMIN role is required', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.ADMIN]);
      const { context } = makeContext(UserRole.ADMIN, null);

      expect(guard.canActivate(context)).toBe(true);
    });

    it('allows CLIENT when multiple roles are permitted including CLIENT', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.THERAPIST, UserRole.CLIENT]);
      const { context } = makeContext(UserRole.CLIENT, null);

      expect(guard.canActivate(context)).toBe(true);
    });
  });

  // ── missing user ─────────────────────────────────────────────────────────

  describe('missing user', () => {
    it('throws ForbiddenException when request has no user (guard ordering issue)', () => {
      mockReflector.getAllAndOverride.mockReturnValue([UserRole.CLIENT]);
      const { context } = makeContext(null, null);

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    });
  });
});
