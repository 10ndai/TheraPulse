import type { Notification } from '@prisma/client';
import type {
  BaseRepository,
  PaginationOptions,
  PaginatedResult,
} from '../../common/repositories/base.repository.interface';

export const NOTIFICATIONS_REPOSITORY = Symbol('INotificationsRepository');

export interface NotificationFilters {
  recipientId: string;
  unreadOnly?: boolean;
}

export interface CreateNotificationData {
  recipient: { connect: { id: string } };
  type: string;
  title: string;
  body: string;
  resourceType: string;
  resourceId: string;
}

export interface INotificationsRepository extends Omit<
  BaseRepository<Notification, CreateNotificationData, Partial<Notification>>,
  'findAll' | 'update'
> {
  findAll(
    filters: NotificationFilters,
    options: PaginationOptions,
  ): Promise<PaginatedResult<Notification>>;
  create(data: CreateNotificationData): Promise<Notification>;
  markRead(id: string, recipientId: string): Promise<Notification>;
  markAllRead(recipientId: string): Promise<number>;
}
