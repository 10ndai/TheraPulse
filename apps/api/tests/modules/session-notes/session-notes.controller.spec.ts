import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { Request } from 'express';
import { NoteStatus, UserRole } from '@prisma/client';
import { SessionNotesController } from '../../../src/modules/session-notes/session-notes.controller';
import { SessionNotesService } from '../../../src/modules/session-notes/session-notes.service';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const noteId = 'note-uuid-001';
const now = new Date();

const mockUser = { sub: therapistId, role: UserRole.THERAPIST };

const mockNote = {
  id: noteId,
  therapistId,
  clientId,
  sessionDate: now,
  sessionType: 'individual',
  subjective: 'decrypted-subjective',
  objective: null,
  assessment: null,
  plan: null,
  status: NoteStatus.DRAFT,
  version: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const makeService = () => ({
  createNote: vi.fn().mockResolvedValue(mockNote),
  updateNote: vi.fn().mockResolvedValue({ ...mockNote, version: 2 }),
  finalizeNote: vi.fn().mockResolvedValue({ ...mockNote, status: NoteStatus.FINALIZED }),
  getNote: vi.fn().mockResolvedValue(mockNote),
  listNotes: vi.fn().mockResolvedValue({
    data: [mockNote],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  getVersionHistory: vi.fn().mockResolvedValue([]),
  deleteNote: vi.fn().mockResolvedValue(undefined),
});

function makeReq(
  overrides: Partial<typeof mockUser> = {},
): Partial<Request> & { user: typeof mockUser } {
  return { user: { ...mockUser, ...overrides }, ip: '127.0.0.1', get: vi.fn(() => 'test-agent') };
}

describe('SessionNotesController', () => {
  let controller: SessionNotesController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [SessionNotesController],
      providers: [{ provide: SessionNotesService, useValue: service }],
    }).compile();

    controller = module.get(SessionNotesController);
  });

  // ── POST /session-notes ────────────────────────────────────────────────────

  describe('POST /session-notes', () => {
    const dto = {
      clientId,
      sessionDate: now,
      sessionType: 'individual',
      subjective: 'Patient report.',
    };

    it('creates a session note and returns success envelope', async () => {
      const result = await controller.create(
        dto,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.createNote).toHaveBeenCalledWith(
        dto,
        therapistId,
        UserRole.THERAPIST,
        expect.any(Object),
      );
      expect(result).toEqual({ success: true, data: mockNote });
    });
  });

  // ── GET /session-notes ─────────────────────────────────────────────────────

  describe('GET /session-notes', () => {
    it('returns paginated list in success envelope', async () => {
      const result = await controller.list(
        { page: 1, limit: 20 },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listNotes).toHaveBeenCalledWith(
        expect.any(Object),
        therapistId,
        UserRole.THERAPIST,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
    });

    it('defaults page and limit when not provided', async () => {
      await controller.list({}, makeReq() as unknown as Request & { user: typeof mockUser });
      expect(service.listNotes).toHaveBeenCalledWith(
        expect.any(Object),
        therapistId,
        UserRole.THERAPIST,
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });

    it('passes clientId filter when provided', async () => {
      await controller.list(
        { clientId },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listNotes).toHaveBeenCalledWith(
        expect.objectContaining({ clientId }),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });

    it('passes status filter when provided', async () => {
      await controller.list(
        { status: 'DRAFT' },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listNotes).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'DRAFT' }),
        expect.any(String),
        expect.any(String),
        expect.any(Object),
      );
    });
  });

  // ── GET /session-notes/:id ─────────────────────────────────────────────────

  describe('GET /session-notes/:id', () => {
    it('returns single note in success envelope', async () => {
      const result = await controller.findOne(
        noteId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.getNote).toHaveBeenCalledWith(noteId, therapistId, UserRole.THERAPIST);
      expect(result).toEqual({ success: true, data: mockNote });
    });
  });

  // ── PATCH /session-notes/:id ───────────────────────────────────────────────

  describe('PATCH /session-notes/:id', () => {
    it('updates note and returns success envelope', async () => {
      const dto = { subjective: 'Updated.' };
      const result = await controller.update(
        noteId,
        dto,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.updateNote).toHaveBeenCalledWith(noteId, dto, therapistId, expect.any(Object));
      expect(result.data.version).toBe(2);
    });
  });

  // ── POST /session-notes/:id/finalize ──────────────────────────────────────

  describe('POST /session-notes/:id/finalize', () => {
    it('finalizes note and returns success envelope', async () => {
      const result = await controller.finalize(
        noteId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.finalizeNote).toHaveBeenCalledWith(noteId, therapistId, expect.any(Object));
      expect(result.data.status).toBe(NoteStatus.FINALIZED);
    });
  });

  // ── GET /session-notes/:id/versions ───────────────────────────────────────

  describe('GET /session-notes/:id/versions', () => {
    it('returns version history in success envelope', async () => {
      const result = await controller.versions(
        noteId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.getVersionHistory).toHaveBeenCalledWith(
        noteId,
        therapistId,
        UserRole.THERAPIST,
      );
      expect(result).toEqual({ success: true, data: [] });
    });
  });

  // ── DELETE /session-notes/:id ──────────────────────────────────────────────

  describe('DELETE /session-notes/:id', () => {
    it('soft-deletes note and returns success', async () => {
      const result = await controller.remove(
        noteId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.deleteNote).toHaveBeenCalledWith(noteId, therapistId, expect.any(Object));
      expect(result).toEqual({ success: true });
    });
  });

  // ── extractMeta fallbacks ──────────────────────────────────────────────────

  it('falls back to "unknown" when ip and user-agent are missing', async () => {
    const req = {
      user: mockUser,
      ip: undefined,
      get: vi.fn(() => undefined),
    } as unknown as Request & { user: typeof mockUser };
    const dto = { clientId, sessionDate: now, sessionType: 'individual' };
    await controller.create(dto, req);
    expect(service.createNote).toHaveBeenCalledWith(dto, therapistId, UserRole.THERAPIST, {
      ip: 'unknown',
      userAgent: 'unknown',
    });
  });
});
