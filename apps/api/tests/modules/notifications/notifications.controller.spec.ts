import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { NotificationsController } from '../../../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../../../src/modules/notifications/notifications.service';

const recipientId = 'client-uuid-001';
const notifId = 'notif-uuid-001';
const now = new Date();

const mockUser = { sub: recipientId, role: UserRole.CLIENT };

const mockNotification = {
  id: notifId,
  recipientId,
  type: 'NEW_ASSIGNMENT',
  title: 'New worksheet assigned',
  body: 'PHQ-9 has been assigned to you.',
  resourceType: 'WorksheetAssignment',
  resourceId: 'assign-uuid-001',
  readAt: null,
  createdAt: now,
};

const makeService = () => ({
  listForRecipient: vi.fn().mockResolvedValue({
    data: [mockNotification],
    meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
  }),
  markRead: vi.fn().mockResolvedValue({ ...mockNotification, readAt: now }),
  markAllRead: vi.fn().mockResolvedValue(1),
  createNotification: vi.fn().mockResolvedValue(mockNotification),
});

function makeReq(): Partial<Request> & { user: typeof mockUser } {
  return { user: mockUser };
}

describe('NotificationsController', () => {
  let controller: NotificationsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [{ provide: NotificationsService, useValue: service }],
    }).compile();

    controller = module.get(NotificationsController);
  });

  describe('GET /notifications', () => {
    it('returns paginated notifications in success envelope', async () => {
      const result = await controller.list(
        { page: 1, limit: 20 },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listForRecipient).toHaveBeenCalledWith(
        recipientId,
        expect.any(Object),
        expect.objectContaining({ page: 1, limit: 20 }),
      );
      expect(result).toEqual({
        success: true,
        data: [mockNotification],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      });
    });

    /** Express hands over strings; passing them through 500s inside Prisma. */
    it('coerces string page/limit into numbers', async () => {
      await controller.list(
        { page: '2', limit: '50' },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listForRecipient).toHaveBeenCalledWith(recipientId, expect.any(Object), {
        page: 2,
        limit: 50,
      });
    });

    it('rejects an over-max limit with 400 instead of querying unbounded', async () => {
      await expect(
        controller.list(
          { limit: '5000' },
          makeReq() as unknown as Request & { user: typeof mockUser },
        ),
      ).rejects.toThrow(BadRequestException);
      expect(service.listForRecipient).not.toHaveBeenCalled();
    });

    it('filters to unread when unreadOnly query param is true', async () => {
      await controller.list(
        { page: 1, limit: 20, unreadOnly: true },
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.listForRecipient).toHaveBeenCalledWith(
        recipientId,
        expect.objectContaining({ unreadOnly: true }),
        expect.any(Object),
      );
    });
  });

  describe('PATCH /notifications/:id/read', () => {
    it('marks notification as read and returns updated notification', async () => {
      const result = await controller.markRead(
        notifId,
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.markRead).toHaveBeenCalledWith(notifId, recipientId);
      expect(result).toEqual({ success: true, data: { ...mockNotification, readAt: now } });
    });
  });

  describe('PATCH /notifications/read-all', () => {
    it('marks all notifications read and returns count', async () => {
      const result = await controller.markAllRead(
        makeReq() as unknown as Request & { user: typeof mockUser },
      );
      expect(service.markAllRead).toHaveBeenCalledWith(recipientId);
      expect(result).toEqual({ success: true, data: { marked: 1 } });
    });
  });
});
