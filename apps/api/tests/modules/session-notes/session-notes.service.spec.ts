import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { NoteStatus, UserRole } from '@prisma/client';
import { SessionNotesService } from '../../../src/modules/session-notes/session-notes.service';
import { SESSION_NOTE_REPOSITORY } from '../../../src/modules/session-notes/session-notes.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';
import { EncryptionService } from '../../../src/modules/encryption/encryption.service';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const noteId = 'note-uuid-001';
const now = new Date();
const meta = { ip: '127.0.0.1', userAgent: 'test-agent' };

const mockNote = {
  id: noteId,
  therapistId,
  clientId,
  sessionDate: now,
  sessionType: 'individual',
  subjective: 'decrypted-subjective',
  objective: 'decrypted-objective',
  assessment: null,
  plan: null,
  status: NoteStatus.DRAFT,
  version: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const finalizedNote = { ...mockNote, status: NoteStatus.FINALIZED };

const makeRepo = () => ({
  findAll: vi
    .fn()
    .mockResolvedValue({ data: [mockNote], meta: { total: 1, page: 1, limit: 20, totalPages: 1 } }),
  findById: vi.fn().mockResolvedValue(mockNote),
  create: vi.fn().mockResolvedValue(mockNote),
  update: vi.fn().mockResolvedValue({ ...mockNote, version: 2 }),
  softDelete: vi.fn().mockResolvedValue(undefined),
  createVersion: vi.fn().mockResolvedValue({
    id: 'ver-001',
    sessionNoteId: noteId,
    version: 1,
    contentSnapshot: 'v1.snap',
    changedById: therapistId,
    createdAt: now,
  }),
  listVersions: vi.fn().mockResolvedValue([]),
});

const makeAuditService = () => ({ log: vi.fn().mockResolvedValue(undefined) });
const makeEncryptionService = () => ({
  encrypt: vi.fn((s: string) => `v1.${Buffer.from(s).toString('base64')}`),
  decrypt: vi.fn((s: string) => Buffer.from(s.slice(3), 'base64').toString('utf8')),
});

describe('SessionNotesService', () => {
  let service: SessionNotesService;
  let repo: ReturnType<typeof makeRepo>;
  let auditService: ReturnType<typeof makeAuditService>;
  let encryptionService: ReturnType<typeof makeEncryptionService>;

  beforeEach(async () => {
    repo = makeRepo();
    auditService = makeAuditService();
    encryptionService = makeEncryptionService();

    const module = await Test.createTestingModule({
      providers: [
        SessionNotesService,
        { provide: SESSION_NOTE_REPOSITORY, useValue: repo },
        { provide: AuditLogService, useValue: auditService },
        { provide: EncryptionService, useValue: encryptionService },
      ],
    }).compile();

    service = module.get(SessionNotesService);
  });

  // ── createNote ────────────────────────────────────────────────────────────────

  describe('createNote', () => {
    const dto = {
      clientId,
      sessionDate: now,
      sessionType: 'individual',
      subjective: 'Patient reports improvement.',
      objective: null,
      assessment: null,
      plan: null,
    };

    it('creates a draft session note', async () => {
      const result = await service.createNote(dto, therapistId, UserRole.THERAPIST, meta);
      expect(repo.create).toHaveBeenCalled();
      expect(result).toEqual(mockNote);
    });

    it('encrypts all provided SOAP fields', async () => {
      await service.createNote(dto, therapistId, UserRole.THERAPIST, meta);
      expect(encryptionService.encrypt).toHaveBeenCalled();
    });

    it('creates an audit log entry', async () => {
      await service.createNote(dto, therapistId, UserRole.THERAPIST, meta);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'session_note.create', actorId: therapistId }),
      );
    });

    it('throws ForbiddenException when CLIENT tries to create note', async () => {
      await expect(service.createNote(dto, clientId, UserRole.CLIENT, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('encrypts all SOAP fields when all are provided', async () => {
      const fullDto = {
        clientId,
        sessionDate: now,
        sessionType: 'individual',
        subjective: 'Patient reports improvement.',
        objective: 'Alert and oriented.',
        assessment: 'Moderate depression.',
        plan: 'Continue CBT.',
      };
      await service.createNote(fullDto, therapistId, UserRole.THERAPIST, meta);
      expect(encryptionService.encrypt).toHaveBeenCalledTimes(4);
    });
  });

  // ── updateNote ────────────────────────────────────────────────────────────────

  describe('updateNote', () => {
    const dto = { subjective: 'Updated content.' };

    it('updates a draft note and increments version', async () => {
      await service.updateNote(noteId, dto, therapistId, meta);
      expect(repo.update).toHaveBeenCalledWith(
        noteId,
        expect.objectContaining({ version: mockNote.version + 1 }),
      );
    });

    it('creates a version snapshot before updating', async () => {
      await service.updateNote(noteId, dto, therapistId, meta);
      expect(repo.createVersion).toHaveBeenCalledWith(
        expect.objectContaining({ version: mockNote.version }),
      );
    });

    it('encrypts the updated SOAP fields', async () => {
      await service.updateNote(noteId, dto, therapistId, meta);
      expect(encryptionService.encrypt).toHaveBeenCalled();
    });

    it('throws NotFoundException when note does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.updateNote(noteId, dto, therapistId, meta)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when therapist does not own the note', async () => {
      repo.findById.mockResolvedValueOnce({ ...mockNote, therapistId: 'other-therapist' });
      await expect(service.updateNote(noteId, dto, therapistId, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when note is already finalized', async () => {
      repo.findById.mockResolvedValueOnce(finalizedNote);
      await expect(service.updateNote(noteId, dto, therapistId, meta)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('encrypts all provided SOAP fields during update', async () => {
      const fullDto = {
        subjective: 'S updated.',
        objective: 'O updated.',
        assessment: 'A updated.',
        plan: 'P updated.',
      };
      await service.updateNote(noteId, fullDto, therapistId, meta);
      // snapshot + 4 SOAP fields = 5 encrypt calls
      expect(encryptionService.encrypt).toHaveBeenCalledTimes(5);
    });

    it('sets null SOAP fields to null without encrypting', async () => {
      await service.updateNote(noteId, { subjective: null }, therapistId, meta);
      const updateCall = repo.update.mock.calls[0][1] as Record<string, unknown>;
      expect(updateCall['subjective']).toBeNull();
    });
  });

  // ── finalizeNote ──────────────────────────────────────────────────────────────

  describe('finalizeNote', () => {
    it('sets status to FINALIZED', async () => {
      await service.finalizeNote(noteId, therapistId, meta);
      expect(repo.update).toHaveBeenCalledWith(
        noteId,
        expect.objectContaining({ status: NoteStatus.FINALIZED }),
      );
    });

    it('creates an audit log entry on finalize', async () => {
      await service.finalizeNote(noteId, therapistId, meta);
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'session_note.finalize' }),
      );
    });

    it('throws NotFoundException when note does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.finalizeNote(noteId, therapistId, meta)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when therapist does not own the note', async () => {
      repo.findById.mockResolvedValueOnce({ ...mockNote, therapistId: 'other-therapist' });
      await expect(service.finalizeNote(noteId, therapistId, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException when note is already finalized', async () => {
      repo.findById.mockResolvedValueOnce(finalizedNote);
      await expect(service.finalizeNote(noteId, therapistId, meta)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── getNote ───────────────────────────────────────────────────────────────────

  describe('getNote', () => {
    it('returns note to the owning therapist', async () => {
      const result = await service.getNote(noteId, therapistId, UserRole.THERAPIST);
      expect(result).toEqual(mockNote);
    });

    it('returns note to the associated client', async () => {
      const result = await service.getNote(noteId, clientId, UserRole.CLIENT);
      expect(result).toEqual(mockNote);
    });

    it('returns note to ADMIN', async () => {
      const result = await service.getNote(noteId, 'admin-id', UserRole.ADMIN);
      expect(result).toEqual(mockNote);
    });

    it('throws NotFoundException when note does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.getNote('nonexistent', therapistId, UserRole.THERAPIST)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when THERAPIST accesses another therapist note', async () => {
      repo.findById.mockResolvedValueOnce({ ...mockNote, therapistId: 'other-therapist' });
      await expect(service.getNote(noteId, therapistId, UserRole.THERAPIST)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws ForbiddenException when CLIENT accesses a note not about them', async () => {
      repo.findById.mockResolvedValueOnce({ ...mockNote, clientId: 'other-client' });
      await expect(service.getNote(noteId, clientId, UserRole.CLIENT)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── listNotes ─────────────────────────────────────────────────────────────────

  describe('listNotes', () => {
    it('scopes to own notes for THERAPIST', async () => {
      await service.listNotes({}, therapistId, UserRole.THERAPIST, { page: 1, limit: 20 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ therapistId }),
        expect.any(Object),
      );
    });

    it('scopes to own notes for CLIENT', async () => {
      await service.listNotes({}, clientId, UserRole.CLIENT, { page: 1, limit: 20 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ clientId }),
        expect.any(Object),
      );
    });
  });

  // ── getVersionHistory ─────────────────────────────────────────────────────────

  describe('getVersionHistory', () => {
    it('returns version list for authorized therapist', async () => {
      const result = await service.getVersionHistory(noteId, therapistId, UserRole.THERAPIST);
      expect(repo.listVersions).toHaveBeenCalledWith(noteId);
      expect(Array.isArray(result)).toBe(true);
    });

    it('throws NotFoundException when note does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(
        service.getVersionHistory(noteId, therapistId, UserRole.THERAPIST),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── deleteNote ────────────────────────────────────────────────────────────────

  describe('deleteNote', () => {
    it('soft-deletes a draft note owned by the therapist', async () => {
      await service.deleteNote(noteId, therapistId, meta);
      expect(repo.softDelete).toHaveBeenCalledWith(noteId);
    });

    it('throws BadRequestException when trying to delete a finalized note', async () => {
      repo.findById.mockResolvedValueOnce(finalizedNote);
      await expect(service.deleteNote(noteId, therapistId, meta)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ForbiddenException when therapist does not own the note', async () => {
      repo.findById.mockResolvedValueOnce({ ...mockNote, therapistId: 'other-therapist' });
      await expect(service.deleteNote(noteId, therapistId, meta)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws NotFoundException when note does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.deleteNote(noteId, therapistId, meta)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
