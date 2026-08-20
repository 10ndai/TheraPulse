import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { WorksheetSubmission } from '@prisma/client';
import { WorksheetSubmissionsRepository } from '../../../src/modules/worksheets/worksheet-submissions.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const now = new Date();
const subId = 'sub-uuid-001';
const assignmentId = 'assign-uuid-001';
const clientId = 'client-uuid-001';

const mockSubmission: WorksheetSubmission = {
  id: subId,
  assignmentId,
  clientId,
  responses: 'v1.encrypted-responses',
  score: null,
  finalizedAt: null,
  integrityHash: 'hash-abc',
  createdAt: now,
};

describe('WorksheetSubmissionsRepository', () => {
  let repo: WorksheetSubmissionsRepository;
  let prisma: {
    worksheetSubmission: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      worksheetSubmission: {
        findMany: vi.fn().mockResolvedValue([mockSubmission]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(mockSubmission),
        create: vi.fn().mockResolvedValue(mockSubmission),
        update: vi.fn().mockResolvedValue({ ...mockSubmission, responses: 'v1.updated' }),
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };

    const module = await Test.createTestingModule({
      providers: [WorksheetSubmissionsRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repo = module.get(WorksheetSubmissionsRepository);
  });

  it('findAll returns paginated submissions', async () => {
    const result = await repo.findAll({}, { page: 1, limit: 20 });
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
    expect(prisma.worksheetSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('findAll applies clientId filter', async () => {
    await repo.findAll({ clientId }, { page: 1, limit: 20 });
    expect(prisma.worksheetSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientId }) }),
    );
  });

  it('findAll applies assignmentId filter', async () => {
    await repo.findAll({ assignmentId }, { page: 1, limit: 20 });
    expect(prisma.worksheetSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ assignmentId }) }),
    );
  });

  it('findAll applies finalized=true filter', async () => {
    await repo.findAll({ finalized: true }, { page: 1, limit: 20 });
    expect(prisma.worksheetSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ finalizedAt: { not: null } }) }),
    );
  });

  it('findAll applies finalized=false filter', async () => {
    await repo.findAll({ finalized: false }, { page: 1, limit: 20 });
    expect(prisma.worksheetSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ finalizedAt: null }) }),
    );
  });

  it('findAll uses default page=1 and limit=20 when options omitted', async () => {
    await repo.findAll({});
    expect(prisma.worksheetSubmission.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 0, take: 20 }),
    );
  });

  it('findById returns a single submission by id', async () => {
    const result = await repo.findById(subId);
    expect(result).toEqual(mockSubmission);
    expect(prisma.worksheetSubmission.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: subId } }),
    );
  });

  it('findById returns null when not found', async () => {
    prisma.worksheetSubmission.findUnique.mockResolvedValueOnce(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  it('create persists a new submission', async () => {
    const data = {
      assignment: { connect: { id: assignmentId } },
      client: { connect: { id: clientId } },
      responses: 'v1.encrypted',
      integrityHash: 'hash-123',
    };
    const result = await repo.create(data);
    expect(result).toEqual(mockSubmission);
    expect(prisma.worksheetSubmission.create).toHaveBeenCalledWith({ data });
  });

  it('update patches an existing submission', async () => {
    const result = await repo.update(subId, { responses: 'v1.updated' });
    expect(result.responses).toBe('v1.updated');
    expect(prisma.worksheetSubmission.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: subId } }),
    );
  });

  it('softDelete is a no-op (submissions are immutable, no soft delete)', async () => {
    await expect(repo.softDelete(subId)).resolves.not.toThrow();
  });

  it('findDraftByAssignment returns null when no draft exists', async () => {
    const result = await repo.findDraftByAssignment(assignmentId);
    expect(result).toBeNull();
    expect(prisma.worksheetSubmission.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ assignmentId, finalizedAt: null }),
      }),
    );
  });

  it('findDraftByAssignment returns existing draft', async () => {
    prisma.worksheetSubmission.findFirst.mockResolvedValueOnce(mockSubmission);
    const result = await repo.findDraftByAssignment(assignmentId);
    expect(result).toEqual(mockSubmission);
  });
});
