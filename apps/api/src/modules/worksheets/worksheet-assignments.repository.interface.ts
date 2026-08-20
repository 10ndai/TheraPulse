import type { WorksheetAssignment, AssignmentStatus, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type {
  BaseRepository,
  PaginationOptions,
} from '../../common/repositories/base.repository.interface';

export const WORKSHEET_ASSIGNMENT_REPOSITORY = Symbol('IWorksheetAssignmentRepository');

export interface WorksheetAssignmentWithTemplate extends WorksheetAssignment {
  template: { id: string; title: string; type: string };
}

export interface WorksheetAssignmentFilters {
  status?: AssignmentStatus;
  /** Actor ID — used to filter by therapistId or clientId depending on role. */
  actorId?: string;
  /** Actor role — drives visibility filtering. */
  actorRole: string;
  /** Optional client ID to narrow results to a specific client. */
  clientId?: string;
}

export interface IWorksheetAssignmentRepository extends BaseRepository<
  WorksheetAssignment,
  Prisma.WorksheetAssignmentCreateInput,
  Prisma.WorksheetAssignmentUpdateInput
> {
  /**
   * Returns assignments visible to the actor, always including the template relation:
   * - ADMIN: all assignments
   * - THERAPIST: assignments they created (therapistId === actorId)
   * - CLIENT: assignments assigned to them (clientId === actorId)
   * An optional clientId filter narrows results to a specific client.
   */
  findByFilters(
    filters: WorksheetAssignmentFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetAssignmentWithTemplate>>;
}
