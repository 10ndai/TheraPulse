import { Inject, Injectable } from '@nestjs/common';
import { UserRole, AssignmentStatus } from '@prisma/client';
import type { WorksheetSubmission } from '@prisma/client';
import {
  WORKSHEET_ASSIGNMENT_REPOSITORY,
  type IWorksheetAssignmentRepository,
} from '../worksheets/worksheet-assignments.repository.interface';
import {
  WORKSHEET_SUBMISSION_REPOSITORY,
  type IWorksheetSubmissionRepository,
} from '../worksheets/worksheet-submissions.repository.interface';
import {
  SESSION_NOTE_REPOSITORY,
  type ISessionNoteRepository,
} from '../session-notes/session-notes.repository.interface';
import { USER_REPOSITORY, type IUserRepository } from '../users/users.repository.interface';

// ─── Return types ─────────────────────────────────────────────────────────────

export interface TherapistStats {
  totalAssignments: number;
  completedAssignments: number;
  totalNotes: number;
}

export interface ScoreTrendPoint {
  date: string;
  score: number;
}

export interface ClientProgress {
  totalAssignments: number;
  completedSubmissions: number;
  completionRate: number;
  scoreTrend: ScoreTrendPoint[];
}

export interface AdminStats {
  totalTherapists: number;
  totalClients: number;
  totalSubmissions: number;
  totalNotes: number;
}

const LIMIT_ONE = { page: 1, limit: 1 };
const LIMIT_TWENTY = { page: 1, limit: 20 };

@Injectable()
export class DashboardService {
  constructor(
    @Inject(WORKSHEET_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IWorksheetAssignmentRepository,
    @Inject(WORKSHEET_SUBMISSION_REPOSITORY)
    private readonly submissionRepo: IWorksheetSubmissionRepository,
    @Inject(SESSION_NOTE_REPOSITORY)
    private readonly noteRepo: ISessionNoteRepository,
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
  ) {}

  async getTherapistStats(therapistId: string): Promise<TherapistStats> {
    const [allAssignments, completedAssignments, notes] = await Promise.all([
      this.assignmentRepo.findByFilters(
        { actorId: therapistId, actorRole: UserRole.THERAPIST },
        LIMIT_ONE,
      ),
      this.assignmentRepo.findByFilters(
        { actorId: therapistId, actorRole: UserRole.THERAPIST, status: AssignmentStatus.COMPLETED },
        LIMIT_ONE,
      ),
      this.noteRepo.findAll({ therapistId }, LIMIT_ONE),
    ]);

    return {
      totalAssignments: allAssignments.meta.total,
      completedAssignments: completedAssignments.meta.total,
      totalNotes: notes.meta.total,
    };
  }

  async getClientProgress(clientId: string): Promise<ClientProgress> {
    const [assignments, submissions] = await Promise.all([
      this.assignmentRepo.findByFilters(
        { actorId: clientId, actorRole: UserRole.CLIENT },
        LIMIT_ONE,
      ),
      this.submissionRepo.findAll({ clientId, finalized: true }, LIMIT_TWENTY),
    ]);

    const totalAssignments = assignments.meta.total;
    const completedSubmissions = submissions.meta.total;
    const completionRate =
      totalAssignments > 0 ? Math.round((completedSubmissions / totalAssignments) * 100) : 0;

    const scoreTrend = submissions.data
      .filter((s: WorksheetSubmission) => s.score !== null)
      .map((s: WorksheetSubmission) => ({
        date: s.createdAt.toISOString().slice(0, 10),
        score: (s.score as { totalScore: number }).totalScore,
      }));

    return { totalAssignments, completedSubmissions, completionRate, scoreTrend };
  }

  async getAdminStats(): Promise<AdminStats> {
    const [therapists, clients, submissions, notes] = await Promise.all([
      this.userRepo.findAll({ role: UserRole.THERAPIST }, LIMIT_ONE),
      this.userRepo.findAll({ role: UserRole.CLIENT }, LIMIT_ONE),
      this.submissionRepo.findAll({}, LIMIT_ONE),
      this.noteRepo.findAll({}, LIMIT_ONE),
    ]);

    return {
      totalTherapists: therapists.meta.total,
      totalClients: clients.meta.total,
      totalSubmissions: submissions.meta.total,
      totalNotes: notes.meta.total,
    };
  }
}
