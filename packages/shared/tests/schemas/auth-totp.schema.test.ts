import { describe, it, expect } from 'vitest';
import {
  totpTokenSchema,
  totpBackupCodeSchema,
  refreshTokenRequestSchema,
} from '../../src/schemas/auth.schema';

// ─────────────────────────────────────────────────────────────────────────────
// totpTokenSchema — 6-digit numeric TOTP code
// ─────────────────────────────────────────────────────────────────────────────

describe('totpTokenSchema', () => {
  it('accepts a valid 6-digit numeric code', () => {
    expect(totpTokenSchema.safeParse({ token: '123456' }).success).toBe(true);
  });

  it('rejects a 5-digit code', () => {
    expect(totpTokenSchema.safeParse({ token: '12345' }).success).toBe(false);
  });

  it('rejects a 7-digit code', () => {
    expect(totpTokenSchema.safeParse({ token: '1234567' }).success).toBe(false);
  });

  it('rejects a code with non-numeric characters', () => {
    expect(totpTokenSchema.safeParse({ token: '12345a' }).success).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(totpTokenSchema.safeParse({ token: '' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// totpBackupCodeSchema — 8-char alphanumeric backup code
// ─────────────────────────────────────────────────────────────────────────────

describe('totpBackupCodeSchema', () => {
  it('accepts a valid 8-char alphanumeric code', () => {
    expect(totpBackupCodeSchema.safeParse({ code: 'ABCD1234' }).success).toBe(true);
  });

  it('accepts lowercase alphanumeric', () => {
    expect(totpBackupCodeSchema.safeParse({ code: 'abcd1234' }).success).toBe(true);
  });

  it('rejects a code shorter than 8 chars', () => {
    expect(totpBackupCodeSchema.safeParse({ code: 'ABCD123' }).success).toBe(false);
  });

  it('rejects a code longer than 8 chars', () => {
    expect(totpBackupCodeSchema.safeParse({ code: 'ABCD12345' }).success).toBe(false);
  });

  it('rejects a code with special characters', () => {
    expect(totpBackupCodeSchema.safeParse({ code: 'ABCD123!' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// refreshTokenRequestSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('refreshTokenRequestSchema', () => {
  it('accepts a valid refresh token', () => {
    expect(
      refreshTokenRequestSchema.safeParse({ refreshToken: 'some-opaque-token-string' }).success,
    ).toBe(true);
  });

  it('rejects an empty refresh token', () => {
    expect(refreshTokenRequestSchema.safeParse({ refreshToken: '' }).success).toBe(false);
  });

  it('rejects missing refreshToken field', () => {
    expect(refreshTokenRequestSchema.safeParse({}).success).toBe(false);
  });
});
