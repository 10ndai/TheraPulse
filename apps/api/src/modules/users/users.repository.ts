import { Injectable } from '@nestjs/common';
import { type User, UserRole, UserStatus, type Prisma } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import { handlePrismaNotFound } from '../../common/repositories/prisma-errors';
import type { IUserRepository, UserFilters } from './users.repository.interface';

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: UserFilters = {},
    options: PaginationOptions = { page: 1, limit: 20 },
  ): Promise<PaginatedResult<User>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = filters.role ? { role: filters.role } : {};

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  async findPendingTherapists(options: PaginationOptions): Promise<PaginatedResult<User>> {
    const { page, limit } = options;
    const skip = (page - 1) * limit;
    const where = { role: UserRole.THERAPIST, status: UserStatus.PENDING };

    const [data, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  async update(id: string, data: Prisma.UserUpdateInput): Promise<User> {
    try {
      return await this.prisma.user.update({ where: { id }, data });
    } catch (err) {
      handlePrismaNotFound(err, 'User');
    }
  }

  async softDelete(id: string): Promise<void> {
    try {
      await this.prisma.user.update({
        where: { id },
        data: { status: UserStatus.DELETED },
      });
    } catch (err) {
      handlePrismaNotFound(err, 'User');
    }
  }
}
