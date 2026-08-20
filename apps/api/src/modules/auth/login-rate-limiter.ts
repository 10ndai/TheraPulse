import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { ConfigService } from '@nestjs/config';
import { ThrottlerException } from '@nestjs/throttler';

interface RateLimitRecord {
  count: number;
  windowStart: number;
}

/**
 * In-memory per-email login rate limiter.
 * Tracks failed attempts within a sliding window (LOGIN_RATE_LIMIT_WINDOW_MS).
 * Throws ThrottlerException once LOGIN_RATE_LIMIT_MAX failures are reached.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly store = new Map<string, RateLimitRecord>();
  private readonly max: number;
  private readonly windowMs: number;

  constructor(private readonly config: ConfigService) {
    this.max = this.config.get<number>('LOGIN_RATE_LIMIT_MAX', 5);
    this.windowMs = this.config.get<number>('LOGIN_RATE_LIMIT_WINDOW_MS', 900_000);
  }

  /** Throws ThrottlerException if the email has already hit the limit this window. */
  check(email: string): void {
    const now = Date.now();
    const record = this.store.get(email);
    if (!record) return;
    if (now - record.windowStart > this.windowMs) {
      this.store.delete(email);
      return;
    }
    if (record.count >= this.max) {
      throw new ThrottlerException();
    }
  }

  /** Records one failed attempt. Must be called AFTER check(). */
  recordFailure(email: string): void {
    const now = Date.now();
    const record = this.store.get(email);
    if (!record || now - record.windowStart > this.windowMs) {
      this.store.set(email, { count: 1, windowStart: now });
    } else {
      record.count += 1;
    }
  }

  /** Clears the failure counter after a successful login. */
  reset(email: string): void {
    this.store.delete(email);
  }
}
