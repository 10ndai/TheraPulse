import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AssignmentStatus } from '@prisma/client';
import { WorksheetAssignmentsRepository } from '../../../src/modules/worksheets/worksheet-assignments.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const assignmentId = 'assignment-uuid-001';
const templateId = 'template-uuid-001';

const mockAssignment = {
  id: assignmentId,
  templateId,
  therapistId,
  clientId,
  status: AssignmentStatus.PENDING,
  instructions: null,
  dueDate: null,
  deletedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const makePrisma = () => ({
  worksheetAssignment: {
    findMany: vi.fn().mockResolvedValue([mockAssignment]),
    findFirst: vi.fn().mockResolvedValue(mockAssignment),
    create: vi.fn().mockResolvedValue(mockAssignment),
    update: vi.fn().mockResolvedValue(mockAssignment),
    count: vi.fn().mockResolvedValue(1),
  },
});

describe('WorksheetAssignmentsRepository', () => {
  let repo: WorksheetAssignmentsRepository;
  let prisma: ReturnType<typeof makePrisma>;

  beforeEach(async () => {
    prisma = makePrisma();
    const module = await Test.createTestingModule({
      providers: [WorksheetAssignmentsRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();
    repo = module.get(WorksheetAssignmentsRepository);
  });

  describe('findAll', () => {
    it('returns paginated results excluding soft-deleted', async () => {
      const result = await repo.findAll({ page: 1, limit: 20 });
      expect(result.data).toEqual([mockAssignment]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(prisma.worksheetAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { deletedAt: null } }),
      );
    });
  });

  describe('findByFilters (ADMIN)', () => {
    it('returns paginated results without actor filter', async () => {
      const result = await repo.findByFilters({ actorRole: 'ADMIN' }, { page: 1, limit: 20 });
      expect(result.data).toEqual([mockAssignment]);
      expect(result.meta.total).toBe(1);
      expect(prisma.worksheetAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });
  });

  describe('findByFilters (THERAPIST)', () => {
    it('filters by therapistId', async () => {
      await repo.findByFilters(
        { actorRole: 'THERAPIST', actorId: therapistId },
        { page: 1, limit: 20 },
      );
      expect(prisma.worksheetAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ therapistId, deletedAt: null }),
        }),
      );
    });
  });

  describe('findByFilters (CLIENT)', () => {
    it('filters by clientId', async () => {
      await repo.findByFilters({ actorRole: 'CLIENT', actorId: clientId }, { page: 1, limit: 20 });
      expect(prisma.worksheetAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ clientId, deletedAt: null }),
        }),
      );
    });

    it('filters by status when provided', async () => {
      await repo.findByFilters(
        { actorRole: 'CLIENT', actorId: clientId, status: AssignmentStatus.PENDING },
        { page: 1, limit: 20 },
      );
      expect(prisma.worksheetAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: AssignmentStatus.PENDING }),
        }),
      );
    });
  });

  describe('findByFilters (unknown role)', () => {
    it('returns all non-deleted records when role is unrecognized', async () => {
      await repo.findByFilters({ actorRole: 'UNKNOWN_ROLE' }, { page: 1, limit: 20 });
      expect(prisma.worksheetAssignment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
      );
    });
  });

  describe('findById', () => {
    it('returns assignment by id (excluding soft-deleted)', async () => {
      const result = await repo.findById(assignmentId);
      expect(result).toEqual(mockAssignment);
      expect(prisma.worksheetAssignment.findFirst).toHaveBeenCalledWith({
        where: { id: assignmentId, deletedAt: null },
      });
    });

    it('returns null when not found', async () => {
      prisma.worksheetAssignment.findFirst.mockResolvedValue(null);
      const result = await repo.findById('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('create', () => {
    it('creates an assignment with provided data', async () => {
      const data = {
        template: { connect: { id: templateId } },
        therapist: { connect: { id: therapistId } },
        client: { connect: { id: clientId } },
      };
      const result = await repo.create(data as never);
      expect(result).toEqual(mockAssignment);
      expect(prisma.worksheetAssignment.create).toHaveBeenCalledWith({ data });
    });
  });

  describe('update', () => {
    it('updates assignment by id', async () => {
      const updated = { ...mockAssignment, status: AssignmentStatus.IN_PROGRESS };
      prisma.worksheetAssignment.update.mockResolvedValue(updated);
      const result = await repo.update(assignmentId, { status: AssignmentStatus.IN_PROGRESS });
      expect(result).toEqual(updated);
      expect(prisma.worksheetAssignment.update).toHaveBeenCalledWith({
        where: { id: assignmentId },
        data: { status: AssignmentStatus.IN_PROGRESS },
      });
    });
  });

  describe('softDelete', () => {
    it('sets deletedAt on the record', async () => {
      await repo.softDelete(assignmentId);
      expect(prisma.worksheetAssignment.update).toHaveBeenCalledWith({
        where: { id: assignmentId },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
