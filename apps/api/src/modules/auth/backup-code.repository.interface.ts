import type { TotpBackupCode } from '@prisma/client';

export const BACKUP_CODE_REPOSITORY = Symbol('IBackupCodeRepository');

export interface IBackupCodeRepository {
  createMany(userId: string, codeHashes: string[]): Promise<void>;
  findUnusedByUser(userId: string): Promise<TotpBackupCode[]>;
  markUsed(id: string): Promise<TotpBackupCode>;
  deleteAllForUser(userId: string): Promise<void>;
}
