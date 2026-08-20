import { describe, it, expect } from 'vitest';
import {
  createWorksheetTemplateSchema,
  updateWorksheetTemplateSchema,
  createWorksheetAssignmentSchema,
  updateWorksheetAssignmentSchema,
  createWorksheetSubmissionSchema,
} from '../../src/schemas/worksheet.schema';
import { WorksheetType, AssignmentStatus } from '../../src/constants/enums';

const VALID_UUID = '123e4567-e89b-12d3-a456-426614174000';

// ─────────────────────────────────────────────────────────────────────────────
// createWorksheetTemplateSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('createWorksheetTemplateSchema', () => {
  const valid = {
    title: 'PHQ-9 Assessment',
    type: WorksheetType.PHQ9,
    formSchema: { version: 1, fields: [] },
  };

  it('accepts a minimal valid template', () => {
    expect(createWorksheetTemplateSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a full template with scoringConfig', () => {
    const result = createWorksheetTemplateSchema.safeParse({
      ...valid,
      scoringConfig: {
        maxScore: 27,
        ranges: [{ min: 0, max: 4, severity: 'minimal' }],
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing title', () => {
    const { title: _title, ...rest } = valid;
    expect(createWorksheetTemplateSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty title', () => {
    expect(createWorksheetTemplateSchema.safeParse({ ...valid, title: '' }).success).toBe(false);
  });

  it('rejects invalid type', () => {
    expect(
      createWorksheetTemplateSchema.safeParse({ ...valid, type: 'UNKNOWN_TYPE' }).success,
    ).toBe(false);
  });

  it('accepts all WorksheetType enum values', () => {
    for (const type of Object.values(WorksheetType)) {
      expect(createWorksheetTemplateSchema.safeParse({ ...valid, type }).success).toBe(true);
    }
  });

  it('rejects formSchema missing version field', () => {
    expect(
      createWorksheetTemplateSchema.safeParse({ ...valid, formSchema: { fields: [] } }).success,
    ).toBe(false);
  });

  it('rejects formSchema with version < 1', () => {
    expect(
      createWorksheetTemplateSchema.safeParse({
        ...valid,
        formSchema: { version: 0, fields: [] },
      }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateWorksheetTemplateSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('updateWorksheetTemplateSchema', () => {
  it('accepts an empty object', () => {
    expect(updateWorksheetTemplateSchema.safeParse({}).success).toBe(true);
  });

  it('accepts partial update with only title', () => {
    expect(updateWorksheetTemplateSchema.safeParse({ title: 'New Title' }).success).toBe(true);
  });

  it('still rejects empty title when provided', () => {
    expect(updateWorksheetTemplateSchema.safeParse({ title: '' }).success).toBe(false);
  });

  it('still rejects invalid type when provided', () => {
    expect(updateWorksheetTemplateSchema.safeParse({ type: 'BOGUS' }).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createWorksheetAssignmentSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('createWorksheetAssignmentSchema', () => {
  const valid = {
    templateId: VALID_UUID,
    clientId: VALID_UUID,
  };

  it('accepts a minimal valid assignment', () => {
    expect(createWorksheetAssignmentSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts assignment with optional fields', () => {
    const result = createWorksheetAssignmentSchema.safeParse({
      ...valid,
      instructions: 'Complete this before our next session.',
      dueDate: '2026-04-01T10:00:00.000Z',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing templateId', () => {
    const { templateId: _t, ...rest } = valid;
    expect(createWorksheetAssignmentSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects missing clientId', () => {
    const { clientId: _c, ...rest } = valid;
    expect(createWorksheetAssignmentSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects non-UUID templateId', () => {
    expect(
      createWorksheetAssignmentSchema.safeParse({ ...valid, templateId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects non-UUID clientId', () => {
    expect(
      createWorksheetAssignmentSchema.safeParse({ ...valid, clientId: 'not-a-uuid' }).success,
    ).toBe(false);
  });

  it('rejects invalid dueDate format', () => {
    expect(
      createWorksheetAssignmentSchema.safeParse({ ...valid, dueDate: 'tomorrow' }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// updateWorksheetAssignmentSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('updateWorksheetAssignmentSchema', () => {
  it('accepts an empty object', () => {
    expect(updateWorksheetAssignmentSchema.safeParse({}).success).toBe(true);
  });

  it('accepts status update to COMPLETED', () => {
    expect(
      updateWorksheetAssignmentSchema.safeParse({ status: AssignmentStatus.COMPLETED }).success,
    ).toBe(true);
  });

  it('rejects invalid status value', () => {
    expect(updateWorksheetAssignmentSchema.safeParse({ status: 'FINISHED' }).success).toBe(false);
  });

  it('accepts instructions-only update', () => {
    expect(
      updateWorksheetAssignmentSchema.safeParse({ instructions: 'Updated instructions.' }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// createWorksheetSubmissionSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('createWorksheetSubmissionSchema', () => {
  it('accepts valid submission', () => {
    expect(
      createWorksheetSubmissionSchema.safeParse({
        assignmentId: VALID_UUID,
        responses: 'encrypted-ciphertext-payload',
      }).success,
    ).toBe(true);
  });

  it('rejects missing assignmentId', () => {
    expect(createWorksheetSubmissionSchema.safeParse({ responses: 'payload' }).success).toBe(false);
  });

  it('rejects non-UUID assignmentId', () => {
    expect(
      createWorksheetSubmissionSchema.safeParse({
        assignmentId: 'not-a-uuid',
        responses: 'payload',
      }).success,
    ).toBe(false);
  });

  it('rejects empty responses string', () => {
    expect(
      createWorksheetSubmissionSchema.safeParse({
        assignmentId: VALID_UUID,
        responses: '',
      }).success,
    ).toBe(false);
  });
});
