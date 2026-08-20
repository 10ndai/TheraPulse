import { z } from 'zod';

/**
 * Zod schema for all required environment variables.
 * Validated at startup via ConfigModule.forRoot({ validate }).
 * Rejects unknown values to prevent config drift.
 */
export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),

  PORT: z.coerce.number().int().min(1).max(65535).default(3001),

  // ── Database ────────────────────────────────────────────────────────────
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Auth ────────────────────────────────────────────────────────────────
  JWT_ACCESS_SECRET: z.string().min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  JWT_REFRESH_SECRET: z.string().min(32, 'JWT_REFRESH_SECRET must be at least 32 characters'),
  BCRYPT_COST_FACTOR: z.coerce
    .number()
    .int()
    .min(10, 'BCRYPT_COST_FACTOR must be >= 10')
    .max(14, 'BCRYPT_COST_FACTOR must be <= 14')
    .default(12),

  // ── Encryption ──────────────────────────────────────────────────────────
  // 32 bytes stored as 64 lowercase hex characters (AES-256-GCM key)
  ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-f]{64}$/, 'ENCRYPTION_KEY must be exactly 64 lowercase hex characters'),

  // ── App URLs ────────────────────────────────────────────────────────────
  API_URL: z.string().default('http://localhost:3001'),
  WEB_URL: z.string().default('http://localhost:3000'),

  // ── Rate limiting ───────────────────────────────────────────────────────
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  LOGIN_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().min(1000).default(900_000),
});

export type Env = z.infer<typeof envSchema>;
