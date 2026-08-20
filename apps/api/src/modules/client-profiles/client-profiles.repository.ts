import { Injectable } from '@nestjs/common';
import type { ClientProfile, Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import { handlePrismaNotFound } from '../../common/repositories/prisma-errors';
import type { IClientProfileRepository } from './client-profiles.repository.interface';

@Injectable()
export class ClientProfileRepository implements IClientProfileRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(options: PaginationOptions): Promise<PaginatedResult<ClientProfile>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.clientProfile.findMany({ skip, take: limit }),
      this.prisma.clientProfile.count(),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<ClientProfile | null> {
    return this.prisma.clientProfile.findUnique({ where: { id } });
  }

  async findByUserId(userId: string): Promise<ClientProfile | null> {
    return this.prisma.clientProfile.findUnique({ where: { userId } });
  }

  async create(data: Prisma.ClientProfileCreateInput): Promise<ClientProfile> {
    return this.prisma.clientProfile.create({ data });
  }

  async update(id: string, data: Prisma.ClientProfileUpdateInput): Promise<ClientProfile> {
    try {
      return await this.prisma.clientProfile.update({ where: { id }, data });
    } catch (err) {
      handlePrismaNotFound(err, 'ClientProfile');
    }
  }

  /**
   * Deletes the client profile record.
   * ClientProfile has no status field — deletion is hard.
   * The parent User soft-delete (status=DELETED) is the authoritative lifecycle action.
   */
  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.clientProfile.delete({ where: { id } });
    } catch (err) {
      handlePrismaNotFound(err, 'ClientProfile');
    }
  }
}
