import type { WorksheetTemplate, WorksheetType, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type {
  BaseRepository,
  PaginationOptions,
} from '../../common/repositories/base.repository.interface';

export const WORKSHEET_TEMPLATE_REPOSITORY = Symbol('IWorksheetTemplateRepository');

export interface WorksheetTemplateFilters {
  type?: WorksheetType;
  isPublished?: boolean;
  isSystem?: boolean;
  /** Actor ID — used by repository to construct THERAPIST visibility rules. */
  actorId?: string;
  /** Actor role — drives visibility filtering in the repository. */
  actorRole: string;
}

export interface IWorksheetTemplateRepository extends BaseRepository<
  WorksheetTemplate,
  Prisma.WorksheetTemplateCreateInput,
  Prisma.WorksheetTemplateUpdateInput
> {
  /**
   * Returns templates visible to the actor, applying role-based visibility rules:
   * - ADMIN: all templates
   * - THERAPIST: own templates + published templates by others
   * - CLIENT: published templates only
   */
  findByFilters(
    filters: WorksheetTemplateFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetTemplate>>;
}
