import { Injectable } from '@nestjs/common';
import { UserRole, type WorksheetAssignment, type Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import type {
  IWorksheetAssignmentRepository,
  WorksheetAssignmentFilters,
  WorksheetAssignmentWithTemplate,
} from './worksheet-assignments.repository.interface';

@Injectable()
export class WorksheetAssignmentsRepository implements IWorksheetAssignmentRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: PaginationOptions): Promise<PaginatedResult<WorksheetAssignment>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const [data, total] = await Promise.all([
      this.prisma.worksheetAssignment.findMany({
        where: { deletedAt: null },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.worksheetAssignment.count({ where: { deletedAt: null } }),
    ]);
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string): Promise<WorksheetAssignment | null> {
    return this.prisma.worksheetAssignment.findFirst({ where: { id, deletedAt: null } });
  }

  async create(data: Prisma.WorksheetAssignmentCreateInput): Promise<WorksheetAssignment> {
    return this.prisma.worksheetAssignment.create({ data });
  }

  async update(
    id: string,
    data: Prisma.WorksheetAssignmentUpdateInput,
  ): Promise<WorksheetAssignment> {
    return this.prisma.worksheetAssignment.update({ where: { id }, data });
  }

  async softDelete(id: string): Promise<void> {
    await this.prisma.worksheetAssignment.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async findByFilters(
    filters: WorksheetAssignmentFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetAssignmentWithTemplate>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.worksheetAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { template: { select: { id: true, title: true, type: true } } },
      }),
      this.prisma.worksheetAssignment.count({ where }),
    ]);

    return {
      data: data as WorksheetAssignmentWithTemplate[],
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  private buildWhereClause(
    filters: WorksheetAssignmentFilters,
  ): Prisma.WorksheetAssignmentWhereInput {
    const { actorId, actorRole, status, clientId } = filters;

    const actorClause = this.buildActorClause(actorId, actorRole);

    return {
      ...actorClause,
      deletedAt: null,
      ...(status !== undefined && { status }),
      ...(clientId !== undefined && { clientId }),
    };
  }

  private buildActorClause(
    actorId: string | undefined,
    actorRole: string,
  ): Prisma.WorksheetAssignmentWhereInput {
    if (actorRole === UserRole.ADMIN) {
      return {};
    }
    if (actorRole === UserRole.THERAPIST && actorId) {
      return { therapistId: actorId };
    }
    if (actorRole === UserRole.CLIENT && actorId) {
      return { clientId: actorId };
    }
    return {};
  }
}
