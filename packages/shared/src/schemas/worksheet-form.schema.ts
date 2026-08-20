import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Field type constant
// ─────────────────────────────────────────────────────────────────────────────

export const FieldType = {
  TEXT: 'text',
  TEXTAREA: 'textarea',
  NUMBER: 'number',
  RATING: 'rating',
  SELECT: 'select',
  MULTI_SELECT: 'multi_select',
  CHECKBOX: 'checkbox',
  LIKERT: 'likert',
  DATE: 'date',
  LABEL: 'label',
} as const;

export type FieldTypeValue = (typeof FieldType)[keyof typeof FieldType];

// ─────────────────────────────────────────────────────────────────────────────
// Option type (used by select, multi_select, likert)
// ─────────────────────────────────────────────────────────────────────────────

const fieldOptionSchema = z.object({
  value: z.union([z.string(), z.number()]),
  label: z.string().min(1, 'Option label cannot be empty'),
});

export type FieldOption = z.infer<typeof fieldOptionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Conditional logic
// ─────────────────────────────────────────────────────────────────────────────

const conditionOperatorSchema = z.enum(['eq', 'ne', 'gt', 'lt', 'gte', 'lte', 'in', 'not_in']);

const fieldConditionSchema = z.object({
  fieldId: z.string().min(1, 'Condition fieldId cannot be empty'),
  operator: conditionOperatorSchema,
  value: z.unknown(),
});

const conditionalLogicSchema = z.object({
  action: z.enum(['show', 'hide']),
  conditions: z.array(fieldConditionSchema).min(1, 'At least one condition is required'),
  logicalOperator: z.enum(['AND', 'OR']).default('AND'),
});

export type ConditionalLogic = z.infer<typeof conditionalLogicSchema>;
export type FieldCondition = z.infer<typeof fieldConditionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Shared base field properties
// ─────────────────────────────────────────────────────────────────────────────

const baseFieldProps = {
  id: z.string().min(1, 'Field ID cannot be empty'),
  label: z.string().min(1, 'Field label cannot be empty'),
  helpText: z.string().optional(),
  required: z.boolean().default(false),
  conditionalLogic: conditionalLogicSchema.optional(),
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Field type schemas (discriminated union)
// ─────────────────────────────────────────────────────────────────────────────

const textFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('text'),
  placeholder: z.string().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
});

const textareaFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('textarea'),
  placeholder: z.string().optional(),
  minLength: z.number().int().min(0).optional(),
  maxLength: z.number().int().min(1).optional(),
  rows: z.number().int().min(1).default(4),
});

const numberFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('number'),
  min: z.number().optional(),
  max: z.number().optional(),
  step: z.number().positive().optional(),
});

const ratingFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('rating'),
  min: z.number().int().default(0),
  max: z.number().int().min(1).default(10),
});

const selectFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('select'),
  options: z.array(fieldOptionSchema).min(2, 'Select field must have at least 2 options'),
});

const multiSelectFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('multi_select'),
  options: z.array(fieldOptionSchema).min(2, 'Multi-select field must have at least 2 options'),
  minSelections: z.number().int().min(0).optional(),
  maxSelections: z.number().int().min(1).optional(),
});

const checkboxFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('checkbox'),
});

const likertFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('likert'),
  options: z.array(fieldOptionSchema).min(2, 'Likert field must have at least 2 options'),
  /** Optional key for scoring engine to reference this field (e.g. 'phq1'). */
  scoringKey: z.string().optional(),
});

const dateFieldSchema = z.object({
  ...baseFieldProps,
  type: z.literal('date'),
  minDate: z.string().optional(),
  maxDate: z.string().optional(),
});

/** Display-only field — no input, no `required` semantics. */
const labelFieldSchema = z.object({
  id: z.string().min(1, 'Field ID cannot be empty'),
  type: z.literal('label'),
  label: z.string().min(1, 'Field label cannot be empty'),
  content: z.string().min(1, 'Label content cannot be empty'),
  helpText: z.string().optional(),
  conditionalLogic: conditionalLogicSchema.optional(),
});

// ─────────────────────────────────────────────────────────────────────────────
// Discriminated union of all field types
// ─────────────────────────────────────────────────────────────────────────────

export const worksheetFieldSchema = z.discriminatedUnion('type', [
  textFieldSchema,
  textareaFieldSchema,
  numberFieldSchema,
  ratingFieldSchema,
  selectFieldSchema,
  multiSelectFieldSchema,
  checkboxFieldSchema,
  likertFieldSchema,
  dateFieldSchema,
  labelFieldSchema,
]);

export type WorksheetField = z.infer<typeof worksheetFieldSchema>;
export type TextField = z.infer<typeof textFieldSchema>;
export type TextareaField = z.infer<typeof textareaFieldSchema>;
export type NumberField = z.infer<typeof numberFieldSchema>;
export type RatingField = z.infer<typeof ratingFieldSchema>;
export type SelectField = z.infer<typeof selectFieldSchema>;
export type MultiSelectField = z.infer<typeof multiSelectFieldSchema>;
export type CheckboxField = z.infer<typeof checkboxFieldSchema>;
export type LikertField = z.infer<typeof likertFieldSchema>;
export type DateField = z.infer<typeof dateFieldSchema>;
export type LabelField = z.infer<typeof labelFieldSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Form schema
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Strict form schema — used for validation at publish time.
 * Requires at least one field and validates each field against the meta-schema.
 */
export const strictFormSchemaSchema = z.object({
  version: z.number().int().min(1, 'Schema version must be at least 1'),
  fields: z.array(worksheetFieldSchema).min(1, 'Form must have at least one field'),
  description: z.string().optional(),
});

export type StrictFormSchema = z.infer<typeof strictFormSchemaSchema>;

/**
 * Loose form schema — used in create/update DTOs.
 * Allows empty fields array for draft templates.
 */
export const looseFormSchemaSchema = z.object({
  version: z.number().int().min(1, 'Schema version must be at least 1'),
  fields: z.array(worksheetFieldSchema).optional(),
  description: z.string().optional(),
});

export type LooseFormSchema = z.infer<typeof looseFormSchemaSchema>;
