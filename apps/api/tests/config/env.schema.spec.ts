import { describe, it, expect } from 'vitest';
import { envSchema } from '../../src/config/env.schema';

const BASE_ENV = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/therapulse',
  JWT_ACCESS_SECRET: 'a'.repeat(32),
  JWT_REFRESH_SECRET: 'b'.repeat(32),
  ENCRYPTION_KEY: 'a1b2c3d4'.repeat(8), // 64 hex chars = 32 bytes
};

describe('envSchema', () => {
  it('accepts a valid minimal config', () => {
    expect(envSchema.safeParse(BASE_ENV).success).toBe(true);
  });

  it('applies default PORT = 3001', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success && result.data.PORT).toBe(3001);
  });

  it('applies default NODE_ENV = development', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success && result.data.NODE_ENV).toBe('development');
  });

  it('coerces PORT from string to number', () => {
    const result = envSchema.safeParse({ ...BASE_ENV, PORT: '4000' });
    expect(result.success && result.data.PORT).toBe(4000);
  });

  it('rejects missing DATABASE_URL', () => {
    const { DATABASE_URL: _d, ...rest } = BASE_ENV;
    expect(envSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects JWT_ACCESS_SECRET shorter than 32 characters', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, JWT_ACCESS_SECRET: 'short' }).success).toBe(false);
  });

  it('rejects JWT_REFRESH_SECRET shorter than 32 characters', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, JWT_REFRESH_SECRET: 'short' }).success).toBe(false);
  });

  it('rejects ENCRYPTION_KEY that is not 64 hex characters', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, ENCRYPTION_KEY: 'not-a-hex-key' }).success).toBe(
      false,
    );
  });

  it('rejects ENCRYPTION_KEY with uppercase hex (must be lowercase)', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, ENCRYPTION_KEY: 'A1B2C3D4'.repeat(8) }).success).toBe(
      false,
    );
  });

  it('rejects invalid NODE_ENV value', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, NODE_ENV: 'staging' }).success).toBe(false);
  });

  it('accepts NODE_ENV = production', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, NODE_ENV: 'production' }).success).toBe(true);
  });

  it('accepts NODE_ENV = test', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, NODE_ENV: 'test' }).success).toBe(true);
  });

  it('applies default BCRYPT_COST_FACTOR = 12', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success && result.data.BCRYPT_COST_FACTOR).toBe(12);
  });

  it('rejects BCRYPT_COST_FACTOR below 10', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, BCRYPT_COST_FACTOR: '9' }).success).toBe(false);
  });

  it('rejects BCRYPT_COST_FACTOR above 14', () => {
    expect(envSchema.safeParse({ ...BASE_ENV, BCRYPT_COST_FACTOR: '15' }).success).toBe(false);
  });

  it('applies default LOGIN_RATE_LIMIT_MAX = 5', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success && result.data.LOGIN_RATE_LIMIT_MAX).toBe(5);
  });

  it('applies default LOGIN_RATE_LIMIT_WINDOW_MS = 900000', () => {
    const result = envSchema.safeParse(BASE_ENV);
    expect(result.success && result.data.LOGIN_RATE_LIMIT_WINDOW_MS).toBe(900000);
  });
});
