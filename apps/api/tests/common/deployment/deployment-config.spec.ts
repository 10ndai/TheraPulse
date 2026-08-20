/**
 * TP-061 — Deployment configuration and production readiness tests
 *
 * Validates deployment config schema enforces production safety requirements:
 *   • HTTPS enforced for production URLs
 *   • Connection pool bounds (min ≤ max, max ≤ HARD_MAX)
 *   • Health check path format
 *   • Environment enum
 */
import { describe, it, expect } from 'vitest';
import {
  deploymentConfigSchema,
  CONNECTION_POOL,
} from '../../../src/common/deployment/deployment-config';

const VALID_PROD_CONFIG = {
  environment: 'production' as const,
  apiUrl: 'https://api.therapulse.com',
  webUrl: 'https://app.therapulse.com',
  dbPoolMin: 2,
  dbPoolMax: 10,
  healthCheckPath: '/api/health',
  imageTag: 'v1.0.0',
};

const VALID_DEV_CONFIG = {
  environment: 'development' as const,
  apiUrl: 'http://localhost:3001',
  webUrl: 'http://localhost:3000',
  dbPoolMin: 2,
  dbPoolMax: 10,
  healthCheckPath: '/api/health',
  imageTag: 'dev-latest',
};

// ─── Schema validation — basic ────────────────────────────────────────────────

describe('deploymentConfigSchema — valid configs', () => {
  it('accepts a valid production config', () => {
    expect(deploymentConfigSchema.safeParse(VALID_PROD_CONFIG).success).toBe(true);
  });

  it('accepts a valid development config with HTTP URLs', () => {
    expect(deploymentConfigSchema.safeParse(VALID_DEV_CONFIG).success).toBe(true);
  });

  it('accepts staging environment', () => {
    expect(
      deploymentConfigSchema.safeParse({
        ...VALID_PROD_CONFIG,
        environment: 'staging',
      }).success,
    ).toBe(true);
  });
});

// ─── HTTPS enforcement ────────────────────────────────────────────────────────

describe('deploymentConfigSchema — HTTPS enforcement', () => {
  it('rejects production apiUrl with HTTP (not HTTPS)', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      apiUrl: 'http://api.therapulse.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects production webUrl with HTTP (not HTTPS)', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      webUrl: 'http://app.therapulse.com',
    });
    expect(result.success).toBe(false);
  });

  it('allows staging environment with HTTP URLs', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      environment: 'staging',
      apiUrl: 'http://staging-api.therapulse.com',
      webUrl: 'http://staging.therapulse.com',
    });
    expect(result.success).toBe(true);
  });
});

// ─── Connection pool validation ───────────────────────────────────────────────

describe('deploymentConfigSchema — connection pool', () => {
  it('rejects dbPoolMin greater than dbPoolMax', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      dbPoolMin: 15,
      dbPoolMax: 10,
    });
    expect(result.success).toBe(false);
  });

  it('accepts dbPoolMin equal to dbPoolMax', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      dbPoolMin: 5,
      dbPoolMax: 5,
    });
    expect(result.success).toBe(true);
  });

  it('rejects dbPoolMax exceeding HARD_MAX (50)', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      dbPoolMax: 51,
    });
    expect(result.success).toBe(false);
  });

  it('accepts dbPoolMax exactly at HARD_MAX (50)', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      dbPoolMax: 50,
    });
    expect(result.success).toBe(true);
  });

  it('rejects dbPoolMin of 0', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      dbPoolMin: 0,
    });
    expect(result.success).toBe(false);
  });
});

// ─── Health check path ────────────────────────────────────────────────────────

describe('deploymentConfigSchema — healthCheckPath', () => {
  it('rejects healthCheckPath without leading slash', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      healthCheckPath: 'api/health',
    });
    expect(result.success).toBe(false);
  });

  it('accepts custom health check path with leading slash', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      healthCheckPath: '/health',
    });
    expect(result.success).toBe(true);
  });
});

// ─── Other field validation ───────────────────────────────────────────────────

describe('deploymentConfigSchema — other fields', () => {
  it('rejects unknown environment value', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      environment: 'test',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty imageTag', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      imageTag: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid URL format for apiUrl', () => {
    const result = deploymentConfigSchema.safeParse({
      ...VALID_PROD_CONFIG,
      apiUrl: 'not-a-url',
    });
    expect(result.success).toBe(false);
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe('CONNECTION_POOL constants', () => {
  it('MIN_CONNECTIONS is 2', () => {
    expect(CONNECTION_POOL.MIN_CONNECTIONS).toBe(2);
  });

  it('MAX_CONNECTIONS is 10', () => {
    expect(CONNECTION_POOL.MAX_CONNECTIONS).toBe(10);
  });

  it('HARD_MAX is 50', () => {
    expect(CONNECTION_POOL.HARD_MAX).toBe(50);
  });

  it('MIN_CONNECTIONS < MAX_CONNECTIONS', () => {
    expect(CONNECTION_POOL.MIN_CONNECTIONS).toBeLessThan(CONNECTION_POOL.MAX_CONNECTIONS);
  });

  it('MAX_CONNECTIONS <= HARD_MAX', () => {
    expect(CONNECTION_POOL.MAX_CONNECTIONS).toBeLessThanOrEqual(CONNECTION_POOL.HARD_MAX);
  });

  it('IDLE_TIMEOUT_SECONDS is 30', () => {
    expect(CONNECTION_POOL.IDLE_TIMEOUT_SECONDS).toBe(30);
  });
});
