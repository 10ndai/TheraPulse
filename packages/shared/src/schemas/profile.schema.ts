import { z } from 'zod';

// ─────────────────────────────────────────────────────────────────────────────
// Shared primitives
// ─────────────────────────────────────────────────────────────────────────────

// ISO-8601 date string (YYYY-MM-DD) — used for dateOfBirth
const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

const nonEmptyStringSchema = z.string().min(1, 'This field cannot be empty');

// ─────────────────────────────────────────────────────────────────────────────
// Therapist profile schemas
// ─────────────────────────────────────────────────────────────────────────────

const therapistProfileBaseSchema = z.object({
  name: nonEmptyStringSchema,
  bio: z.string().optional(),
  specializations: z.array(z.string()).min(1, 'At least one specialization is required'),
  qualifications: z.array(z.string()),
  licenseNumber: z.string().optional(),
  languages: z.array(z.string()).min(1, 'At least one language is required'),
  city: z.string().optional(),
  province: z.string().optional(),
  // Raw phone value — will be AES-256-GCM encrypted before persistence (TP-010)
  phone: z.string().optional(),
});

export const createTherapistProfileSchema = therapistProfileBaseSchema;

export const updateTherapistProfileSchema = therapistProfileBaseSchema.partial();

export type CreateTherapistProfileDto = z.infer<typeof createTherapistProfileSchema>;
export type UpdateTherapistProfileDto = z.infer<typeof updateTherapistProfileSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Client profile schemas
// ─────────────────────────────────────────────────────────────────────────────

const emergencyContactSchema = z.object({
  name: nonEmptyStringSchema,
  relationship: nonEmptyStringSchema,
  phone: z.string().optional(),
  email: z.string().email().optional(),
});

const clientProfileBaseSchema = z.object({
  name: nonEmptyStringSchema,
  city: z.string().nullish(),
  province: z.string().nullish(),
  // Raw values — will be AES-256-GCM encrypted before persistence (TP-010)
  dateOfBirth: isoDateSchema.optional(),
  phone: z.string().optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

export const createClientProfileSchema = clientProfileBaseSchema;

export const updateClientProfileSchema = z.object({
  name: nonEmptyStringSchema.optional(),
  city: z.string().nullish(),
  province: z.string().nullish(),
  dateOfBirth: isoDateSchema.optional(),
  phone: z.string().optional(),
  emergencyContact: emergencyContactSchema.optional(),
});

export type CreateClientProfileDto = z.infer<typeof createClientProfileSchema>;
export type UpdateClientProfileDto = z.infer<typeof updateClientProfileSchema>;
