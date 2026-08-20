import type { SessionNote, SessionNoteVersion } from '@prisma/client';
import type {
  PaginationOptions,
  PaginatedResult,
} from '../../common/repositories/base.repository.interface';

export const SESSION_NOTE_REPOSITORY = Symbol('ISessionNoteRepository');

export interface SessionNoteFilters {
  therapistId?: string;
  clientId?: string;
  status?: 'DRAFT' | 'FINALIZED';
}

export interface CreateSessionNoteData {
  therapist: { connect: { id: string } };
  client: { connect: { id: string } };
  sessionDate: Date;
  sessionType: string;
  subjective?: string | null;
  objective?: string | null;
  assessment?: string | null;
  plan?: string | null;
}

export interface CreateVersionData {
  sessionNote: { connect: { id: string } };
  version: number;
  contentSnapshot: string;
  changedBy: { connect: { id: string } };
}

export interface ISessionNoteRepository {
  findAll(
    filters: SessionNoteFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<SessionNote>>;
  findById(id: string): Promise<SessionNote | null>;
  create(data: CreateSessionNoteData): Promise<SessionNote>;
  update(id: string, data: Partial<SessionNote>): Promise<SessionNote>;
  softDelete(id: string): Promise<void>;
  createVersion(data: CreateVersionData): Promise<SessionNoteVersion>;
  listVersions(sessionNoteId: string): Promise<SessionNoteVersion[]>;
}
