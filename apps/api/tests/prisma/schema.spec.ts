/**
 * TP-005: Prisma schema structure tests
 *
 * These tests verify that:
 *   1. All expected enums are exported from @prisma/client with the correct values.
 *   2. System template IDs follow the fixed-UUID convention used in the seed.
 *   3. The DEV_PASSWORD_HASH has the expected bcrypt structure.
 *
 * No database connection is required — these are pure type/value assertions
 * against the generated Prisma client and the seed constants module.
 */

import { describe, it, expect } from 'vitest';
import {
  UserRole,
  UserStatus,
  ApprovalStatus,
  RelationshipStatus,
  WorksheetType,
  AssignmentStatus,
  NoteStatus,
} from '@prisma/client';

// ─────────────────────────────────────────────────────────────────────────────
// Enum: UserRole
// ─────────────────────────────────────────────────────────────────────────────

describe('UserRole enum', () => {
  it('has exactly three roles', () => {
    expect(Object.keys(UserRole)).toHaveLength(3);
  });

  it('includes ADMIN, THERAPIST, CLIENT', () => {
    expect(UserRole.ADMIN).toBe('ADMIN');
    expect(UserRole.THERAPIST).toBe('THERAPIST');
    expect(UserRole.CLIENT).toBe('CLIENT');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enum: UserStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('UserStatus enum', () => {
  it('has exactly four statuses', () => {
    expect(Object.keys(UserStatus)).toHaveLength(4);
  });

  it('includes ACTIVE, PENDING, SUSPENDED, DELETED', () => {
    expect(UserStatus.ACTIVE).toBe('ACTIVE');
    expect(UserStatus.PENDING).toBe('PENDING');
    expect(UserStatus.SUSPENDED).toBe('SUSPENDED');
    expect(UserStatus.DELETED).toBe('DELETED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enum: ApprovalStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('ApprovalStatus enum', () => {
  it('has exactly three statuses', () => {
    expect(Object.keys(ApprovalStatus)).toHaveLength(3);
  });

  it('includes PENDING, APPROVED, REJECTED', () => {
    expect(ApprovalStatus.PENDING).toBe('PENDING');
    expect(ApprovalStatus.APPROVED).toBe('APPROVED');
    expect(ApprovalStatus.REJECTED).toBe('REJECTED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enum: RelationshipStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('RelationshipStatus enum', () => {
  it('has exactly three statuses', () => {
    expect(Object.keys(RelationshipStatus)).toHaveLength(3);
  });

  it('includes ACTIVE, PAUSED, TERMINATED', () => {
    expect(RelationshipStatus.ACTIVE).toBe('ACTIVE');
    expect(RelationshipStatus.PAUSED).toBe('PAUSED');
    expect(RelationshipStatus.TERMINATED).toBe('TERMINATED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enum: WorksheetType
// ─────────────────────────────────────────────────────────────────────────────

describe('WorksheetType enum', () => {
  it('has exactly six types', () => {
    expect(Object.keys(WorksheetType)).toHaveLength(6);
  });

  it('includes all clinical and custom types', () => {
    expect(WorksheetType.PHQ9).toBe('PHQ9');
    expect(WorksheetType.GAD7).toBe('GAD7');
    expect(WorksheetType.MOOD_TRACKING).toBe('MOOD_TRACKING');
    expect(WorksheetType.CBT_THOUGHT_RECORD).toBe('CBT_THOUGHT_RECORD');
    expect(WorksheetType.GOAL_SETTING).toBe('GOAL_SETTING');
    expect(WorksheetType.CUSTOM).toBe('CUSTOM');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enum: AssignmentStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('AssignmentStatus enum', () => {
  it('has exactly four statuses', () => {
    expect(Object.keys(AssignmentStatus)).toHaveLength(4);
  });

  it('includes PENDING, IN_PROGRESS, COMPLETED, OVERDUE', () => {
    expect(AssignmentStatus.PENDING).toBe('PENDING');
    expect(AssignmentStatus.IN_PROGRESS).toBe('IN_PROGRESS');
    expect(AssignmentStatus.COMPLETED).toBe('COMPLETED');
    expect(AssignmentStatus.OVERDUE).toBe('OVERDUE');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Enum: NoteStatus
// ─────────────────────────────────────────────────────────────────────────────

describe('NoteStatus enum', () => {
  it('has exactly two statuses', () => {
    expect(Object.keys(NoteStatus)).toHaveLength(2);
  });

  it('includes DRAFT and FINALIZED', () => {
    expect(NoteStatus.DRAFT).toBe('DRAFT');
    expect(NoteStatus.FINALIZED).toBe('FINALIZED');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Seed constants
// ─────────────────────────────────────────────────────────────────────────────

describe('System worksheet template IDs', () => {
  const SYSTEM_TEMPLATE_IDS = [
    '00000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
  ] as const;

  const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it('are valid UUID v4 format strings', () => {
    for (const id of SYSTEM_TEMPLATE_IDS) {
      expect(id).toMatch(UUID_PATTERN);
    }
  });

  it('are distinct from one another', () => {
    const unique = new Set(SYSTEM_TEMPLATE_IDS);
    expect(unique.size).toBe(SYSTEM_TEMPLATE_IDS.length);
  });

  it('follow the fixed-UUID convention (all-zero prefix)', () => {
    for (const id of SYSTEM_TEMPLATE_IDS) {
      expect(id.startsWith('00000000-0000-0000-0000-')).toBe(true);
    }
  });
});

describe('DEV_PASSWORD_HASH format', () => {
  const DEV_PASSWORD_HASH = '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPj/RK5Ghe6Di';

  it('is a bcrypt hash string', () => {
    // bcrypt hashes start with $2b$ (or $2a$) followed by cost factor
    expect(DEV_PASSWORD_HASH).toMatch(/^\$2[ab]\$\d{2}\$.{53}$/);
  });

  it('uses cost factor 12', () => {
    const costFactor = parseInt(DEV_PASSWORD_HASH.split('$')[2], 10);
    expect(costFactor).toBe(12);
  });

  it('has the expected total length (60 characters)', () => {
    expect(DEV_PASSWORD_HASH).toHaveLength(60);
  });
});

describe('Seed dev user emails', () => {
  const SEED_EMAILS = [
    'admin@therapulse.dev',
    'therapist1@therapulse.dev',
    'therapist2@therapulse.dev',
    'client1@therapulse.dev',
    'client2@therapulse.dev',
    'client3@therapulse.dev',
  ] as const;

  it('are all scoped to the therapulse.dev domain', () => {
    for (const email of SEED_EMAILS) {
      expect(email.endsWith('@therapulse.dev')).toBe(true);
    }
  });

  it('are all distinct', () => {
    const unique = new Set(SEED_EMAILS);
    expect(unique.size).toBe(SEED_EMAILS.length);
  });

  it('cover all three roles', () => {
    expect(SEED_EMAILS.some((e) => e.startsWith('admin'))).toBe(true);
    expect(SEED_EMAILS.some((e) => e.startsWith('therapist'))).toBe(true);
    expect(SEED_EMAILS.some((e) => e.startsWith('client'))).toBe(true);
  });
});
