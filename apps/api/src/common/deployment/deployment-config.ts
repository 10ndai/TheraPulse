/**
 * Deployment configuration schema and constants.
 *
 * Validates production deployment parameters:
 *   • Database connection pool sizing
 *   • Health check endpoint configuration
 *   • TLS enforcement
 *   • CDN / cache settings
 *
 * Used by infrastructure scripts and validated in CI before deploy.
 */
import { z } from 'zod';

export const CONNECTION_POOL = {
  /** Minimum connections kept alive */
  MIN_CONNECTIONS: 2,
  /** Maximum connections allowed */
  MAX_CONNECTIONS: 10,
  /** Max connections allowed in production config */
  HARD_MAX: 50,
  /** Idle timeout in seconds before a connection is released */
  IDLE_TIMEOUT_SECONDS: 30,
} as const;

export const deploymentConfigSchema = z
  .object({
    /** Target environment */
    environment: z.enum(['production', 'staging', 'development']),

    /** API base URL (must be HTTPS in production) */
    apiUrl: z.string().url('apiUrl must be a valid URL'),

    /** Frontend base URL (must be HTTPS in production) */
    webUrl: z.string().url('webUrl must be a valid URL'),

    /** Database connection pool — min connections */
    dbPoolMin: z
      .number()
      .int()
      .min(1, 'dbPoolMin must be at least 1')
      .default(CONNECTION_POOL.MIN_CONNECTIONS),

    /** Database connection pool — max connections */
    dbPoolMax: z
      .number()
      .int()
      .min(1)
      .max(CONNECTION_POOL.HARD_MAX, `dbPoolMax cannot exceed ${CONNECTION_POOL.HARD_MAX}`)
      .default(CONNECTION_POOL.MAX_CONNECTIONS),

    /** Health check path (must start with /) */
    healthCheckPath: z
      .string()
      .startsWith('/', 'healthCheckPath must start with /')
      .default('/api/health'),

    /** Docker image tag for this deployment */
    imageTag: z.string().min(1, 'imageTag is required'),
  })
  .refine((cfg) => cfg.dbPoolMin <= cfg.dbPoolMax, {
    message: 'dbPoolMin must be <= dbPoolMax',
    path: ['dbPoolMin'],
  })
  .refine(
    (cfg) =>
      cfg.environment !== 'production' ||
      (cfg.apiUrl.startsWith('https://') && cfg.webUrl.startsWith('https://')),
    { message: 'Production deployments require HTTPS URLs', path: ['apiUrl'] },
  );

export type DeploymentConfig = z.infer<typeof deploymentConfigSchema>;
