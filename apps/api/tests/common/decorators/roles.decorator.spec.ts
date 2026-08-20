import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { Roles, ROLES_KEY } from '../../../src/common/decorators/roles.decorator';

describe('@Roles() decorator', () => {
  it('sets ROLES_KEY metadata with the provided roles on a handler', () => {
    class TestController {
      @Roles(UserRole.ADMIN, UserRole.THERAPIST)
      handler() {}
    }

    const reflector = new Reflector();
    const metadata = reflector.get<UserRole[]>(ROLES_KEY, TestController.prototype.handler);
    expect(metadata).toEqual([UserRole.ADMIN, UserRole.THERAPIST]);
  });

  it('sets a single role correctly', () => {
    class TestController {
      @Roles(UserRole.ADMIN)
      handler() {}
    }

    const reflector = new Reflector();
    const metadata = reflector.get<UserRole[]>(ROLES_KEY, TestController.prototype.handler);
    expect(metadata).toEqual([UserRole.ADMIN]);
  });

  it('exports ROLES_KEY as a non-empty string', () => {
    expect(typeof ROLES_KEY).toBe('string');
    expect(ROLES_KEY.length).toBeGreaterThan(0);
  });
});
