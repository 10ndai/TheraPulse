import { Inject, Injectable } from '@nestjs/common';
import type { TherapistProfile } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import { THERAPIST_PROFILE_REPOSITORY } from '../therapist-profiles/therapist-profiles.repository.interface';
import type {
  ITherapistProfileRepository,
  TherapistSearchFilters,
} from '../therapist-profiles/therapist-profiles.repository.interface';

@Injectable()
export class DirectoryService {
  constructor(
    @Inject(THERAPIST_PROFILE_REPOSITORY)
    private readonly profileRepo: ITherapistProfileRepository,
  ) {}

  async searchTherapists(
    filters: TherapistSearchFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistProfile>> {
    return this.profileRepo.searchApproved(filters, options);
  }
}
