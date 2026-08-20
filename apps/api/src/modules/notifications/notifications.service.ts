import { ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { Notification } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import type {
  INotificationsRepository,
  NotificationFilters,
} from './notifications.repository.interface';
import { NOTIFICATIONS_REPOSITORY } from './notifications.repository.interface';

export interface CreateNotificationDto {
  recipientId: string;
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
}

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY)
    private readonly repo: INotificationsRepository,
  ) {}

  async listForRecipient(
    recipientId: string,
    filters: Pick<NotificationFilters, 'unreadOnly'>,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Notification>> {
    return this.repo.findAll({ recipientId, ...filters }, options);
  }

  async createNotification(dto: CreateNotificationDto): Promise<Notification> {
    return this.repo.create({
      recipient: { connect: { id: dto.recipientId } },
      type: dto.type,
      title: dto.title,
      body: dto.body,
      resourceType: dto.resourceType,
      resourceId: dto.resourceId,
    });
  }

  async markRead(id: string, actorId: string): Promise<Notification> {
    const notification = await this.repo.findById(id);
    if (!notification) throw new NotFoundException(`Notification ${id} not found.`);
    if (notification.recipientId !== actorId) {
      throw new ForbiddenException('You can only mark your own notifications as read.');
    }
    return this.repo.markRead(id, actorId);
  }

  async markAllRead(recipientId: string): Promise<number> {
    return this.repo.markAllRead(recipientId);
  }
}
