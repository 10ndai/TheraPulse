import { Injectable } from '@nestjs/common';
import { type TherapistClient, RelationshipStatus } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { TherapistClientWithClient } from './therapist-client.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import type { ITherapistClientRepository } from './therapist-client.repository.interface';

@Injectable()
export class TherapistClientRepository implements ITherapistClientRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(therapistId: string, clientId: string): Promise<TherapistClient> {
    return this.prisma.therapistClient.create({
      data: { therapistId, clientId, status: RelationshipStatus.ACTIVE },
    });
  }

  async findById(id: string): Promise<TherapistClient | null> {
    return this.prisma.therapistClient.findUnique({ where: { id } });
  }

  async findByTherapistAndClient(
    therapistId: string,
    clientId: string,
  ): Promise<TherapistClient | null> {
    return this.prisma.therapistClient.findUnique({
      where: { therapistId_clientId: { therapistId, clientId } },
    });
  }

  async findByTherapist(
    therapistId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistClientWithClient>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { therapistId };

    const [data, total] = await Promise.all([
      this.prisma.therapistClient.findMany({
        where,
        skip,
        take: limit,
        include: {
          client: {
            select: {
              email: true,
              clientProfile: { select: { name: true } },
            },
          },
        },
      }),
      this.prisma.therapistClient.count({ where }),
    ]);

    return {
      data: data as TherapistClientWithClient[],
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findByClient(
    clientId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistClient>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { clientId };

    const [data, total] = await Promise.all([
      this.prisma.therapistClient.findMany({ where, skip, take: limit }),
      this.prisma.therapistClient.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateStatus(id: string, status: RelationshipStatus): Promise<TherapistClient> {
    return this.prisma.therapistClient.update({ where: { id }, data: { status } });
  }
}
