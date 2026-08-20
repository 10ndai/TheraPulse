import { z } from 'zod';
import { WorksheetType, AssignmentStatus } from '../constants/enums';
import { worksheetFieldSchema } from './worksheet-form.schema';

const uuidSchema = z.string().uuid('Invalid UUID format');

// ─────────────────────────────────────────────────────────────────────────────
// Worksheet template schemas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Loose form schema used in create/update DTOs.
 * Allows empty fields for drafts; each defined field is validated against the meta-schema.
 */
const worksheetFormSchemaSchema = z.object({
  version: z.number().int().min(1, 'Schema version must be at least 1'),
  fields: z.array(worksheetFieldSchema).optional(),
  description: z.string().optional(),
});

const scoringRangeSchema = z.object({
  min: z.number().int(),
  max: z.number().int(),
  severity: z.string(),
});

const scoringConfigSchema = z
  .object({
    maxScore: z.number().int().min(0),
    ranges: z.array(scoringRangeSchema),
  })
  .passthrough();

const worksheetTemplateBaseSchema = z.object({
  title: z.string().min(1, 'Title cannot be empty'),
  type: z.enum(Object.values(WorksheetType) as [string, ...string[]], {
    error: 'Invalid worksheet type',
  }),
  formSchema: worksheetFormSchemaSchema,
  scoringConfig: scoringConfigSchema.optional(),
});

export const createWorksheetTemplateSchema = worksheetTemplateBaseSchema;

export const updateWorksheetTemplateSchema = worksheetTemplateBaseSchema.partial();

export type CreateWorksheetTemplateDto = z.infer<typeof createWorksheetTemplateSchema>;
export type UpdateWorksheetTemplateDto = z.infer<typeof updateWorksheetTemplateSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Worksheet assignment schemas
// ─────────────────────────────────────────────────────────────────────────────

export const createWorksheetAssignmentSchema = z.object({
  templateId: uuidSchema,
  clientId: uuidSchema,
  instructions: z.string().optional(),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO 8601 datetime' }).optional(),
});

export const updateWorksheetAssignmentSchema = z.object({
  instructions: z.string().optional(),
  dueDate: z.string().datetime({ message: 'dueDate must be a valid ISO 8601 datetime' }).optional(),
  status: z
    .enum(Object.values(AssignmentStatus) as [string, ...string[]], {
      error: 'Invalid assignment status',
    })
    .optional(),
});

export type CreateWorksheetAssignmentDto = z.infer<typeof createWorksheetAssignmentSchema>;
export type UpdateWorksheetAssignmentDto = z.infer<typeof updateWorksheetAssignmentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Worksheet submission schema
// ─────────────────────────────────────────────────────────────────────────────

export const createWorksheetSubmissionSchema = z.object({
  assignmentId: uuidSchema,
  // AES-256-GCM encrypted ciphertext of { fieldId: answer, ... }
  responses: z.string().min(1, 'Responses cannot be empty'),
});

export type CreateWorksheetSubmissionDto = z.infer<typeof createWorksheetSubmissionSchema>;
