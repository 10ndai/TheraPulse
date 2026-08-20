import { Injectable } from '@nestjs/common';
import { ApprovalStatus, type TherapistProfile, type Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import { handlePrismaNotFound } from '../../common/repositories/prisma-errors';
import type {
  ITherapistProfileRepository,
  TherapistSearchFilters,
} from './therapist-profiles.repository.interface';

@Injectable()
export class TherapistProfileRepository implements ITherapistProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: PaginationOptions): Promise<PaginatedResult<TherapistProfile>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.therapistProfile.findMany({ skip, take: limit }),
      this.prisma.therapistProfile.count(),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<TherapistProfile | null> {
    return this.prisma.therapistProfile.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<TherapistProfile | null> {
    return this.prisma.therapistProfile.findUnique({ where: { userId } });
  }

  async findByApprovalStatus(
    status: ApprovalStatus,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistProfile>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { approvalStatus: status };

    const [data, total] = await Promise.all([
      this.prisma.therapistProfile.findMany({ where, skip, take: limit }),
      this.prisma.therapistProfile.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: Prisma.TherapistProfileCreateInput): Promise<TherapistProfile> {
    return this.prisma.therapistProfile.create({ data });
  }

  async update(id: string, data: Prisma.TherapistProfileUpdateInput): Promise<TherapistProfile> {
    try {
      return await this.prisma.therapistProfile.update({ where: { id }, data });
    } catch (err) {
      handlePrismaNotFound(err, 'TherapistProfile');
    }
  }

  /**
   * Deletes the profile record.
   * TherapistProfile has no status field — deletion is hard.
   * The parent User soft-delete (status=DELETED) is the authoritative lifecycle action.
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.therapistProfile.delete({ where: { id } });
    } catch (err) {
      handlePrismaNotFound(err, 'TherapistProfile');
    }
  }

  async searchApproved(
    filters: TherapistSearchFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistProfile>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const where: Prisma.TherapistProfileWhereInput = {
      approvalStatus: ApprovalStatus.APPROVED,
      ...(filters.name && { name: { contains: filters.name, mode: 'insensitive' } }),
      ...(filters.city && { city: { contains: filters.city, mode: 'insensitive' } }),
      ...(filters.specialization && { specializations: { has: filters.specialization } }),
    };

    const [data, total] = await Promise.all([
      this.prisma.therapistProfile.findMany({ where, skip, take: limit }),
      this.prisma.therapistProfile.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
