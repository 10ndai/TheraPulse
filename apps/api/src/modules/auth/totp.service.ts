import { Injectable } from '@nestjs/common';
import { verifySync } from '@otplib/totp';
import { generateTOTP } from '@otplib/uri';
import { crypto as nobleCrypto } from '@otplib/plugin-crypto-noble';
import { base32 as scureBase32 } from '@otplib/plugin-base32-scure';
import { randomBytes } from 'crypto';

export interface TotpSecretResult {
  secret: string;
  otpauthUri: string;
}

const ISSUER = 'TheraPulse';
const TOTP_SECRET_BYTES = 20;
const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_LENGTH = 8;
const BACKUP_CODE_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const TOTP_OPTS = { crypto: nobleCrypto, base32: scureBase32 };

/**
 * Pure TOTP utility service — generates secrets, verifies codes, and creates backup codes.
 * Does not touch the database; all persistence is handled in AuthService.
 */
@Injectable()
export class TotpService {
  /**
   * Generates a new TOTP secret and the corresponding OTP auth URI.
   * The secret must be stored (encrypted) on the user record before being returned.
   */
  generateSecret(email: string): TotpSecretResult {
    // Generate random bytes via the noble crypto plugin, encode as base32
    const secretBytes = nobleCrypto.randomBytes(TOTP_SECRET_BYTES);
    const secret = scureBase32.encode(secretBytes, { padding: false });
    const otpauthUri = generateTOTP({ secret, label: email, issuer: ISSUER });
    return { secret, otpauthUri };
  }

  /**
   * Returns true if the 6-digit TOTP code is valid for the given base32 secret.
   * Uses a ±30-second window to account for clock drift.
   */
  verifyToken(secret: string, token: string): boolean {
    if (!token) return false;
    try {
      const result = verifySync({ token, secret, ...TOTP_OPTS });
      return result.valid;
    } catch {
      return false;
    }
  }

  /**
   * Generates 8 unique 8-character alphanumeric backup codes.
   * Returned in plaintext once — the caller must hash and persist them.
   */
  generateBackupCodes(): string[] {
    const codes: string[] = [];
    while (codes.length < BACKUP_CODE_COUNT) {
      const bytes = randomBytes(BACKUP_CODE_LENGTH);
      let code = '';
      for (const byte of bytes) {
        code += BACKUP_CODE_CHARS[byte % BACKUP_CODE_CHARS.length];
      }
      if (!codes.includes(code)) {
        codes.push(code);
      }
    }
    return codes;
  }
}
