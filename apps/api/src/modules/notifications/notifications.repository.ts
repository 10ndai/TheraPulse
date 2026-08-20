import { Injectable } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { PrismaService } from '../../prisma/prisma.service';
import type {
  CreateNotificationData,
  INotificationsRepository,
  NotificationFilters,
} from './notifications.repository.interface';

@Injectable()
export class NotificationsRepository implements INotificationsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(
    filters: NotificationFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Notification>> {
    const { recipientId, unreadOnly } = filters;
    const page = options.page ?? 1;
    const limit = options.limit ?? 20;
    const skip = (page - 1) * limit;

    const where = {
      recipientId,
      ...(unreadOnly ? { readAt: null } : {}),
    };

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findById(id: string): Promise<Notification | null> {
    return this.prisma.notification.findUnique({ where: { id } });
  }

  async create(data: CreateNotificationData): Promise<Notification> {
    return this.prisma.notification.create({ data });
  }

  async markRead(id: string, recipientId: string): Promise<Notification> {
    return this.prisma.notification.update({
      where: { id, recipientId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(recipientId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: { recipientId, readAt: null },
      data: { readAt: new Date() },
    });
    return result.count;
  }

  // ── BaseRepository stubs (not used for notifications) ──────────────────────

  async update(_id: string, _data: Partial<Notification>): Promise<Notification> {
    throw new Error('Use markRead or markAllRead instead.');
  }

  async softDelete(_id: string): Promise<void> {
    // notifications are not soft-deleted
  }
}
