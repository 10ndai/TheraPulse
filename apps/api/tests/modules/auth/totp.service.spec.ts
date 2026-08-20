import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { generateSync } from '@otplib/totp';
import { crypto as nobleCrypto } from '@otplib/plugin-crypto-noble';
import { base32 as scureBase32 } from '@otplib/plugin-base32-scure';
import { TotpService } from '../../../src/modules/auth/totp.service';

describe('TotpService', () => {
  let service: TotpService;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [TotpService],
    }).compile();

    service = module.get<TotpService>(TotpService);
  });

  // ── generateSecret() ──────────────────────────────────────────────────────

  describe('generateSecret()', () => {
    it('returns a non-empty base32 secret string', () => {
      const result = service.generateSecret('user@example.com');

      expect(typeof result.secret).toBe('string');
      expect(result.secret.length).toBeGreaterThan(0);
    });

    it('returns an otpauth URI containing the email', () => {
      const result = service.generateSecret('user@example.com');

      expect(result.otpauthUri).toContain('user%40example.com');
    });

    it('returns an otpauth URI with the issuer "TheraPulse"', () => {
      const result = service.generateSecret('user@example.com');

      expect(result.otpauthUri).toContain('TheraPulse');
    });

    it('generates a unique secret on each call', () => {
      const first = service.generateSecret('user@example.com');
      const second = service.generateSecret('user@example.com');

      expect(first.secret).not.toBe(second.secret);
    });
  });

  // ── verifyToken() ─────────────────────────────────────────────────────────

  describe('verifyToken()', () => {
    it('returns true for a valid TOTP code', () => {
      const { secret } = service.generateSecret('user@example.com');
      // Use otplib sync API to generate a valid token for the secret
      const validToken = generateSync({
        secret,
        crypto: nobleCrypto,
        base32: scureBase32,
      }) as string;

      expect(service.verifyToken(secret, validToken)).toBe(true);
    });

    it('returns false for an invalid TOTP code', () => {
      const { secret } = service.generateSecret('user@example.com');

      expect(service.verifyToken(secret, '000000')).toBe(false);
    });

    it('returns false for an empty token string', () => {
      const { secret } = service.generateSecret('user@example.com');

      expect(service.verifyToken(secret, '')).toBe(false);
    });
  });

  // ── generateBackupCodes() ─────────────────────────────────────────────────

  describe('generateBackupCodes()', () => {
    it('returns exactly 8 backup codes', () => {
      const codes = service.generateBackupCodes();

      expect(codes).toHaveLength(8);
    });

    it('each code is exactly 8 alphanumeric characters', () => {
      const codes = service.generateBackupCodes();

      for (const code of codes) {
        expect(code).toMatch(/^[A-Za-z0-9]{8}$/);
      }
    });

    it('codes are unique within a single batch', () => {
      const codes = service.generateBackupCodes();
      const unique = new Set(codes);

      expect(unique.size).toBe(8);
    });

    it('generates different codes on successive calls', () => {
      const first = service.generateBackupCodes();
      const second = service.generateBackupCodes();

      expect(first).not.toEqual(second);
    });
  });
});
