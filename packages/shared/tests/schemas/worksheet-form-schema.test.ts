import { describe, it, expect } from 'vitest';
import {
  worksheetFieldSchema,
  strictFormSchemaSchema,
  FieldType,
} from '../../src/schemas/worksheet-form.schema';

const PHQ9_OPTIONS = [
  { value: 0, label: 'Not at all' },
  { value: 1, label: 'Several days' },
  { value: 2, label: 'More than half the days' },
  { value: 3, label: 'Nearly every day' },
];

// ─────────────────────────────────────────────────────────────────────────────
// FieldType constant
// ─────────────────────────────────────────────────────────────────────────────

describe('FieldType', () => {
  it('defines all expected field type values', () => {
    expect(FieldType.TEXT).toBe('text');
    expect(FieldType.TEXTAREA).toBe('textarea');
    expect(FieldType.NUMBER).toBe('number');
    expect(FieldType.RATING).toBe('rating');
    expect(FieldType.SELECT).toBe('select');
    expect(FieldType.MULTI_SELECT).toBe('multi_select');
    expect(FieldType.CHECKBOX).toBe('checkbox');
    expect(FieldType.LIKERT).toBe('likert');
    expect(FieldType.DATE).toBe('date');
    expect(FieldType.LABEL).toBe('label');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// worksheetFieldSchema — common base validation
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — base validation', () => {
  it('rejects field with missing id', () => {
    expect(worksheetFieldSchema.safeParse({ type: 'text', label: 'Name' }).success).toBe(false);
  });

  it('rejects field with empty id', () => {
    expect(worksheetFieldSchema.safeParse({ id: '', type: 'text', label: 'Name' }).success).toBe(
      false,
    );
  });

  it('rejects field with missing label', () => {
    expect(worksheetFieldSchema.safeParse({ id: 'q1', type: 'text' }).success).toBe(false);
  });

  it('rejects field with empty label', () => {
    expect(worksheetFieldSchema.safeParse({ id: 'q1', type: 'text', label: '' }).success).toBe(
      false,
    );
  });

  it('rejects unknown field type', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'slider', label: 'Unknown' }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// text field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — text', () => {
  it('validates a minimal text field', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'text', label: 'First name' }).success,
    ).toBe(true);
  });

  it('validates text field with all optional properties', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'text',
        label: 'Name',
        required: true,
        minLength: 2,
        maxLength: 100,
        placeholder: 'Enter name',
        helpText: 'Your full name',
      }).success,
    ).toBe(true);
  });

  it('defaults required to false', () => {
    const result = worksheetFieldSchema.safeParse({ id: 'q1', type: 'text', label: 'Name' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.required).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// textarea field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — textarea', () => {
  it('validates minimal textarea field', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'textarea', label: 'Notes' }).success,
    ).toBe(true);
  });

  it('defaults rows to 4', () => {
    const result = worksheetFieldSchema.safeParse({ id: 'q1', type: 'textarea', label: 'Notes' });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rows).toBe(4);
  });

  it('accepts custom rows value', () => {
    const result = worksheetFieldSchema.safeParse({
      id: 'q1',
      type: 'textarea',
      label: 'Notes',
      rows: 8,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.rows).toBe(8);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// number field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — number', () => {
  it('validates minimal number field', () => {
    expect(worksheetFieldSchema.safeParse({ id: 'q1', type: 'number', label: 'Age' }).success).toBe(
      true,
    );
  });

  it('validates number field with min and max', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'number', label: 'Age', min: 0, max: 120 })
        .success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// rating field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — rating', () => {
  it('validates minimal rating field', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'rating', label: 'Mood' }).success,
    ).toBe(true);
  });

  it('defaults min to 0 and max to 10', () => {
    const result = worksheetFieldSchema.safeParse({ id: 'q1', type: 'rating', label: 'Mood' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.min).toBe(0);
      expect(result.data.max).toBe(10);
    }
  });

  it('accepts custom scale (e.g. 1-5)', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'rating', label: 'Mood', min: 1, max: 5 })
        .success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// select field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — select', () => {
  const twoOptions = [
    { value: 'yes', label: 'Yes' },
    { value: 'no', label: 'No' },
  ];

  it('validates select field with at least 2 options', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'select',
        label: 'Choose',
        options: twoOptions,
      }).success,
    ).toBe(true);
  });

  it('rejects select field with fewer than 2 options', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'select',
        label: 'Choose',
        options: [{ value: 'yes', label: 'Yes' }],
      }).success,
    ).toBe(false);
  });

  it('rejects select field with no options', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'select', label: 'Choose' }).success,
    ).toBe(false);
  });

  it('accepts numeric option values', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'select',
        label: 'Score',
        options: [
          { value: 1, label: 'One' },
          { value: 2, label: 'Two' },
        ],
      }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// multi_select field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — multi_select', () => {
  const opts = [
    { value: 'sad', label: 'Sad' },
    { value: 'anxious', label: 'Anxious' },
    { value: 'happy', label: 'Happy' },
  ];

  it('validates multi_select field with options', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'multi_select',
        label: 'Emotions',
        options: opts,
      }).success,
    ).toBe(true);
  });

  it('accepts minSelections and maxSelections', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'multi_select',
        label: 'Emotions',
        options: opts,
        minSelections: 1,
        maxSelections: 3,
      }).success,
    ).toBe(true);
  });

  it('rejects fewer than 2 options', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'multi_select',
        label: 'Emotions',
        options: [{ value: 'sad', label: 'Sad' }],
      }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// checkbox field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — checkbox', () => {
  it('validates minimal checkbox field', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'checkbox', label: 'I agree' }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// likert field (PHQ-9, GAD-7)
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — likert', () => {
  it('validates likert field with PHQ-9 options', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'phq1',
        type: 'likert',
        label: 'Little interest or pleasure in doing things',
        options: PHQ9_OPTIONS,
      }).success,
    ).toBe(true);
  });

  it('accepts optional scoringKey', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'phq1',
        type: 'likert',
        label: 'Question 1',
        options: PHQ9_OPTIONS,
        scoringKey: 'phq1',
      }).success,
    ).toBe(true);
  });

  it('rejects likert field with fewer than 2 options', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'phq1',
        type: 'likert',
        label: 'Question',
        options: [{ value: 0, label: 'Not at all' }],
      }).success,
    ).toBe(false);
  });

  it('rejects likert field with no options', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'phq1', type: 'likert', label: 'Question' }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// date field
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — date', () => {
  it('validates minimal date field', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'q1', type: 'date', label: 'Date of event' }).success,
    ).toBe(true);
  });

  it('accepts minDate and maxDate', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'q1',
        type: 'date',
        label: 'Date',
        minDate: '2020-01-01',
        maxDate: '2030-12-31',
      }).success,
    ).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// label field (display-only)
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — label', () => {
  it('validates label field with content', () => {
    expect(
      worksheetFieldSchema.safeParse({
        id: 'l1',
        type: 'label',
        label: 'Section Header',
        content: 'Please answer all questions.',
      }).success,
    ).toBe(true);
  });

  it('rejects label field without content', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'l1', type: 'label', label: 'Header' }).success,
    ).toBe(false);
  });

  it('rejects label field with empty content', () => {
    expect(
      worksheetFieldSchema.safeParse({ id: 'l1', type: 'label', label: 'Header', content: '' })
        .success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// conditional logic
// ─────────────────────────────────────────────────────────────────────────────

describe('worksheetFieldSchema — conditional logic', () => {
  const baseField = { id: 'q2', type: 'text', label: 'If yes, explain' };

  it('validates field with show conditional logic', () => {
    expect(
      worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: {
          action: 'show',
          conditions: [{ fieldId: 'q1', operator: 'eq', value: 'yes' }],
        },
      }).success,
    ).toBe(true);
  });

  it('validates field with hide action', () => {
    expect(
      worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: {
          action: 'hide',
          conditions: [{ fieldId: 'q1', operator: 'ne', value: 'no' }],
        },
      }).success,
    ).toBe(true);
  });

  it('defaults logicalOperator to AND', () => {
    const result = worksheetFieldSchema.safeParse({
      ...baseField,
      conditionalLogic: {
        action: 'show',
        conditions: [{ fieldId: 'q1', operator: 'eq', value: 'yes' }],
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.conditionalLogic?.logicalOperator).toBe('AND');
    }
  });

  it('accepts OR logical operator with multiple conditions', () => {
    expect(
      worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: {
          action: 'show',
          logicalOperator: 'OR',
          conditions: [
            { fieldId: 'q1', operator: 'eq', value: 'yes' },
            { fieldId: 'q0', operator: 'gt', value: 5 },
          ],
        },
      }).success,
    ).toBe(true);
  });

  it('supports all comparison operators', () => {
    const operators = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in'];
    for (const operator of operators) {
      const result = worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: {
          action: 'show',
          conditions: [{ fieldId: 'q1', operator, value: 1 }],
        },
      });
      expect(result.success, `operator '${operator}' should be valid`).toBe(true);
    }
  });

  it('rejects invalid action', () => {
    expect(
      worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: {
          action: 'toggle',
          conditions: [{ fieldId: 'q1', operator: 'eq', value: 'yes' }],
        },
      }).success,
    ).toBe(false);
  });

  it('rejects invalid condition operator', () => {
    expect(
      worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: {
          action: 'show',
          conditions: [{ fieldId: 'q1', operator: 'contains', value: 'x' }],
        },
      }).success,
    ).toBe(false);
  });

  it('rejects empty conditions array', () => {
    expect(
      worksheetFieldSchema.safeParse({
        ...baseField,
        conditionalLogic: { action: 'show', conditions: [] },
      }).success,
    ).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// strictFormSchemaSchema
// ─────────────────────────────────────────────────────────────────────────────

describe('strictFormSchemaSchema', () => {
  it('validates form with at least one field', () => {
    expect(
      strictFormSchemaSchema.safeParse({
        version: 1,
        fields: [{ id: 'q1', type: 'text', label: 'Name' }],
      }).success,
    ).toBe(true);
  });

  it('rejects form with empty fields array', () => {
    expect(strictFormSchemaSchema.safeParse({ version: 1, fields: [] }).success).toBe(false);
  });

  it('requires version', () => {
    expect(
      strictFormSchemaSchema.safeParse({
        fields: [{ id: 'q1', type: 'text', label: 'Name' }],
      }).success,
    ).toBe(false);
  });

  it('rejects version < 1', () => {
    expect(
      strictFormSchemaSchema.safeParse({
        version: 0,
        fields: [{ id: 'q1', type: 'text', label: 'Name' }],
      }).success,
    ).toBe(false);
  });

  it('accepts optional description', () => {
    expect(
      strictFormSchemaSchema.safeParse({
        version: 1,
        description: 'PHQ-9 Depression Scale',
        fields: [{ id: 'q1', type: 'text', label: 'Name' }],
      }).success,
    ).toBe(true);
  });

  it('validates a realistic PHQ-9 form structure', () => {
    const phq9Fields = Array.from({ length: 9 }, (_, i) => ({
      id: `phq${i + 1}`,
      type: 'likert',
      label: `PHQ-9 Question ${i + 1}`,
      required: true,
      options: PHQ9_OPTIONS,
      scoringKey: `phq${i + 1}`,
    }));

    expect(
      strictFormSchemaSchema.safeParse({
        version: 1,
        description: 'PHQ-9 Patient Health Questionnaire',
        fields: phq9Fields,
      }).success,
    ).toBe(true);
  });

  it('validates a mixed-type form (mood tracking)', () => {
    expect(
      strictFormSchemaSchema.safeParse({
        version: 1,
        description: 'Daily Mood Tracking',
        fields: [
          { id: 'header', type: 'label', label: 'Today', content: 'Track your mood for today.' },
          { id: 'mood', type: 'rating', label: 'Overall mood', min: 1, max: 10, required: true },
          {
            id: 'emotions',
            type: 'multi_select',
            label: 'Emotions felt',
            options: [
              { value: 'happy', label: 'Happy' },
              { value: 'sad', label: 'Sad' },
              { value: 'anxious', label: 'Anxious' },
              { value: 'calm', label: 'Calm' },
            ],
          },
          { id: 'notes', type: 'textarea', label: 'Notes', rows: 5 },
        ],
      }).success,
    ).toBe(true);
  });
});
