import { describe, it, expect, vi } from 'vitest';
import { of } from 'rxjs';
import { CacheControlInterceptor } from '../../../src/common/interceptors/cache-control.interceptor';
import type { ExecutionContext, CallHandler } from '@nestjs/common';

function makeContext(setHeader: ReturnType<typeof vi.fn>): ExecutionContext {
  return {
    switchToHttp: () => ({
      getResponse: () => ({ setHeader }),
    }),
  } as unknown as ExecutionContext;
}

function makeHandler(): CallHandler {
  return { handle: () => of({ ok: true }) };
}

describe('CacheControlInterceptor', () => {
  it('sets Cache-Control: no-store on the response', () => {
    const setHeader = vi.fn();
    const interceptor = new CacheControlInterceptor();
    interceptor.intercept(makeContext(setHeader), makeHandler()).subscribe();
    expect(setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
  });

  it('passes the response through unchanged', async () => {
    const interceptor = new CacheControlInterceptor();
    const result = await new Promise((resolve) => {
      interceptor.intercept(makeContext(vi.fn()), makeHandler()).subscribe((val) => resolve(val));
    });
    expect(result).toEqual({ ok: true });
  });

  it('calls setHeader before the handler completes', () => {
    const order: string[] = [];
    const setHeader = vi.fn(() => order.push('header'));
    const handler: CallHandler = {
      handle: () => {
        order.push('handler');
        return of(null);
      },
    };
    const interceptor = new CacheControlInterceptor();
    interceptor.intercept(makeContext(setHeader), handler).subscribe();
    expect(order[0]).toBe('header');
    expect(order[1]).toBe('handler');
  });
});
