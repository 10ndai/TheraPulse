import { Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import type { IAuditLogRepository, CreateAuditLogInput } from './audit-log.repository.interface';

@Injectable()
export class AuditLogRepository implements IAuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateAuditLogInput): Promise<AuditLog> {
    // Cast to unchecked input so Prisma accepts scalar actorId/resourceId directly
    // rather than requiring the relational `actor: { connect: ... }` form.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return this.prisma.auditLog.create({ data: data as any });
  }

  async findAll(options: PaginationOptions): Promise<PaginatedResult<AuditLog>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count(),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<AuditLog | null> {
    return this.prisma.auditLog.findUnique({ where: { id } });
  }

  async findByActor(
    actorId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<AuditLog>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { actorId };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<AuditLog>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { resourceType, resourceId };

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }
}
