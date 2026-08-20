import { z } from 'zod';
import { UserRole } from '../constants/roles';

const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character');

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  role: z.enum([UserRole.ADMIN, UserRole.THERAPIST, UserRole.CLIENT]),
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// TOTP 2FA schemas
// ─────────────────────────────────────────────────────────────────────────────

export const totpTokenSchema = z.object({
  // TOTP codes are exactly 6 decimal digits (RFC 6238)
  token: z.string().regex(/^\d{6}$/, 'TOTP code must be exactly 6 digits'),
});

export const totpBackupCodeSchema = z.object({
  // Single-use backup codes: 8 alphanumeric characters
  code: z
    .string()
    .regex(/^[A-Za-z0-9]{8}$/, 'Backup code must be exactly 8 alphanumeric characters'),
});

export type TotpTokenDto = z.infer<typeof totpTokenSchema>;
export type TotpBackupCodeDto = z.infer<typeof totpBackupCodeSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Token refresh schema
// ─────────────────────────────────────────────────────────────────────────────

export const refreshTokenRequestSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export type RefreshTokenRequestDto = z.infer<typeof refreshTokenRequestSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Public registration schema (frontend-only: includes confirmPassword, no ADMIN)
// ─────────────────────────────────────────────────────────────────────────────

export const publicRegisterSchema = z
  .object({
    email: z.string().email('Invalid email address'),
    password: passwordSchema,
    confirmPassword: z.string().min(1, 'Please confirm your password'),
    role: z.enum([UserRole.THERAPIST, UserRole.CLIENT], {
      error: () => ({ message: 'Please select a role' }),
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

export type PublicRegisterDto = z.infer<typeof publicRegisterSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// 2FA verify schema (frontend form: userId from URL + 6-digit token)
// ─────────────────────────────────────────────────────────────────────────────

export const twoFactorVerifySchema = z.object({
  userId: z.string().uuid('Invalid user ID'),
  token: z.string().regex(/^\d{6}$/, 'TOTP code must be exactly 6 digits'),
});

export type TwoFactorVerifyDto = z.infer<typeof twoFactorVerifySchema>;
