import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { SessionNote, SessionNoteVersion } from '@prisma/client';
import { NoteStatus } from '@prisma/client';
import { SessionNotesRepository } from '../../../src/modules/session-notes/session-notes.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const now = new Date();
const noteId = 'note-uuid-001';
const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const changedById = therapistId;

const mockNote: SessionNote = {
  id: noteId,
  therapistId,
  clientId,
  sessionDate: now,
  sessionType: 'individual',
  subjective: 'v1.encrypted-subjective',
  objective: 'v1.encrypted-objective',
  assessment: 'v1.encrypted-assessment',
  plan: 'v1.encrypted-plan',
  status: NoteStatus.DRAFT,
  version: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const mockVersion: SessionNoteVersion = {
  id: 'ver-uuid-001',
  sessionNoteId: noteId,
  version: 1,
  contentSnapshot: 'v1.encrypted-snapshot',
  changedById,
  createdAt: now,
};

describe('SessionNotesRepository', () => {
  let repo: SessionNotesRepository;
  let prisma: {
    sessionNote: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
    };
    sessionNoteVersion: {
      create: ReturnType<typeof vi.fn>;
      findMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      sessionNote: {
        findMany: vi.fn().mockResolvedValue([mockNote]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(mockNote),
        create: vi.fn().mockResolvedValue(mockNote),
        update: vi.fn().mockResolvedValue({ ...mockNote, version: 2 }),
      },
      sessionNoteVersion: {
        create: vi.fn().mockResolvedValue(mockVersion),
        findMany: vi.fn().mockResolvedValue([mockVersion]),
      },
    };

    const module = await Test.createTestingModule({
      providers: [SessionNotesRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repo = module.get(SessionNotesRepository);
  });

  it('findAll returns paginated notes excluding deleted', async () => {
    const result = await repo.findAll({ therapistId }, { page: 1, limit: 20 });
    expect(prisma.sessionNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('findAll filters by clientId when provided', async () => {
    await repo.findAll({ therapistId, clientId }, { page: 1, limit: 20 });
    expect(prisma.sessionNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ clientId }) }),
    );
  });

  it('findAll filters by status when provided', async () => {
    await repo.findAll({ therapistId, status: 'FINALIZED' }, { page: 1, limit: 20 });
    expect(prisma.sessionNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'FINALIZED' }) }),
    );
  });

  it('findAll works with no filters (ADMIN use case)', async () => {
    await repo.findAll({}, { page: 1, limit: 20 });
    expect(prisma.sessionNote.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ deletedAt: null }) }),
    );
  });

  it('findAll uses default page and limit when not provided', async () => {
    await repo.findAll(
      { therapistId },
      { page: undefined as unknown as number, limit: undefined as unknown as number },
    );
    expect(prisma.sessionNote.findMany).toHaveBeenCalled();
  });

  it('findById returns a note by id', async () => {
    const result = await repo.findById(noteId);
    expect(result).toEqual(mockNote);
  });

  it('findById returns null when not found', async () => {
    prisma.sessionNote.findUnique.mockResolvedValueOnce(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  it('create saves a new session note', async () => {
    const data = {
      therapist: { connect: { id: therapistId } },
      client: { connect: { id: clientId } },
      sessionDate: now,
      sessionType: 'individual',
      subjective: 'v1.encrypted',
    };
    const result = await repo.create(data);
    expect(prisma.sessionNote.create).toHaveBeenCalled();
    expect(result).toEqual(mockNote);
  });

  it('update patches the note fields', async () => {
    const result = await repo.update(noteId, { version: 2 });
    expect(prisma.sessionNote.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: noteId }, data: { version: 2 } }),
    );
    expect(result.version).toBe(2);
  });

  it('softDelete sets deletedAt', async () => {
    await repo.softDelete(noteId);
    expect(prisma.sessionNote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: noteId },
        data: expect.objectContaining({ deletedAt: expect.any(Date) }),
      }),
    );
  });

  it('createVersion saves a new version snapshot', async () => {
    const data = {
      sessionNote: { connect: { id: noteId } },
      version: 1,
      contentSnapshot: 'v1.encrypted-snapshot',
      changedBy: { connect: { id: changedById } },
    };
    const result = await repo.createVersion(data);
    expect(prisma.sessionNoteVersion.create).toHaveBeenCalled();
    expect(result).toEqual(mockVersion);
  });

  it('listVersions returns versions for a note in descending order', async () => {
    const result = await repo.listVersions(noteId);
    expect(prisma.sessionNoteVersion.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sessionNoteId: noteId } }),
    );
    expect(result).toHaveLength(1);
  });
});
