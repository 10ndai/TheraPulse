import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { WorksheetType } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { WorksheetTemplateRepository } from '../../../src/modules/worksheets/worksheet-templates.repository';

const mockTemplate = {
  id: '10000000-0000-0000-0000-000000000001',
  title: 'PHQ-9',
  type: WorksheetType.PHQ9,
  formSchema: { version: 1, fields: [] },
  scoringConfig: null,
  isSystem: true,
  createdById: null,
  isPublished: true,
  version: 1,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  worksheetTemplate: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('WorksheetTemplateRepository', () => {
  let repo: WorksheetTemplateRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: mockPrisma }, WorksheetTemplateRepository],
    }).compile();

    repo = module.get<WorksheetTemplateRepository>(WorksheetTemplateRepository);
  });

  // ── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns template when found', async () => {
      mockPrisma.worksheetTemplate.findUnique.mockResolvedValue(mockTemplate);
      const result = await repo.findById(mockTemplate.id);
      expect(result).toEqual(mockTemplate);
    });

    it('returns null when not found', async () => {
      mockPrisma.worksheetTemplate.findUnique.mockResolvedValue(null);
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  // ── findAll() ─────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated results', async () => {
      mockPrisma.worksheetTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.worksheetTemplate.count.mockResolvedValue(1);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockTemplate]);
      expect(result.meta).toMatchObject({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('calculates totalPages correctly', async () => {
      mockPrisma.worksheetTemplate.findMany.mockResolvedValue([]);
      mockPrisma.worksheetTemplate.count.mockResolvedValue(45);

      const result = await repo.findAll({ page: 2, limit: 20 });

      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns the new template', async () => {
      const input = {
        title: 'Custom Template',
        type: WorksheetType.CUSTOM,
        formSchema: { version: 1, fields: [] },
        isSystem: false,
        isPublished: false,
        version: 1,
      };
      mockPrisma.worksheetTemplate.create.mockResolvedValue({ ...mockTemplate, ...input });

      const result = await repo.create(input as Parameters<typeof repo.create>[0]);

      expect(mockPrisma.worksheetTemplate.create).toHaveBeenCalledWith({ data: input });
      expect(result.title).toBe('Custom Template');
    });
  });

  // ── update() ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the template', async () => {
      const updated = { ...mockTemplate, title: 'Updated' };
      mockPrisma.worksheetTemplate.update.mockResolvedValue(updated);

      const result = await repo.update(mockTemplate.id, { title: 'Updated' });

      expect(mockPrisma.worksheetTemplate.update).toHaveBeenCalledWith({
        where: { id: mockTemplate.id },
        data: { title: 'Updated' },
      });
      expect(result.title).toBe('Updated');
    });

    it('throws NotFoundException when template not found', async () => {
      const error = new Error('Record not found') as Error & { code?: string };
      error.code = 'P2025';
      mockPrisma.worksheetTemplate.update.mockRejectedValue(error);

      await expect(repo.update('nonexistent', { title: 'New' })).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete() ──────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('hard-deletes the template', async () => {
      mockPrisma.worksheetTemplate.delete.mockResolvedValue(mockTemplate);

      await repo.softDelete(mockTemplate.id);

      expect(mockPrisma.worksheetTemplate.delete).toHaveBeenCalledWith({
        where: { id: mockTemplate.id },
      });
    });

    it('throws NotFoundException when template not found', async () => {
      const error = new Error('Record not found') as Error & { code?: string };
      error.code = 'P2025';
      mockPrisma.worksheetTemplate.delete.mockRejectedValue(error);

      await expect(repo.softDelete('nonexistent')).rejects.toThrow(NotFoundException);
    });
  });

  // ── findByFilters() ───────────────────────────────────────────────────────

  describe('findByFilters()', () => {
    it('returns all templates for ADMIN (no filter on published/owner)', async () => {
      mockPrisma.worksheetTemplate.findMany.mockResolvedValue([mockTemplate]);
      mockPrisma.worksheetTemplate.count.mockResolvedValue(1);

      await repo.findByFilters({ actorRole: 'ADMIN' }, { page: 1, limit: 20 });

      const callArg = mockPrisma.worksheetTemplate.findMany.mock.calls[0][0] as { where?: object };
      expect(callArg.where).not.toHaveProperty('isPublished');
    });

    it('filters by type when provided', async () => {
      mockPrisma.worksheetTemplate.findMany.mockResolvedValue([]);
      mockPrisma.worksheetTemplate.count.mockResolvedValue(0);

      await repo.findByFilters(
        { type: WorksheetType.PHQ9, actorRole: 'ADMIN' },
        { page: 1, limit: 20 },
      );

      const callArg = mockPrisma.worksheetTemplate.findMany.mock.calls[0][0] as {
        where?: { type?: string };
      };
      expect(callArg.where?.type).toBe(WorksheetType.PHQ9);
    });

    it('restricts CLIENT to published templates only', async () => {
      mockPrisma.worksheetTemplate.findMany.mockResolvedValue([]);
      mockPrisma.worksheetTemplate.count.mockResolvedValue(0);

      await repo.findByFilters({ actorRole: 'CLIENT' }, { page: 1, limit: 20 });

      const callArg = mockPrisma.worksheetTemplate.findMany.mock.calls[0][0] as {
        where?: { isPublished?: boolean };
      };
      expect(callArg.where?.isPublished).toBe(true);
    });

    it('restricts THERAPIST to own + published templates', async () => {
      const therapistId = 'therapist-uuid-001';
      mockPrisma.worksheetTemplate.findMany.mockResolvedValue([]);
      mockPrisma.worksheetTemplate.count.mockResolvedValue(0);

      await repo.findByFilters(
        { actorRole: 'THERAPIST', actorId: therapistId },
        { page: 1, limit: 20 },
      );

      const callArg = mockPrisma.worksheetTemplate.findMany.mock.calls[0][0] as {
        where?: { OR?: unknown[] };
      };
      expect(callArg.where?.OR).toBeDefined();
    });
  });
});
