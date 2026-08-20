/**
 * TP-058 — Backup configuration and recovery strategy tests
 *
 * Validates that the backup configuration schema enforces operational
 * requirements for the TheraPulse data recovery strategy:
 *   • Daily retention ≥ 7 days
 *   • Weekly retention ≥ 30 days
 *   • Encryption at rest by default
 *   • Recovery Point Objective (RPO) and retention window math
 */
import { describe, it, expect } from 'vitest';
import {
  backupConfigSchema,
  BACKUP_RETENTION,
  earliestRecoveryPoint,
  isWithinRetention,
  RECOVERY_TIME_OBJECTIVE_HOURS,
} from '../../../src/common/backup/backup-config';

const VALID_CONFIG = {
  dailyCron: '0 2 * * *',
  retainDailyDays: 30,
  retainWeeklyDays: 90,
  storageDestination: 's3://therapulse-backups/prod',
  encryptAtRest: true,
  monthlyRestoreTests: 1,
};

// ─── Schema validation ────────────────────────────────────────────────────────

describe('backupConfigSchema — validation', () => {
  it('accepts a fully valid config', () => {
    expect(backupConfigSchema.safeParse(VALID_CONFIG).success).toBe(true);
  });

  it('rejects missing dailyCron', () => {
    const { dailyCron: _, ...rest } = VALID_CONFIG;
    expect(backupConfigSchema.safeParse(rest).success).toBe(false);
  });

  it('rejects empty storageDestination', () => {
    expect(backupConfigSchema.safeParse({ ...VALID_CONFIG, storageDestination: '' }).success).toBe(
      false,
    );
  });

  it('rejects retainDailyDays below minimum (7)', () => {
    expect(backupConfigSchema.safeParse({ ...VALID_CONFIG, retainDailyDays: 6 }).success).toBe(
      false,
    );
  });

  it('accepts retainDailyDays exactly at minimum (7)', () => {
    expect(backupConfigSchema.safeParse({ ...VALID_CONFIG, retainDailyDays: 7 }).success).toBe(
      true,
    );
  });

  it('rejects retainWeeklyDays below minimum (30)', () => {
    expect(backupConfigSchema.safeParse({ ...VALID_CONFIG, retainWeeklyDays: 29 }).success).toBe(
      false,
    );
  });

  it('accepts retainWeeklyDays exactly at minimum (30)', () => {
    expect(backupConfigSchema.safeParse({ ...VALID_CONFIG, retainWeeklyDays: 30 }).success).toBe(
      true,
    );
  });

  it('rejects monthlyRestoreTests of 0', () => {
    expect(backupConfigSchema.safeParse({ ...VALID_CONFIG, monthlyRestoreTests: 0 }).success).toBe(
      false,
    );
  });

  it('defaults encryptAtRest to true when omitted', () => {
    const { encryptAtRest: _, ...rest } = VALID_CONFIG;
    const result = backupConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.encryptAtRest).toBe(true);
    }
  });

  it('defaults retainDailyDays to 30 when omitted', () => {
    const { retainDailyDays: _, ...rest } = VALID_CONFIG;
    const result = backupConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retainDailyDays).toBe(BACKUP_RETENTION.DAILY_DAYS);
    }
  });

  it('defaults retainWeeklyDays to 90 when omitted', () => {
    const { retainWeeklyDays: _, ...rest } = VALID_CONFIG;
    const result = backupConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.retainWeeklyDays).toBe(BACKUP_RETENTION.WEEKLY_DAYS);
    }
  });
});

// ─── Constants ────────────────────────────────────────────────────────────────

describe('BACKUP_RETENTION constants', () => {
  it('DAILY_DAYS is 30', () => {
    expect(BACKUP_RETENTION.DAILY_DAYS).toBe(30);
  });

  it('WEEKLY_DAYS is 90', () => {
    expect(BACKUP_RETENTION.WEEKLY_DAYS).toBe(90);
  });

  it('MIN_DAILY_DAYS is 7', () => {
    expect(BACKUP_RETENTION.MIN_DAILY_DAYS).toBe(7);
  });

  it('MIN_WEEKLY_DAYS is 30', () => {
    expect(BACKUP_RETENTION.MIN_WEEKLY_DAYS).toBe(30);
  });

  it('RTO is 1 hour', () => {
    expect(RECOVERY_TIME_OBJECTIVE_HOURS).toBe(1);
  });
});

// ─── Recovery window helpers ──────────────────────────────────────────────────

describe('earliestRecoveryPoint', () => {
  it('returns 30 days before now for 30-day retention', () => {
    const now = new Date('2026-04-04T00:00:00Z');
    const earliest = earliestRecoveryPoint(now, 30);
    expect(earliest).toEqual(new Date('2026-03-05T00:00:00Z'));
  });

  it('returns 7 days before now for 7-day retention', () => {
    const now = new Date('2026-04-04T00:00:00Z');
    const earliest = earliestRecoveryPoint(now, 7);
    expect(earliest).toEqual(new Date('2026-03-28T00:00:00Z'));
  });
});

describe('isWithinRetention', () => {
  const now = new Date('2026-04-04T00:00:00Z');

  it('returns true for a backup taken today', () => {
    expect(isWithinRetention(now, now, 30)).toBe(true);
  });

  it('returns true for a backup 29 days ago within 30-day window', () => {
    const backupDate = new Date('2026-03-06T00:00:00Z');
    expect(isWithinRetention(backupDate, now, 30)).toBe(true);
  });

  it('returns false for a backup 31 days ago outside 30-day window', () => {
    const backupDate = new Date('2026-03-04T00:00:00Z');
    expect(isWithinRetention(backupDate, now, 30)).toBe(false);
  });

  it('returns false for a backup from a year ago', () => {
    const backupDate = new Date('2025-04-04T00:00:00Z');
    expect(isWithinRetention(backupDate, now, 30)).toBe(false);
  });
});
