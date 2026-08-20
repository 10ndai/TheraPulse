import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';
import { NOTIFICATIONS_REPOSITORY } from '../../../src/modules/notifications/notifications.repository.interface';

const now = new Date();
const notifId = 'notif-uuid-001';
const recipientId = 'client-uuid-001';

const mockNotification = {
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

const makeRepo = () => ({
  findAll: vi.fn().mockResolvedValue({
    data: [mockNotification],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  findById: vi.fn().mockResolvedValue(mockNotification),
  create: vi.fn().mockResolvedValue(mockNotification),
  update: vi.fn().mockResolvedValue(mockNotification),
  softDelete: vi.fn().mockResolvedValue(undefined),
  markRead: vi.fn().mockResolvedValue({ ...mockNotification, readAt: now }),
  markAllRead: vi.fn().mockResolvedValue(1),
});

describe('NotificationsService', () => {
  let service: NotificationsService;
  let repo: ReturnType<typeof makeRepo>;

  beforeEach(async () => {
    repo = makeRepo();
    const module = await Test.createTestingModule({
      providers: [NotificationsService, { provide: NOTIFICATIONS_REPOSITORY, useValue: repo }],
    }).compile();

    service = module.get(NotificationsService);
  });

  describe('listForRecipient', () => {
    it('returns paginated notifications for the recipient', async () => {
      const result = await service.listForRecipient(recipientId, {}, { page: 1, limit: 20 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId }),
        expect.objectContaining({ page: 1, limit: 20 }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('passes unreadOnly filter through to repository', async () => {
      await service.listForRecipient(recipientId, { unreadOnly: true }, { page: 1, limit: 20 });
      expect(repo.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ recipientId, unreadOnly: true }),
        expect.any(Object),
      );
    });
  });

  describe('createNotification', () => {
    it('creates a notification via the repository', async () => {
      const dto = {
        recipientId,
        type: 'NEW_ASSIGNMENT' as const,
        title: 'New worksheet assigned',
        body: 'PHQ-9 has been assigned to you.',
        resourceType: 'WorksheetAssignment',
        resourceId: 'assign-uuid-001',
      };
      const result = await service.createNotification(dto);
      expect(repo.create).toHaveBeenCalled();
      expect(result).toEqual(mockNotification);
    });
  });

  describe('markRead', () => {
    it('marks a notification as read when it belongs to the actor', async () => {
      const result = await service.markRead(notifId, recipientId);
      expect(repo.markRead).toHaveBeenCalledWith(notifId, recipientId);
      expect(result.readAt).not.toBeNull();
    });

    it('throws NotFoundException when notification does not exist', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.markRead('nonexistent', recipientId)).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when notification belongs to a different user', async () => {
      repo.findById.mockResolvedValueOnce({ ...mockNotification, recipientId: 'other-user' });
      await expect(service.markRead(notifId, recipientId)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('markAllRead', () => {
    it('marks all notifications read for the recipient and returns count', async () => {
      const count = await service.markAllRead(recipientId);
      expect(repo.markAllRead).toHaveBeenCalledWith(recipientId);
      expect(count).toBe(1);
    });
  });
});
