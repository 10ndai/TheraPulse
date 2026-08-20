import { randomBytes, createCipheriv, createDecipheriv } from 'crypto';
import { Injectable } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { ConfigService } from '@nestjs/config';

/**
 * Maps Prisma model names to the set of fields that must be
 * encrypted at rest using AES-256-GCM.
 *
 * Encrypted at the application layer — stored as opaque `v1.<base64>` strings.
 * NEVER log, expose in error messages, or transmit the plaintext values.
 */
export const ENCRYPTED_FIELDS = new Map<string, ReadonlySet<string>>([
  ['User', new Set(['totpSecret'])],
  ['TherapistProfile', new Set(['phone'])],
  ['ClientProfile', new Set(['phone', 'dateOfBirth', 'emergencyContact'])],
  ['WorksheetSubmission', new Set(['responses'])],
  ['SessionNote', new Set(['subjective', 'objective', 'assessment', 'plan'])],
]);

const VERSION_PREFIX = 'v1.';
const IV_BYTES = 12; // 96-bit IV — optimal for AES-GCM
const TAG_BYTES = 16; // 128-bit authentication tag

/**
 * Provides AES-256-GCM field-level encryption for clinical data.
 *
 * Ciphertext format: `v1.<base64(iv[12] + ciphertext + authTag[16])>`
 * The version prefix enables zero-downtime key rotation in the future.
 *
 * Usage:
 *  - Call encrypt() / decrypt() directly from services when needed.
 *  - Register createPrismaMiddleware() in PrismaService.onModuleInit() to
 *    get transparent encryption/decryption on all Prisma operations.
 */
@Injectable()
export class EncryptionService {
  private readonly key: Buffer;

  constructor(private readonly config: ConfigService) {
    const hexKey = this.config.getOrThrow<string>('ENCRYPTION_KEY');
    this.key = Buffer.from(hexKey, 'hex');
  }

  /**
   * Encrypts a UTF-8 plaintext string using AES-256-GCM.
   * Returns `v1.<base64(IV + ciphertext + authTag)>`.
   * A fresh random IV is generated on every call.
   */
  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const payload = Buffer.concat([iv, ciphertext, authTag]);
    return `${VERSION_PREFIX}${payload.toString('base64')}`;
  }

  /**
   * Decrypts a ciphertext produced by encrypt().
   * Throws if the version prefix is unsupported or authentication fails
   * (tampered ciphertext / wrong key).
   */
  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(VERSION_PREFIX)) {
      throw new Error(`Unsupported encryption version — expected "${VERSION_PREFIX}" prefix`);
    }
    const buf = Buffer.from(ciphertext.slice(VERSION_PREFIX.length), 'base64');
    if (buf.length < IV_BYTES + TAG_BYTES) {
      throw new Error('Ciphertext is too short to contain IV and authentication tag');
    }
    const iv = buf.subarray(0, IV_BYTES);
    const authTag = buf.subarray(buf.length - TAG_BYTES);
    const encrypted = buf.subarray(IV_BYTES, buf.length - TAG_BYTES);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted).toString('utf8') + decipher.final('utf8');
  }

  /**
   * Encrypts designated fields in write-operation args in place.
   * Called from PrismaService's $extends query hook before executing the query.
   *
   * Only models listed in ENCRYPTED_FIELDS are affected; all others are no-ops.
   */
  processWriteArgs(
    model: string | undefined,
    operation: string,
    args: Record<string, unknown>,
  ): void {
    if (!model) return;
    const fields = ENCRYPTED_FIELDS.get(model);
    if (!fields) return;

    const writeActions = new Set(['create', 'update', 'upsert', 'createMany', 'updateMany']);
    if (writeActions.has(operation)) {
      this.encryptWriteArgs(args, operation, fields);
    }
  }

  /**
   * Decrypts designated fields in query results.
   * Called from PrismaService's $extends query hook after executing the query.
   *
   * Only models listed in ENCRYPTED_FIELDS are affected; all others pass through.
   */
  processReadResult(model: string | undefined, result: unknown): unknown {
    if (!model) return result;
    const fields = ENCRYPTED_FIELDS.get(model);
    if (!fields) return result;
    return this.decryptResult(result, fields);
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private encryptWriteArgs(
    args: Record<string, unknown>,
    action: string,
    fields: ReadonlySet<string>,
  ): void {
    switch (action) {
      case 'create':
      case 'update':
      case 'updateMany': {
        const data = args['data'] as Record<string, unknown> | undefined;
        if (data) this.encryptObject(data, fields);
        break;
      }
      case 'upsert': {
        const create = args['create'] as Record<string, unknown> | undefined;
        const update = args['update'] as Record<string, unknown> | undefined;
        if (create) this.encryptObject(create, fields);
        if (update) this.encryptObject(update, fields);
        break;
      }
      case 'createMany': {
        const data = args['data'];
        if (Array.isArray(data)) {
          for (const item of data as Array<Record<string, unknown>>) {
            this.encryptObject(item, fields);
          }
        } else if (data && typeof data === 'object') {
          this.encryptObject(data as Record<string, unknown>, fields);
        }
        break;
      }
    }
  }

  /** Mutates obj in place — encrypts any string field that is in the fields set. */
  private encryptObject(obj: Record<string, unknown>, fields: ReadonlySet<string>): void {
    for (const field of fields) {
      if (typeof obj[field] === 'string') {
        obj[field] = this.encrypt(obj[field] as string);
      }
    }
  }

  /** Returns a new object/array with designated string fields decrypted. */
  private decryptResult(result: unknown, fields: ReadonlySet<string>): unknown {
    if (result === null || result === undefined) return result;
    if (Array.isArray(result)) {
      return result.map((item) => this.decryptObject(item as Record<string, unknown>, fields));
    }
    if (typeof result === 'object') {
      return this.decryptObject(result as Record<string, unknown>, fields);
    }
    return result;
  }

  /** Returns a shallow copy of obj with designated string fields decrypted. */
  private decryptObject(
    obj: Record<string, unknown>,
    fields: ReadonlySet<string>,
  ): Record<string, unknown> {
    const result = { ...obj };
    for (const field of fields) {
      if (typeof result[field] === 'string') {
        result[field] = this.decrypt(result[field] as string);
      }
    }
    return result;
  }
}
