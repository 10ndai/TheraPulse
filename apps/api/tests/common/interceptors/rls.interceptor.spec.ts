import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { RlsInterceptor } from '../../../src/common/interceptors/rls.interceptor';
import { RlsContextService } from '../../../src/common/interceptors/rls-context.service';

const buildContext = (
  user: { sub: string; role: string } | undefined,
  _isPublic = false,
): ExecutionContext => {
  const mockHandler = vi.fn();
  const _mockReflector = {
    getAllAndOverride: vi.fn().mockReturnValue(_isPublic),
  };
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => mockHandler,
    getClass: () => class {},
  } as unknown as ExecutionContext;
};

describe('RlsInterceptor', () => {
  let interceptor: RlsInterceptor;
  let rlsContext: RlsContextService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        RlsInterceptor,
        RlsContextService,
        {
          provide: Reflector,
          useValue: { getAllAndOverride: vi.fn().mockReturnValue(false) },
        },
      ],
    }).compile();

    interceptor = module.get<RlsInterceptor>(RlsInterceptor);
    rlsContext = module.get<RlsContextService>(RlsContextService);
  });

  it('runs the next handler and returns its value', () => {
    const ctx = buildContext({ sub: 'user-id', role: UserRole.CLIENT });
    const callHandlerResult = 'handler-result';
    const callHandler = {
      handle: vi.fn().mockReturnValue({
        subscribe: (cbs: {
          next: (v: unknown) => void;
          error: (e: unknown) => void;
          complete: () => void;
        }) => cbs.next(callHandlerResult),
      }),
    };

    const results: unknown[] = [];
    const obs = interceptor.intercept(ctx, callHandler as never);
    obs.subscribe({ next: (v) => results.push(v), error: () => {}, complete: () => {} });

    expect(obs).toBeDefined();
    expect(callHandler.handle).toHaveBeenCalled();
    expect(results).toEqual([callHandlerResult]);
  });

  it('sets RLS context when user is authenticated', () => {
    const user = { sub: '00000000-0000-0000-0000-000000000001', role: UserRole.THERAPIST };
    const ctx = buildContext(user);
    const setSpy = vi.spyOn(rlsContext, 'run');

    const callHandler = {
      handle: vi.fn().mockReturnValue({
        subscribe: vi.fn(),
      }),
    };

    const obs = interceptor.intercept(ctx, callHandler as never);
    obs.subscribe({ next: () => {}, error: () => {}, complete: () => {} });

    expect(setSpy).toHaveBeenCalledWith(
      { userId: user.sub, role: user.role },
      expect.any(Function),
    );
  });

  it('does NOT set RLS context when user is not authenticated (public route)', () => {
    const ctx = buildContext(undefined);
    const setSpy = vi.spyOn(rlsContext, 'run');

    const callHandler = {
      handle: vi.fn().mockReturnValue({
        subscribe: vi.fn(),
      }),
    };

    interceptor.intercept(ctx, callHandler as never);

    expect(setSpy).not.toHaveBeenCalled();
    expect(callHandler.handle).toHaveBeenCalled();
  });

  it('propagates errors from the inner handler', () => {
    const ctx = buildContext({ sub: 'user-id', role: UserRole.CLIENT });
    const error = new Error('handler error');
    const callHandler = {
      handle: vi.fn().mockReturnValue({
        subscribe: (cbs: {
          next: (v: unknown) => void;
          error: (e: unknown) => void;
          complete: () => void;
        }) => cbs.error(error),
      }),
    };

    const errors: unknown[] = [];
    const obs = interceptor.intercept(ctx, callHandler as never);
    obs.subscribe({ next: () => {}, error: (e) => errors.push(e), complete: () => {} });

    expect(errors).toEqual([error]);
  });

  it('propagates complete from the inner handler', () => {
    const ctx = buildContext({ sub: 'user-id', role: UserRole.CLIENT });
    const callHandler = {
      handle: vi.fn().mockReturnValue({
        subscribe: (cbs: {
          next: (v: unknown) => void;
          error: (e: unknown) => void;
          complete: () => void;
        }) => cbs.complete(),
      }),
    };

    let completed = false;
    const obs = interceptor.intercept(ctx, callHandler as never);
    obs.subscribe({
      next: () => {},
      error: () => {},
      complete: () => {
        completed = true;
      },
    });

    expect(completed).toBe(true);
  });

  it('getContext returns undefined outside run()', () => {
    expect(rlsContext.getContext()).toBeUndefined();
  });

  it('getContext returns the stored context inside run()', () => {
    const ctx = { userId: 'abc', role: 'THERAPIST' };
    let captured: ReturnType<typeof rlsContext.getContext>;
    rlsContext.run(ctx, () => {
      captured = rlsContext.getContext();
    });
    expect(captured).toEqual(ctx);
  });
});
