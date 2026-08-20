import { z } from 'zod';

const uuidSchema = z.string().uuid('Invalid UUID format');

const isoDatetimeSchema = z
  .string()
  .datetime({ message: 'sessionDate must be a valid ISO 8601 datetime' });

const nonEmptyStringSchema = z.string().min(1, 'This field cannot be empty');

// ─────────────────────────────────────────────────────────────────────────────
// Session note schemas
// ─────────────────────────────────────────────────────────────────────────────

export const createSessionNoteSchema = z.object({
  clientId: uuidSchema,
  sessionDate: isoDatetimeSchema,
  // Free-form string — new session types require no migration (validated by Zod, not DB enum)
  sessionType: nonEmptyStringSchema,
  // Encrypted at persistence layer (TP-010) — optional on draft creation
  subjective: z.string().optional(),
  objective: z.string().optional(),
  assessment: z.string().optional(),
  plan: z.string().optional(),
});

// On update, SOAP fields can be set to null to clear them (draft editing)
export const updateSessionNoteSchema = z.object({
  sessionDate: isoDatetimeSchema.optional(),
  sessionType: nonEmptyStringSchema.optional(),
  subjective: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  assessment: z.string().nullable().optional(),
  plan: z.string().nullable().optional(),
});

export type CreateSessionNoteDto = z.infer<typeof createSessionNoteSchema>;
export type UpdateSessionNoteDto = z.infer<typeof updateSessionNoteSchema>;
