import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  EncryptionService,
  ENCRYPTED_FIELDS,
} from '../../../src/modules/encryption/encryption.service';

/** 64 lowercase hex chars = 32 bytes = valid AES-256 key */
const TEST_KEY = 'a'.repeat(64);

describe('EncryptionService', () => {
  let service: EncryptionService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: { getOrThrow: vi.fn().mockReturnValue(TEST_KEY) },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
  });

  // ── encrypt() ─────────────────────────────────────────────────────────────

  describe('encrypt()', () => {
    it('returns a string with the v1. version prefix', () => {
      const result = service.encrypt('hello');
      expect(result).toMatch(/^v1\./);
    });

    it('two encryptions of the same plaintext produce different ciphertexts (random IV)', () => {
      const a = service.encrypt('same input');
      const b = service.encrypt('same input');
      expect(a).not.toBe(b);
    });

    it('the payload after v1. is valid base64', () => {
      const encrypted = service.encrypt('test');
      const payload = encrypted.slice('v1.'.length);
      expect(() => Buffer.from(payload, 'base64')).not.toThrow();
      expect(Buffer.from(payload, 'base64').length).toBeGreaterThan(0);
    });

    it('encoded buffer contains at least IV (12) + authTag (16) = 28 bytes overhead', () => {
      const encrypted = service.encrypt('x');
      const buf = Buffer.from(encrypted.slice('v1.'.length), 'base64');
      // 12 IV + len(plaintext) + 16 authTag >= 29 bytes
      expect(buf.length).toBeGreaterThanOrEqual(29);
    });
  });

  // ── decrypt() ─────────────────────────────────────────────────────────────

  describe('decrypt()', () => {
    it('correctly decrypts ASCII plaintext (roundtrip)', () => {
      const plaintext = 'Hello, World!';
      expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
    });

    it('correctly decrypts UTF-8 / unicode plaintext', () => {
      const plaintext = 'Ndeipi sei 🌍 — tête-à-tête';
      expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
    });

    it('correctly decrypts empty string', () => {
      expect(service.decrypt(service.encrypt(''))).toBe('');
    });

    it('correctly decrypts a JSON payload', () => {
      const json = JSON.stringify({
        name: 'Alice',
        phone: '+263771234567',
        email: 'alice@example.com',
      });
      expect(service.decrypt(service.encrypt(json))).toBe(json);
    });

    it('throws when the ciphertext does not start with v1.', () => {
      expect(() => service.decrypt('garbage')).toThrow();
      expect(() => service.decrypt('v2.something')).toThrow();
      expect(() => service.decrypt('')).toThrow();
    });

    it('throws when ciphertext is tampered (GCM auth tag verification fails)', () => {
      const encrypted = service.encrypt('sensitive data');
      // Replace last 4 chars of the base64 payload to tamper with the auth tag
      const tampered = encrypted.slice(0, -4) + 'AAAA';
      expect(() => service.decrypt(tampered)).toThrow();
    });

    it('throws when the ciphertext payload is truncated (missing auth tag)', () => {
      // Truncate to fewer than 28 bytes — does not need a real encrypted value
      const truncated = `v1.${Buffer.alloc(10).toString('base64')}`;
      expect(() => service.decrypt(truncated)).toThrow();
    });
  });

  // ── ENCRYPTED_FIELDS ──────────────────────────────────────────────────────

  describe('ENCRYPTED_FIELDS', () => {
    it('covers the User model with totpSecret', () => {
      expect(ENCRYPTED_FIELDS.get('User')).toContain('totpSecret');
    });

    it('covers TherapistProfile with phone', () => {
      expect(ENCRYPTED_FIELDS.get('TherapistProfile')).toContain('phone');
    });

    it('covers ClientProfile with phone, dateOfBirth, emergencyContact', () => {
      const fields = ENCRYPTED_FIELDS.get('ClientProfile');
      expect(fields).toContain('phone');
      expect(fields).toContain('dateOfBirth');
      expect(fields).toContain('emergencyContact');
    });

    it('covers WorksheetSubmission with responses', () => {
      expect(ENCRYPTED_FIELDS.get('WorksheetSubmission')).toContain('responses');
    });

    it('covers SessionNote with all four SOAP fields', () => {
      const fields = ENCRYPTED_FIELDS.get('SessionNote');
      expect(fields).toContain('subjective');
      expect(fields).toContain('objective');
      expect(fields).toContain('assessment');
      expect(fields).toContain('plan');
    });
  });

  // ── processWriteArgs() ────────────────────────────────────────────────────

  describe('processWriteArgs()', () => {
    // ── pass-through when model is not in ENCRYPTED_FIELDS ─────────────────

    it('does not modify args when model has no encrypted fields', () => {
      const args = { data: { templateId: 'tpl-1', status: 'PENDING' } };
      service.processWriteArgs('WorksheetAssignment', 'create', args);
      expect(args.data['templateId']).toBe('tpl-1');
      expect(args.data['status']).toBe('PENDING');
    });

    it('does not modify args when model is undefined', () => {
      const args = { data: { phone: '+263771234567' } };
      service.processWriteArgs(undefined, 'create', args);
      expect(args.data['phone']).toBe('+263771234567');
    });

    // ── encryption on write actions ────────────────────────────────────────

    it('encrypts designated fields on create, not other fields', () => {
      const args = {
        data: { phone: '+263771234567', name: 'Dr Moyo', licenseNumber: 'ZIM-001' },
      };
      service.processWriteArgs('TherapistProfile', 'create', args);
      const data = args.data as Record<string, unknown>;
      expect(data['phone']).toMatch(/^v1\./); // encrypted
      expect(data['name']).toBe('Dr Moyo'); // NOT encrypted
      expect(data['licenseNumber']).toBe('ZIM-001'); // NOT encrypted
    });

    it('encrypts multiple fields on ClientProfile create', () => {
      const args = {
        data: {
          phone: '+263771234567',
          dateOfBirth: '1990-05-15',
          emergencyContact: '{"name":"Mom"}',
          name: 'Alice',
        },
      };
      service.processWriteArgs('ClientProfile', 'create', args);
      const data = args.data as Record<string, unknown>;
      expect(data['phone']).toMatch(/^v1\./);
      expect(data['dateOfBirth']).toMatch(/^v1\./);
      expect(data['emergencyContact']).toMatch(/^v1\./);
      expect(data['name']).toBe('Alice'); // not in ENCRYPTED_FIELDS
    });

    it('encrypts designated fields on update action', () => {
      const args = { where: { id: '1' }, data: { phone: '+263771234567' } };
      service.processWriteArgs('TherapistProfile', 'update', args);
      expect((args.data as Record<string, unknown>)['phone']).toMatch(/^v1\./);
    });

    it('encrypts create and update data on upsert', () => {
      const args = {
        where: { userId: '1' },
        create: { phone: '+263771234567', name: 'Dr Moyo' },
        update: { phone: '+263770000000' },
      };
      service.processWriteArgs('TherapistProfile', 'upsert', args);
      expect((args['create'] as Record<string, unknown>)['phone']).toMatch(/^v1\./);
      expect((args['update'] as Record<string, unknown>)['phone']).toMatch(/^v1\./);
    });

    it('encrypts items in createMany data array', () => {
      const args = {
        data: [{ phone: '+263771111111' }, { phone: '+263772222222' }],
      };
      service.processWriteArgs('TherapistProfile', 'createMany', args);
      const items = args.data as Array<Record<string, unknown>>;
      expect(items[0]!['phone']).toMatch(/^v1\./);
      expect(items[1]!['phone']).toMatch(/^v1\./);
    });

    it('encrypts single-object form of createMany data (non-array object)', () => {
      const args = { data: { phone: '+263771111111' } };
      service.processWriteArgs('TherapistProfile', 'createMany', args);
      expect((args.data as Record<string, unknown>)['phone']).toMatch(/^v1\./);
    });

    it('does not encrypt null fields on write', () => {
      const args = { data: { phone: null, name: 'Dr Moyo' } };
      service.processWriteArgs('TherapistProfile', 'create', args);
      expect((args.data as Record<string, unknown>)['phone']).toBeNull();
    });

    it('is a no-op for non-write operations (findUnique)', () => {
      const args = { where: { id: '1' } };
      const before = JSON.stringify(args);
      service.processWriteArgs('TherapistProfile', 'findUnique', args);
      expect(JSON.stringify(args)).toBe(before);
    });
  });

  // ── processReadResult() ───────────────────────────────────────────────────

  describe('processReadResult()', () => {
    it('decrypts designated fields in a single object result', () => {
      const plainPhone = '+263771234567';
      const result = service.processReadResult('TherapistProfile', {
        id: '1',
        phone: service.encrypt(plainPhone),
        name: 'Dr Moyo',
      }) as Record<string, unknown>;

      expect(result['phone']).toBe(plainPhone);
      expect(result['name']).toBe('Dr Moyo'); // not decrypted
    });

    it('decrypts designated fields in an array result', () => {
      const plain1 = '+263771111111';
      const plain2 = '+263772222222';
      const result = service.processReadResult('TherapistProfile', [
        { id: '1', phone: service.encrypt(plain1) },
        { id: '2', phone: service.encrypt(plain2) },
      ]) as Array<Record<string, unknown>>;

      expect(result[0]!['phone']).toBe(plain1);
      expect(result[1]!['phone']).toBe(plain2);
    });

    it('does not decrypt null fields in result', () => {
      const result = service.processReadResult('TherapistProfile', {
        id: '1',
        phone: null,
        name: 'Dr Moyo',
      }) as Record<string, unknown>;
      expect(result['phone']).toBeNull();
    });

    it('passes result through unchanged when model has no encrypted fields', () => {
      const original = { id: '1', count: 5 };
      const result = service.processReadResult('WorksheetAssignment', original);
      expect(result).toBe(original);
    });

    it('passes result through unchanged when model is undefined', () => {
      const original = { count: 3 };
      const result = service.processReadResult(undefined, original);
      expect(result).toBe(original);
    });

    it('returns null as-is', () => {
      expect(service.processReadResult('TherapistProfile', null)).toBeNull();
    });

    it('returns undefined as-is', () => {
      expect(service.processReadResult('TherapistProfile', undefined)).toBeUndefined();
    });

    it('passes primitive result through unchanged', () => {
      // e.g. aggregate count returning a number
      expect(service.processReadResult('TherapistProfile', 42)).toBe(42);
    });

    it('decrypts fields in create result (returned entity after write)', () => {
      const plainPhone = '+263771234567';
      const encrypted = service.encrypt(plainPhone);
      const result = service.processReadResult('TherapistProfile', {
        id: '1',
        phone: encrypted,
      }) as Record<string, unknown>;
      expect(result['phone']).toBe(plainPhone);
    });

    it('passes {count: N} batch result through unchanged (count is not an encrypted field)', () => {
      const result = service.processReadResult('TherapistProfile', { count: 5 });
      expect(result).toEqual({ count: 5 });
    });
  });
});
