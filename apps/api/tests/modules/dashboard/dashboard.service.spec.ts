import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole, AssignmentStatus, NoteStatus } from '@prisma/client';
import { DashboardService } from '../../../src/modules/dashboard/dashboard.service';
import { WORKSHEET_ASSIGNMENT_REPOSITORY } from '../../../src/modules/worksheets/worksheet-assignments.repository.interface';
import { WORKSHEET_SUBMISSION_REPOSITORY } from '../../../src/modules/worksheets/worksheet-submissions.repository.interface';
import { SESSION_NOTE_REPOSITORY } from '../../../src/modules/session-notes/session-notes.repository.interface';
import { USER_REPOSITORY } from '../../../src/modules/users/users.repository.interface';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';
const now = new Date();

const makePaginated = <T>(data: T[], total = data.length) => ({
  data,
  meta: { total, page: 1, limit: 1, totalPages: total },
});

const mockAssignment = {
  id: 'assign-001',
  therapistId,
  clientId,
  templateId: 'tpl-001',
  status: AssignmentStatus.COMPLETED,
  dueDate: null,
  assignedAt: now,
  updatedAt: now,
};

const mockSubmission = {
  id: 'sub-001',
  assignmentId: 'assign-001',
  clientId,
  responses: '{}',
  finalizedAt: now,
  integrityHash: 'hash',
  score: { totalScore: 15, severity: 'moderate' },
  createdAt: now,
  updatedAt: now,
};

const mockNote = {
  id: 'note-001',
  therapistId,
  clientId,
  sessionDate: now,
  sessionType: 'individual',
  subjective: null,
  objective: null,
  assessment: null,
  plan: null,
  status: NoteStatus.FINALIZED,
  version: 1,
  createdAt: now,
  updatedAt: now,
  deletedAt: null,
};

const makeRepos = () => ({
  assignmentRepo: {
    findByFilters: vi.fn().mockResolvedValue(makePaginated([mockAssignment], 10)),
  },
  submissionRepo: {
    findAll: vi.fn().mockResolvedValue(makePaginated([mockSubmission], 5)),
  },
  noteRepo: {
    findAll: vi.fn().mockResolvedValue(makePaginated([mockNote], 3)),
  },
  userRepo: {
    findAll: vi.fn().mockResolvedValue(makePaginated([], 8)),
  },
});

describe('DashboardService', () => {
  let service: DashboardService;
  let repos: ReturnType<typeof makeRepos>;

  beforeEach(async () => {
    repos = makeRepos();
    const module = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: WORKSHEET_ASSIGNMENT_REPOSITORY, useValue: repos.assignmentRepo },
        { provide: WORKSHEET_SUBMISSION_REPOSITORY, useValue: repos.submissionRepo },
        { provide: SESSION_NOTE_REPOSITORY, useValue: repos.noteRepo },
        { provide: USER_REPOSITORY, useValue: repos.userRepo },
      ],
    }).compile();

    service = module.get(DashboardService);
  });

  // ── getTherapistStats() ───────────────────────────────────────────────────

  describe('getTherapistStats()', () => {
    it('returns totalAssignments from assignment repo meta.total', async () => {
      const stats = await service.getTherapistStats(therapistId);
      expect(stats.totalAssignments).toBe(10);
    });

    it('returns completedAssignments from assignment repo with COMPLETED filter', async () => {
      repos.assignmentRepo.findByFilters
        .mockResolvedValueOnce(makePaginated([mockAssignment], 10)) // all
        .mockResolvedValueOnce(makePaginated([mockAssignment], 4)); // completed
      const stats = await service.getTherapistStats(therapistId);
      expect(stats.completedAssignments).toBe(4);
    });

    it('returns totalNotes from session note repo meta.total', async () => {
      const stats = await service.getTherapistStats(therapistId);
      expect(stats.totalNotes).toBe(3);
    });

    it('queries assignments scoped to therapistId with THERAPIST role', async () => {
      await service.getTherapistStats(therapistId);
      expect(repos.assignmentRepo.findByFilters).toHaveBeenCalledWith(
        expect.objectContaining({ actorId: therapistId, actorRole: UserRole.THERAPIST }),
        expect.any(Object),
      );
    });

    it('queries notes scoped to therapistId', async () => {
      await service.getTherapistStats(therapistId);
      expect(repos.noteRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ therapistId }),
        expect.any(Object),
      );
    });
  });

  // ── getClientProgress() ──────────────────────────────────────────────────

  describe('getClientProgress()', () => {
    it('returns totalAssignments and completedSubmissions', async () => {
      const progress = await service.getClientProgress(clientId);
      expect(progress.totalAssignments).toBe(10);
      expect(progress.completedSubmissions).toBe(5);
    });

    it('calculates completion rate as a percentage', async () => {
      repos.assignmentRepo.findByFilters.mockResolvedValue(makePaginated([], 4));
      repos.submissionRepo.findAll.mockResolvedValue(makePaginated([mockSubmission], 2));
      const progress = await service.getClientProgress(clientId);
      expect(progress.completionRate).toBe(50);
    });

    it('returns 0 completion rate when no assignments exist', async () => {
      repos.assignmentRepo.findByFilters.mockResolvedValue(makePaginated([], 0));
      repos.submissionRepo.findAll.mockResolvedValue(makePaginated([], 0));
      const progress = await service.getClientProgress(clientId);
      expect(progress.completionRate).toBe(0);
    });

    it('returns scoreTrend from finalized submissions with scores', async () => {
      const subWithScore = {
        ...mockSubmission,
        score: { totalScore: 20, severity: 'severe' },
        createdAt: now,
      };
      repos.submissionRepo.findAll.mockResolvedValue({
        data: [subWithScore],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      const progress = await service.getClientProgress(clientId);
      expect(progress.scoreTrend).toHaveLength(1);
      expect(progress.scoreTrend[0].score).toBe(20);
    });

    it('returns empty scoreTrend when submissions have no scores', async () => {
      const subNoScore = { ...mockSubmission, score: null };
      repos.submissionRepo.findAll.mockResolvedValue({
        data: [subNoScore],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
      const progress = await service.getClientProgress(clientId);
      expect(progress.scoreTrend).toHaveLength(0);
    });

    it('queries submissions scoped to clientId and finalized', async () => {
      await service.getClientProgress(clientId);
      expect(repos.submissionRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ clientId, finalized: true }),
        expect.any(Object),
      );
    });
  });

  // ── getAdminStats() ──────────────────────────────────────────────────────

  describe('getAdminStats()', () => {
    it('returns totalTherapists and totalClients from user repo', async () => {
      repos.userRepo.findAll
        .mockResolvedValueOnce(makePaginated([], 12)) // therapists
        .mockResolvedValueOnce(makePaginated([], 45)); // clients
      const stats = await service.getAdminStats();
      expect(stats.totalTherapists).toBe(12);
      expect(stats.totalClients).toBe(45);
    });

    it('returns totalSubmissions and totalNotes', async () => {
      const stats = await service.getAdminStats();
      expect(stats.totalSubmissions).toBe(5);
      expect(stats.totalNotes).toBe(3);
    });

    it('queries therapists with THERAPIST role filter', async () => {
      await service.getAdminStats();
      expect(repos.userRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.THERAPIST }),
        expect.any(Object),
      );
    });

    it('queries clients with CLIENT role filter', async () => {
      await service.getAdminStats();
      expect(repos.userRepo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ role: UserRole.CLIENT }),
        expect.any(Object),
      );
    });
  });
});
