import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import type { Notification } from '@prisma/client';
import { NotificationsRepository } from '../../../src/modules/notifications/notifications.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const now = new Date();
const notifId = 'notif-uuid-001';
const recipientId = 'client-uuid-001';

const mockNotification: Notification = {
  id: notifId,
  recipientId,
  type: 'NEW_ASSIGNMENT',
  title: 'New worksheet assigned',
  body: 'PHQ-9 Depression Screen has been assigned to you.',
  resourceType: 'WorksheetAssignment',
  resourceId: 'assign-uuid-001',
  readAt: null,
  createdAt: now,
};

describe('NotificationsRepository', () => {
  let repo: NotificationsRepository;
  let prisma: {
    notification: {
      findMany: ReturnType<typeof vi.fn>;
      count: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    prisma = {
      notification: {
        findMany: vi.fn().mockResolvedValue([mockNotification]),
        count: vi.fn().mockResolvedValue(1),
        findUnique: vi.fn().mockResolvedValue(mockNotification),
        create: vi.fn().mockResolvedValue(mockNotification),
        update: vi.fn().mockResolvedValue({ ...mockNotification, readAt: now }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
    };

    const module = await Test.createTestingModule({
      providers: [NotificationsRepository, { provide: PrismaService, useValue: prisma }],
    }).compile();

    repo = module.get(NotificationsRepository);
  });

  it('findAll returns paginated notifications for recipient', async () => {
    const result = await repo.findAll({ recipientId }, { page: 1, limit: 20 });
    expect(prisma.notification.findMany).toHaveBeenCalled();
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);
  });

  it('findAll filters to unread only when unreadOnly=true', async () => {
    await repo.findAll({ recipientId, unreadOnly: true }, { page: 1, limit: 20 });
    expect(prisma.notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ readAt: null }),
      }),
    );
  });

  it('findById returns a notification by id', async () => {
    const result = await repo.findById(notifId);
    expect(result).toEqual(mockNotification);
  });

  it('findById returns null when not found', async () => {
    prisma.notification.findUnique.mockResolvedValueOnce(null);
    const result = await repo.findById('nonexistent');
    expect(result).toBeNull();
  });

  it('create saves a new notification', async () => {
    const data = {
      recipient: { connect: { id: recipientId } },
      type: 'NEW_ASSIGNMENT' as const,
      title: 'New worksheet assigned',
      body: 'PHQ-9 Depression Screen has been assigned to you.',
      resourceType: 'WorksheetAssignment',
      resourceId: 'assign-uuid-001',
    };
    const result = await repo.create(data);
    expect(prisma.notification.create).toHaveBeenCalled();
    expect(result).toEqual(mockNotification);
  });

  it('markRead sets readAt on the notification', async () => {
    const result = await repo.markRead(notifId, recipientId);
    expect(prisma.notification.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: notifId }),
        data: expect.objectContaining({ readAt: expect.any(Date) }),
      }),
    );
    expect(result.readAt).not.toBeNull();
  });

  it('markAllRead sets readAt on all unread notifications for recipient', async () => {
    const count = await repo.markAllRead(recipientId);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ recipientId, readAt: null }),
      }),
    );
    expect(count).toBe(1);
  });
});
