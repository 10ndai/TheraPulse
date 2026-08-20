import { Injectable } from '@nestjs/common';
import type { WorksheetSubmission, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token requires value import
import { PrismaService } from '../../prisma/prisma.service';
import type {
  IWorksheetSubmissionRepository,
  WorksheetSubmissionFilters,
} from './worksheet-submissions.repository.interface';

@Injectable()
export class WorksheetSubmissionsRepository implements IWorksheetSubmissionRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: WorksheetSubmissionFilters = {},
    options: PaginationOptions = { page: 1, limit: 20 },
  ): Promise<PaginatedResult<WorksheetSubmission>> {
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = this.buildWhere(filters);

    const [data, total] = await Promise.all([
      this.prisma.worksheetSubmission.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.worksheetSubmission.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<WorksheetSubmission | null> {
    return this.prisma.worksheetSubmission.findUnique({ where: { id } });
  }

  async create(data: Prisma.WorksheetSubmissionCreateInput): Promise<WorksheetSubmission> {
    return this.prisma.worksheetSubmission.create({ data });
  }

  async update(
    id: string,
    data: Prisma.WorksheetSubmissionUpdateInput,
  ): Promise<WorksheetSubmission> {
    return this.prisma.worksheetSubmission.update({ where: { id }, data });
  }

  /** Submissions are immutable after finalization — soft delete is a no-op. */
  async softDelete(_id: string): Promise<void> {
    // Intentional no-op: worksheet submissions are immutable records.
  }

  async findDraftByAssignment(assignmentId: string): Promise<WorksheetSubmission | null> {
    return this.prisma.worksheetSubmission.findFirst({
      where: { assignmentId, finalizedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private buildWhere(filters: WorksheetSubmissionFilters): Prisma.WorksheetSubmissionWhereInput {
    const where: Prisma.WorksheetSubmissionWhereInput = {};
    if (filters.clientId) where.clientId = filters.clientId;
    if (filters.assignmentId) where.assignmentId = filters.assignmentId;
    if (filters.finalized === true) where.finalizedAt = { not: null };
    if (filters.finalized === false) where.finalizedAt = null;
    return where;
  }
}
