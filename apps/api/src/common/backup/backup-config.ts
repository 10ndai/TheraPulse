/**
 * Backup configuration schema and constants.
 *
 * TheraPulse uses a layered backup strategy:
 *   1. Continuous WAL archiving (PostgreSQL point-in-time recovery)
 *   2. Daily pg_dump snapshots, retained for 30 days
 *   3. Weekly snapshots retained for 90 days
 *   4. Encrypted backups at rest (same AES-256-GCM key as field encryption)
 *
 * This module provides the config schema and helpers used by backup scripts.
 * All values are validated before any backup operation starts.
 */
import { z } from 'zod';

export const BACKUP_RETENTION = {
  DAILY_DAYS: 30,
  WEEKLY_DAYS: 90,
  MIN_DAILY_DAYS: 7,
  MIN_WEEKLY_DAYS: 30,
} as const;

export const backupConfigSchema = z.object({
  /** Cron expression for daily snapshot schedule */
  dailyCron: z
    .string()
    .min(1, 'dailyCron is required')
    .refine((v) => /^[\d\s,/*-]+$/.test(v), 'dailyCron must be a valid cron expression'),

  /** Number of days to retain daily snapshots */
  retainDailyDays: z
    .number()
    .int()
    .min(
      BACKUP_RETENTION.MIN_DAILY_DAYS,
      `Daily retention must be at least ${BACKUP_RETENTION.MIN_DAILY_DAYS} days`,
    )
    .default(BACKUP_RETENTION.DAILY_DAYS),

  /** Number of days to retain weekly snapshots */
  retainWeeklyDays: z
    .number()
    .int()
    .min(
      BACKUP_RETENTION.MIN_WEEKLY_DAYS,
      `Weekly retention must be at least ${BACKUP_RETENTION.MIN_WEEKLY_DAYS} days`,
    )
    .default(BACKUP_RETENTION.WEEKLY_DAYS),

  /** Storage bucket / path where backups are written */
  storageDestination: z.string().min(1, 'storageDestination is required'),

  /** Whether backups are encrypted at rest */
  encryptAtRest: z.boolean().default(true),

  /** Number of restore tests to require per month (operational SLA) */
  monthlyRestoreTests: z
    .number()
    .int()
    .min(1, 'At least one restore test per month is required')
    .default(1),
});

export type BackupConfig = z.infer<typeof backupConfigSchema>;

/**
 * Calculates the earliest safe recovery point given a retention window.
 * Used to assert that RPO (Recovery Point Objective) is met.
 */
export function earliestRecoveryPoint(now: Date, retainDailyDays: number): Date {
  const ms = retainDailyDays * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms);
}

/**
 * Returns true if the given backup timestamp is within the retention window.
 */
export function isWithinRetention(backupDate: Date, now: Date, retainDays: number): boolean {
  return backupDate >= earliestRecoveryPoint(now, retainDays);
}

/**
 * Returns the expected RTO (Recovery Time Objective) label for the strategy.
 * For pg_dump + WAL replay, target RTO is < 1 hour.
 */
export const RECOVERY_TIME_OBJECTIVE_HOURS = 1 as const;
