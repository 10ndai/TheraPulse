import type { TherapistProfile, ApprovalStatus, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type {
  BaseRepository,
  PaginationOptions,
} from '../../common/repositories/base.repository.interface';

export const THERAPIST_PROFILE_REPOSITORY = Symbol('ITherapistProfileRepository');

export interface TherapistSearchFilters {
  name?: string;
  city?: string;
  specialization?: string;
}

export interface ITherapistProfileRepository extends BaseRepository<
  TherapistProfile,
  Prisma.TherapistProfileCreateInput,
  Prisma.TherapistProfileUpdateInput
> {
  findByUserId(userId: string): Promise<TherapistProfile | null>;
  findByApprovalStatus(
    status: ApprovalStatus,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistProfile>>;
  /** Searches approved therapist profiles with optional name/city/specialization filters. */
  searchApproved(
    filters: TherapistSearchFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistProfile>>;
}
