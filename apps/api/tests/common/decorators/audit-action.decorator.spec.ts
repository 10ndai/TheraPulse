import { describe, it, expect } from 'vitest';
import { Reflector } from '@nestjs/core';
import {
  AuditAction,
  AUDIT_ACTION_KEY,
} from '../../../src/common/decorators/audit-action.decorator';

describe('AuditAction decorator', () => {
  it('AUDIT_ACTION_KEY is a non-empty string constant', () => {
    expect(typeof AUDIT_ACTION_KEY).toBe('string');
    expect(AUDIT_ACTION_KEY.length).toBeGreaterThan(0);
  });

  it('sets metadata that Reflector can read from a method handler', () => {
    class TestController {
      @AuditAction('user.login')
      login() {}
    }

    const reflector = new Reflector();
    const meta = reflector.get<string>(
      AUDIT_ACTION_KEY,
      TestController.prototype.login as unknown as object,
    );
    expect(meta).toBe('user.login');
  });

  it('supports dot-notation action names', () => {
    class TestController {
      @AuditAction('worksheet.submit')
      submit() {}

      @AuditAction('note.finalize')
      finalize() {}
    }

    const reflector = new Reflector();
    expect(
      reflector.get(AUDIT_ACTION_KEY, TestController.prototype.submit as unknown as object),
    ).toBe('worksheet.submit');
    expect(
      reflector.get(AUDIT_ACTION_KEY, TestController.prototype.finalize as unknown as object),
    ).toBe('note.finalize');
  });

  it('different handlers get independent metadata values', () => {
    class ControllerA {
      @AuditAction('user.register')
      register() {}
    }

    class ControllerB {
      @AuditAction('user.login')
      login() {}
    }

    const reflector = new Reflector();
    expect(
      reflector.get(AUDIT_ACTION_KEY, ControllerA.prototype.register as unknown as object),
    ).toBe('user.register');
    expect(reflector.get(AUDIT_ACTION_KEY, ControllerB.prototype.login as unknown as object)).toBe(
      'user.login',
    );
  });

  it('returns undefined for a handler without the decorator', () => {
    class TestController {
      noDecorator() {}
    }

    const reflector = new Reflector();
    const meta = reflector.get<string | undefined>(
      AUDIT_ACTION_KEY,
      TestController.prototype.noDecorator as unknown as object,
    );
    expect(meta).toBeUndefined();
  });
});
