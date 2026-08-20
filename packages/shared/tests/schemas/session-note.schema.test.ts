import { describe, it, expect } from 'vitest';
import {
  createSessionNoteSchema,
  updateSessionNoteSchema,
} from '../../src/schemas/session-note.schema';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

// ─────────────────────────────────────────────────────────────────────────────
// createSessionNoteSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('createSessionNoteSchema', () => {
  const valid = {
    clientId: VALID_UUID,
    sessionDate: '2026-03-28T10:00:00.000Z',
    sessionType: 'individual',
  };

  it('accepts a minimal valid note (no SOAP fields)', () => {
    expect(createSessionNoteSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a full note with all SOAP fields', () => {
    const result = createSessionNoteSchema.safeParse({
      ...valid,
      subjective: 'Client reports feeling anxious.',
      objective: 'Appeared calm, good eye contact.',
      assessment: 'Moderate anxiety, improving.',
      plan: 'Continue CBT exercises, next session in 2 weeks.',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing clientId', () => {
    const { clientId: _c, ...rest } = valid;
    expect(createSessionNoteSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-UUID clientId', () => {
    expect(createSessionNoteSchema.safeParse({ ...valid, clientId: 'not-a-uuid' }).success).toBe(
      false,
    );
  });

  it('rejects missing sessionDate', () => {
    const { sessionDate: _d, ...rest } = valid;
    expect(createSessionNoteSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects invalid sessionDate format', () => {
    expect(createSessionNoteSchema.safeParse({ ...valid, sessionDate: '28-03-2026' }).success).toBe(
      false,
    );
  });

  it('rejects missing sessionType', () => {
    const { sessionType: _st, ...rest } = valid;
    expect(createSessionNoteSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty sessionType', () => {
    expect(createSessionNoteSchema.safeParse({ ...valid, sessionType: '' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateSessionNoteSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('updateSessionNoteSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(updateSessionNoteSchema.safeParse({}).success).toBe(true);
  });

  it('accepts update with only subjective field', () => {
    expect(updateSessionNoteSchema.safeParse({ subjective: 'Updated note.' }).success).toBe(true);
  });

  it('accepts update with new sessionDate', () => {
    expect(
      updateSessionNoteSchema.safeParse({ sessionDate: '2026-04-01T14:00:00.000Z' }).success,
    ).toBe(true);
  });

  it('still rejects empty sessionType when provided', () => {
    expect(updateSessionNoteSchema.safeParse({ sessionType: '' }).success).toBe(false);
  });

  it('still rejects invalid sessionDate when provided', () => {
    expect(updateSessionNoteSchema.safeParse({ sessionDate: 'not-a-date' }).success).toBe(false);
  });

  it('accepts null SOAP fields (clearing content)', () => {
    expect(updateSessionNoteSchema.safeParse({ subjective: null, objective: null }).success).toBe(
      true,
    );
  });
});
