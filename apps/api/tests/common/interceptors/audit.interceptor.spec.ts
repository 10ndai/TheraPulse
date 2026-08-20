import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Reflector } from '@nestjs/core';
import { firstValueFrom, of, throwError } from 'rxjs';
import { AuditInterceptor } from '../../../src/common/interceptors/audit.interceptor';
import type { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';
import { AUDIT_ACTION_KEY } from '../../../src/common/decorators/audit-action.decorator';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

const mockAuditLog = {
  id: '00000000-0000-0000-0000-000000000001',
  action: 'user.login',
  resourceType: 'user',
  actorId: 'actor-id',
  resourceId: null,
  details: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: new Date('2026-01-01'),
};

function makeContext(options: {
  action?: string;
  userId?: string;
  ip?: string;
  userAgent?: string;
  forwardedFor?: string;
  params?: Record<string, string>;
}): ExecutionContext {
  const {
    action,
    userId,
    ip = '127.0.0.1',
    userAgent = 'test-agent',
    forwardedFor,
    params = {},
  } = options;

  const handler = function routeHandler() {};
  if (action) {
    Reflect.defineMetadata(AUDIT_ACTION_KEY, action, handler);
  }

  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId !== undefined ? { sub: userId } : undefined,
        ip,
        headers: {
          'user-agent': userAgent,
          ...(forwardedFor ? { 'x-forwarded-for': forwardedFor } : {}),
        },
        params,
      }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(value: unknown = { data: 'ok' }): CallHandler {
  return { handle: () => of(value) };
}

function makeErrorHandler(error: Error): CallHandler {
  return { handle: () => throwError(() => error) };
}

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditLogService: { log: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    auditLogService = { log: vi.fn().mockResolvedValue(mockAuditLog) };
    interceptor = new AuditInterceptor(
      auditLogService as unknown as AuditLogService,
      new Reflector(),
    );
  });

  // ── pass-through when no decorator ───────────────────────────────────────

  describe('when @AuditAction is NOT present', () => {
    it('passes the response through without logging', async () => {
      const context = makeContext({});

      const result = await firstValueFrom(
        interceptor.intercept(context, makeHandler({ data: 'ok' })),
      );

      expect(result).toEqual({ data: 'ok' });
      expect(auditLogService.log).not.toHaveBeenCalled();
    });

    it('does not log even for mutations when decorator is absent', async () => {
      const context = makeContext({ userId: 'some-user' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).not.toHaveBeenCalled();
    });
  });

  // ── success path with decorator ───────────────────────────────────────────

  describe('when @AuditAction IS present — success path', () => {
    it('logs the action after a successful response', async () => {
      const context = makeContext({ action: 'user.login', userId: 'actor-id' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledOnce();
      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'user.login' }),
      );
    });

    it('returns the original response data unchanged', async () => {
      const context = makeContext({ action: 'user.login' });

      const result = await firstValueFrom(
        interceptor.intercept(context, makeHandler({ id: '123' })),
      );

      expect(result).toEqual({ id: '123' });
    });

    it('includes actorId from request.user.id', async () => {
      const context = makeContext({ action: 'user.login', userId: 'user-uuid' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: 'user-uuid' }),
      );
    });

    it('sets actorId to undefined when request.user is absent (unauthenticated route)', async () => {
      const context = makeContext({ action: 'user.register' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      // actorId is omitted entirely (not set to undefined) when no user is present
      const logArg = (auditLogService.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(logArg).not.toHaveProperty('actorId');
    });

    it('extracts IP from x-forwarded-for header (first address)', async () => {
      const context = makeContext({
        action: 'user.login',
        forwardedFor: '203.0.113.1, 10.0.0.1',
      });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '203.0.113.1' }),
      );
    });

    it('falls back to request.ip when x-forwarded-for is absent', async () => {
      const context = makeContext({ action: 'user.login', ip: '192.168.1.1' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ ipAddress: '192.168.1.1' }),
      );
    });

    it('extracts userAgent from request headers', async () => {
      const context = makeContext({ action: 'user.login', userAgent: 'TestBrowser/1.0' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userAgent: 'TestBrowser/1.0' }),
      );
    });

    it('derives resourceType from the first segment of the action', async () => {
      const context = makeContext({ action: 'worksheet.submit' });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ resourceType: 'worksheet' }),
      );
    });

    it('extracts resourceId from route params when id param is present', async () => {
      const context = makeContext({
        action: 'user.update',
        params: { id: 'resource-uuid' },
      });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ resourceId: 'resource-uuid' }),
      );
    });

    it('sets resourceId to undefined when no id param in route', async () => {
      const context = makeContext({ action: 'user.register', params: {} });

      await firstValueFrom(interceptor.intercept(context, makeHandler()));

      // resourceId is omitted entirely (not set to undefined) when no id param is present
      const logArg = (auditLogService.log as ReturnType<typeof vi.fn>).mock.calls[0][0] as Record<
        string,
        unknown
      >;
      expect(logArg).not.toHaveProperty('resourceId');
    });
  });

  // ── error path ────────────────────────────────────────────────────────────

  describe('when the handler throws', () => {
    it('still logs the audit entry on error', async () => {
      const context = makeContext({ action: 'user.login' });
      const error = new Error('Unauthorized');

      await expect(
        firstValueFrom(interceptor.intercept(context, makeErrorHandler(error))),
      ).rejects.toThrow('Unauthorized');

      expect(auditLogService.log).toHaveBeenCalledOnce();
    });

    it('includes failed:true in error audit details', async () => {
      const context = makeContext({ action: 'user.login' });

      await expect(
        firstValueFrom(interceptor.intercept(context, makeErrorHandler(new Error('fail')))),
      ).rejects.toThrow();

      expect(auditLogService.log).toHaveBeenCalledWith(
        expect.objectContaining({ details: expect.objectContaining({ failed: true }) }),
      );
    });

    it('rethrows the original error after logging', async () => {
      const context = makeContext({ action: 'user.login' });
      const originalError = new Error('DB connection failed');

      await expect(
        firstValueFrom(interceptor.intercept(context, makeErrorHandler(originalError))),
      ).rejects.toBe(originalError);
    });

    it('rethrows original error even if audit log write also fails', async () => {
      auditLogService.log.mockRejectedValue(new Error('Audit DB down'));
      const context = makeContext({ action: 'user.login' });
      const originalError = new Error('Handler failed');

      await expect(
        firstValueFrom(interceptor.intercept(context, makeErrorHandler(originalError))),
      ).rejects.toBe(originalError);
    });
  });

  // ── resilience: audit write failures on success path ─────────────────────

  describe('resilience: audit write failure on success path', () => {
    it('still returns response even if audit log write fails', async () => {
      auditLogService.log.mockRejectedValue(new Error('Audit DB down'));
      const context = makeContext({ action: 'user.login' });

      const result = await firstValueFrom(
        interceptor.intercept(context, makeHandler({ ok: true })),
      );

      expect(result).toEqual({ ok: true });
    });
  });
});
