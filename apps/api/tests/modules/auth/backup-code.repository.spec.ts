import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BackupCodeRepository } from '../../../src/modules/auth/backup-code.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const NOW = new Date('2026-01-01T00:00:00.000Z');

const mockCode = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  userId: '00000000-0000-0000-0000-000000000001',
  codeHash: '$2b$12$backuphash',
  usedAt: null,
  createdAt: NOW,
};

describe('BackupCodeRepository', () => {
  let repo: BackupCodeRepository;
  let mockPrisma: {
    totpBackupCode: {
      createMany: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      deleteMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma = {
      totpBackupCode: {
        createMany: vi.fn(),
        findMany: vi.fn(),
        update: vi.fn(),
        deleteMany: vi.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [BackupCodeRepository, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    repo = module.get<BackupCodeRepository>(BackupCodeRepository);
  });

  // ── createMany() ──────────────────────────────────────────────────────────

  describe('createMany()', () => {
    it('bulk-inserts backup code hashes for the user', async () => {
      mockPrisma.totpBackupCode.createMany.mockResolvedValue({ count: 8 });

      await repo.createMany(mockCode.userId, ['$2b$12$hash1', '$2b$12$hash2']);

      expect(mockPrisma.totpBackupCode.createMany).toHaveBeenCalledWith({
        data: [
          { userId: mockCode.userId, codeHash: '$2b$12$hash1' },
          { userId: mockCode.userId, codeHash: '$2b$12$hash2' },
        ],
      });
    });
  });

  // ── findUnusedByUser() ────────────────────────────────────────────────────

  describe('findUnusedByUser()', () => {
    it('returns all unused backup codes for the user', async () => {
      mockPrisma.totpBackupCode.findMany.mockResolvedValue([mockCode]);

      const result = await repo.findUnusedByUser(mockCode.userId);

      expect(result).toEqual([mockCode]);
      expect(mockPrisma.totpBackupCode.findMany).toHaveBeenCalledWith({
        where: { userId: mockCode.userId, usedAt: null },
      });
    });

    it('returns empty array when no unused codes exist', async () => {
      mockPrisma.totpBackupCode.findMany.mockResolvedValue([]);

      const result = await repo.findUnusedByUser(mockCode.userId);

      expect(result).toEqual([]);
    });
  });

  // ── markUsed() ────────────────────────────────────────────────────────────

  describe('markUsed()', () => {
    it('sets usedAt on the specified backup code', async () => {
      const usedCode = { ...mockCode, usedAt: new Date() };
      mockPrisma.totpBackupCode.update.mockResolvedValue(usedCode);

      const result = await repo.markUsed(mockCode.id);

      expect(result.usedAt).not.toBeNull();
      expect(mockPrisma.totpBackupCode.update).toHaveBeenCalledWith({
        where: { id: mockCode.id },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  // ── deleteAllForUser() ────────────────────────────────────────────────────

  describe('deleteAllForUser()', () => {
    it('removes all backup codes for the user (called on TOTP re-enable)', async () => {
      mockPrisma.totpBackupCode.deleteMany.mockResolvedValue({ count: 8 });

      await repo.deleteAllForUser(mockCode.userId);

      expect(mockPrisma.totpBackupCode.deleteMany).toHaveBeenCalledWith({
        where: { userId: mockCode.userId },
      });
    });
  });
});
