import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThrottlerException } from '@nestjs/throttler';
import { LoginRateLimiter } from '../../../src/modules/auth/login-rate-limiter';

const EMAIL = 'user@example.com';

function makeModule(max = 3, windowMs = 900_000) {
  return Test.createTestingModule({
    providers: [
      LoginRateLimiter,
      {
        provide: ConfigService,
        useValue: {
          get: vi.fn().mockImplementation((key: string) => {
            if (key === 'LOGIN_RATE_LIMIT_MAX') return max;
            if (key === 'LOGIN_RATE_LIMIT_WINDOW_MS') return windowMs;
            return undefined;
          }),
        },
      },
    ],
  }).compile();
}

describe('LoginRateLimiter', () => {
  let limiter: LoginRateLimiter;

  beforeEach(async () => {
    vi.clearAllMocks();
    const module = await makeModule();
    limiter = module.get<LoginRateLimiter>(LoginRateLimiter);
  });

  // ── check() ───────────────────────────────────────────────────────────────

  describe('check()', () => {
    it('does not throw when there is no recorded failure', () => {
      expect(() => limiter.check(EMAIL)).not.toThrow();
    });

    it('does not throw when failure count is below the limit', () => {
      limiter.recordFailure(EMAIL); // count = 1 (max is 3)
      limiter.recordFailure(EMAIL); // count = 2

      expect(() => limiter.check(EMAIL)).not.toThrow();
    });

    it('throws ThrottlerException when failure count reaches the limit', () => {
      limiter.recordFailure(EMAIL); // 1
      limiter.recordFailure(EMAIL); // 2
      limiter.recordFailure(EMAIL); // 3 — at max

      expect(() => limiter.check(EMAIL)).toThrow(ThrottlerException);
    });

    it('does not throw after the window has expired', async () => {
      const module = await makeModule(3, 50); // 50ms window
      const shortLimiter = module.get<LoginRateLimiter>(LoginRateLimiter);

      shortLimiter.recordFailure(EMAIL);
      shortLimiter.recordFailure(EMAIL);
      shortLimiter.recordFailure(EMAIL); // at limit

      // Advance time past the window
      await new Promise((resolve) => setTimeout(resolve, 60));

      expect(() => shortLimiter.check(EMAIL)).not.toThrow();
    });
  });

  // ── recordFailure() ───────────────────────────────────────────────────────

  describe('recordFailure()', () => {
    it('starts a new record on first failure', () => {
      limiter.recordFailure(EMAIL);

      // Should not throw yet (1 failure, max is 3)
      expect(() => limiter.check(EMAIL)).not.toThrow();
    });

    it('increments the counter on repeated failures', () => {
      limiter.recordFailure(EMAIL); // 1
      limiter.recordFailure(EMAIL); // 2
      limiter.recordFailure(EMAIL); // 3

      expect(() => limiter.check(EMAIL)).toThrow(ThrottlerException);
    });

    it('resets the window when a failure arrives after the window expires', async () => {
      const module = await makeModule(3, 50); // 50ms window
      const shortLimiter = module.get<LoginRateLimiter>(LoginRateLimiter);

      shortLimiter.recordFailure(EMAIL); // 1
      shortLimiter.recordFailure(EMAIL); // 2

      await new Promise((resolve) => setTimeout(resolve, 60));

      // New window — count restarts at 1
      shortLimiter.recordFailure(EMAIL);
      expect(() => shortLimiter.check(EMAIL)).not.toThrow();
    });
  });

  // ── reset() ───────────────────────────────────────────────────────────────

  describe('reset()', () => {
    it('clears the failure counter so subsequent checks pass', () => {
      limiter.recordFailure(EMAIL); // 1
      limiter.recordFailure(EMAIL); // 2
      limiter.recordFailure(EMAIL); // 3 — at limit

      limiter.reset(EMAIL);

      expect(() => limiter.check(EMAIL)).not.toThrow();
    });

    it('is a no-op when called for an email with no failures', () => {
      expect(() => limiter.reset(EMAIL)).not.toThrow();
    });
  });
});
