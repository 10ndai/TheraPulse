import { Injectable } from '@nestjs/common';
import { UserRole, type WorksheetTemplate, type Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import { handlePrismaNotFound } from '../../common/repositories/prisma-errors';
import type {
  IWorksheetTemplateRepository,
  WorksheetTemplateFilters,
} from './worksheet-templates.repository.interface';

@Injectable()
export class WorksheetTemplateRepository implements IWorksheetTemplateRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: PaginationOptions): Promise<PaginatedResult<WorksheetTemplate>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.worksheetTemplate.findMany({ skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.worksheetTemplate.count(),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async findById(id: string): Promise<WorksheetTemplate | null> {
    return this.prisma.worksheetTemplate.findUnique({ where: { id } });
  }

  async create(data: Prisma.WorksheetTemplateCreateInput): Promise<WorksheetTemplate> {
    return this.prisma.worksheetTemplate.create({ data });
  }

  async update(id: string, data: Prisma.WorksheetTemplateUpdateInput): Promise<WorksheetTemplate> {
    try {
      return await this.prisma.worksheetTemplate.update({ where: { id }, data });
    } catch (err) {
      handlePrismaNotFound(err, 'WorksheetTemplate');
    }
  }

  /**
   * Hard-deletes the template record.
   * Restricted by FK: cannot delete if active assignments reference this template.
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.worksheetTemplate.delete({ where: { id } });
    } catch (err) {
      handlePrismaNotFound(err, 'WorksheetTemplate');
    }
  }

  async findByFilters(
    filters: WorksheetTemplateFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetTemplate>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const where = this.buildWhereClause(filters);

    const [data, total] = await Promise.all([
      this.prisma.worksheetTemplate.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.worksheetTemplate.count({ where }),
    ]);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  private buildWhereClause(filters: WorksheetTemplateFilters): Prisma.WorksheetTemplateWhereInput {
    const { type, isPublished, isSystem, actorId, actorRole } = filters;

    const visibilityClause = this.buildVisibilityClause(actorId, actorRole);

    return {
      ...visibilityClause,
      ...(type !== undefined && { type }),
      ...(isPublished !== undefined && { isPublished }),
      ...(isSystem !== undefined && { isSystem }),
    };
  }

  private buildVisibilityClause(
    actorId: string | undefined,
    actorRole: string,
  ): Prisma.WorksheetTemplateWhereInput {
    if (actorRole === UserRole.ADMIN) {
      return {};
    }

    if (actorRole === UserRole.THERAPIST && actorId) {
      return {
        OR: [{ createdById: actorId }, { isPublished: true }],
      };
    }

    // CLIENT or unknown role — published only
    return { isPublished: true };
  }
}
