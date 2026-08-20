import type { WorksheetSubmission, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type {
  BaseRepository,
  PaginationOptions,
} from '../../common/repositories/base.repository.interface';

export const WORKSHEET_SUBMISSION_REPOSITORY = Symbol('IWorksheetSubmissionRepository');

export interface WorksheetSubmissionFilters {
  clientId?: string;
  assignmentId?: string;
  finalized?: boolean;
}

export interface IWorksheetSubmissionRepository extends BaseRepository<
  WorksheetSubmission,
  Prisma.WorksheetSubmissionCreateInput,
  Prisma.WorksheetSubmissionUpdateInput
> {
  /**
   * Find all submissions matching filters with pagination.
   * Overloads the base findAll to accept optional filters.
   */
  findAll(
    filters: WorksheetSubmissionFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetSubmission>>;

  /** Returns the most recent non-finalized submission for the given assignment, or null. */
  findDraftByAssignment(assignmentId: string): Promise<WorksheetSubmission | null>;
}
