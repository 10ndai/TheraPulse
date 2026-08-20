import { describe, it, expect } from 'vitest';
import {
  createTherapistProfileSchema,
  updateTherapistProfileSchema,
  createClientProfileSchema,
  updateClientProfileSchema,
} from '../../src/schemas/profile.schema';

// ─────────────────────────────────────────────────────────────────────────────
// createTherapistProfileSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('createTherapistProfileSchema', () => {
  const valid = {
    name: 'Dr. Tariro Moyo',
    specializations: ['anxiety', 'CBT'],
    qualifications: ['MSc Clinical Psychology'],
    languages: ['English', 'Shona'],
  };

  it('accepts a minimal valid profile', () => {
    expect(createTherapistProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a full valid profile', () => {
    const result = createTherapistProfileSchema.safeParse({
      ...valid,
      bio: 'Specialises in anxiety and trauma.',
      licenseNumber: 'HPCZ-CP-00142',
      city: 'Harare',
      province: 'Harare',
      phone: '+263712345678',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    const { name: _name, ...rest } = valid;
    expect(createTherapistProfileSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(createTherapistProfileSchema.safeParse({ ...valid, name: '' }).success).toBe(false);
  });

  it('rejects empty specializations array', () => {
    expect(createTherapistProfileSchema.safeParse({ ...valid, specializations: [] }).success).toBe(
      false,
    );
  });

  it('rejects empty languages array', () => {
    expect(createTherapistProfileSchema.safeParse({ ...valid, languages: [] }).success).toBe(false);
  });

  it('rejects non-string values in specializations', () => {
    expect(
      createTherapistProfileSchema.safeParse({ ...valid, specializations: [1, 2] }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateTherapistProfileSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('updateTherapistProfileSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(updateTherapistProfileSchema.safeParse({}).success).toBe(true);
  });

  it('accepts a partial update with only name', () => {
    expect(updateTherapistProfileSchema.safeParse({ name: 'Dr. New Name' }).success).toBe(true);
  });

  it('still rejects empty name when provided', () => {
    expect(updateTherapistProfileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('still rejects empty specializations array when provided', () => {
    expect(updateTherapistProfileSchema.safeParse({ specializations: [] }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createClientProfileSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('createClientProfileSchema', () => {
  const valid = { name: 'Blessing Chikwanda' };

  it('accepts a minimal valid profile', () => {
    expect(createClientProfileSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a full valid profile', () => {
    const result = createClientProfileSchema.safeParse({
      name: 'Blessing Chikwanda',
      city: 'London',
      province: null,
      dateOfBirth: '1990-05-15',
      phone: '+447911123456',
      emergencyContact: {
        name: 'Tendai Chikwanda',
        relationship: 'Spouse',
        phone: '+447911654321',
        email: 'tendai@example.com',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing name', () => {
    expect(createClientProfileSchema.safeParse({}).success).toBe(false);
  });

  it('rejects empty name', () => {
    expect(createClientProfileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('rejects invalid dateOfBirth format', () => {
    expect(
      createClientProfileSchema.safeParse({ ...valid, dateOfBirth: '15/05/1990' }).success,
    ).toBe(false);
  });

  it('accepts dateOfBirth in YYYY-MM-DD format', () => {
    expect(
      createClientProfileSchema.safeParse({ ...valid, dateOfBirth: '1990-05-15' }).success,
    ).toBe(true);
  });

  it('rejects emergencyContact with missing required name', () => {
    expect(
      createClientProfileSchema.safeParse({
        ...valid,
        emergencyContact: { relationship: 'Spouse' },
      }).success,
    ).toBe(false);
  });

  it('accepts emergencyContact with only name and relationship', () => {
    expect(
      createClientProfileSchema.safeParse({
        ...valid,
        emergencyContact: { name: 'Tendai', relationship: 'Spouse' },
      }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateClientProfileSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('updateClientProfileSchema', () => {
  it('accepts an empty object (all fields optional)', () => {
    expect(updateClientProfileSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update with only city', () => {
    expect(updateClientProfileSchema.safeParse({ city: 'Harare' }).success).toBe(true);
  });

  it('still rejects empty name when provided', () => {
    expect(updateClientProfileSchema.safeParse({ name: '' }).success).toBe(false);
  });

  it('still rejects invalid dateOfBirth when provided', () => {
    expect(updateClientProfileSchema.safeParse({ dateOfBirth: 'not-a-date' }).success).toBe(false);
  });
});
