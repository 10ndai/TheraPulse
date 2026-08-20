import { Controller, Get, HttpCode, HttpStatus, Query } from '@nestjs/common';
import type { TherapistProfile } from '@prisma/client';
import type { ApiSuccessResponse, PaginationMeta } from '@therapulse/shared';
import { Public } from '../../common/decorators/public.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { DirectoryService } from './directory.service';

@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryService) {}

  /**
   * GET /directory/therapists
   * Public search for approved therapist profiles.
   * Optional filters: name, city, specialization.
   */
  @Public()
  @Get('therapists')
  @HttpCode(HttpStatus.OK)
  async search(
    @Query()
    query: {
      name?: string;
      city?: string;
      specialization?: string;
      page?: number | string;
      limit?: number | string;
    },
  ): Promise<ApiSuccessResponse<TherapistProfile[]> & { meta?: PaginationMeta }> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const result = await this.directoryService.searchTherapists(
      {
        ...(query.name !== undefined ? { name: query.name } : {}),
        ...(query.city !== undefined ? { city: query.city } : {}),
        ...(query.specialization !== undefined ? { specialization: query.specialization } : {}),
      },
      { page, limit },
    );

    return { success: true, data: result.data as TherapistProfile[], meta: result.meta };
  }
}
