import { Injectable } from '@nestjs/common';
import type { TotpBackupCode } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { IBackupCodeRepository } from './backup-code.repository.interface';

@Injectable()
export class BackupCodeRepository implements IBackupCodeRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createMany(userId: string, codeHashes: string[]): Promise<void> {
    await this.prisma.totpBackupCode.createMany({
      data: codeHashes.map((codeHash) => ({ userId, codeHash })),
    });
  }

  async findUnusedByUser(userId: string): Promise<TotpBackupCode[]> {
    return this.prisma.totpBackupCode.findMany({
      where: { userId, usedAt: null },
    });
  }

  async markUsed(id: string): Promise<TotpBackupCode> {
    return this.prisma.totpBackupCode.update({
      where: { id },
      data: { usedAt: new Date() },
    });
  }

  async deleteAllForUser(userId: string): Promise<void> {
    await this.prisma.totpBackupCode.deleteMany({
      where: { userId },
    });
  }
}
