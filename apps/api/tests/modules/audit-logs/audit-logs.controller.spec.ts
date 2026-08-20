import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { AuditLogsController } from '../../../src/modules/audit-logs/audit-logs.controller';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';

const adminId = 'admin-uuid-001';
const now = new Date();

const mockLog = {
  id: 'log-uuid-001',
  actorId: 'user-uuid-001',
  action: 'session_note.update',
  resourceType: 'session_note',
  resourceId: 'note-uuid-001',
  details: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: now,
};

const mockPaginated = {
  data: [mockLog],
  meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
};

const makeService = () => ({
  log: vi.fn(),
  findByResource: vi.fn().mockResolvedValue(mockPaginated),
  findAll: vi.fn().mockResolvedValue(mockPaginated),
});

function makeReq(
  role: UserRole = UserRole.ADMIN,
): Partial<Request> & { user: { id: string; role: UserRole } } {
  return { user: { id: adminId, role }, ip: '127.0.0.1', get: vi.fn(() => 'test-agent') };
}

describe('AuditLogsController', () => {
  let controller: AuditLogsController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [AuditLogsController],
      providers: [{ provide: AuditLogService, useValue: service }],
    }).compile();

    controller = module.get(AuditLogsController);
  });

  // ── GET /audit-logs?resourceType=&resourceId= ─────────────────────────────

  describe('findByResource()', () => {
    it('returns paginated audit logs for admin', async () => {
      const req = makeReq(UserRole.ADMIN);
      const result = await controller.findByResource(
        { resourceType: 'session_note', resourceId: 'note-uuid-001' },
        req as Request,
      );
      expect(result).toEqual({ success: true, data: mockPaginated.data, meta: mockPaginated.meta });
      expect(service.findByResource).toHaveBeenCalledWith('session_note', 'note-uuid-001', {
        page: 1,
        limit: 20,
      });
    });

    it('throws ForbiddenException for non-admin user', async () => {
      const req = makeReq(UserRole.THERAPIST);
      await expect(
        controller.findByResource(
          { resourceType: 'session_note', resourceId: 'note-uuid-001' },
          req as Request,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('accepts page and limit query params', async () => {
      const req = makeReq(UserRole.ADMIN);
      await controller.findByResource(
        { resourceType: 'session_note', resourceId: 'note-uuid-001', page: '2', limit: '10' },
        req as Request,
      );
      expect(service.findByResource).toHaveBeenCalledWith('session_note', 'note-uuid-001', {
        page: 2,
        limit: 10,
      });
    });

    it('defaults page to 1 and limit to 20 when not provided', async () => {
      const req = makeReq(UserRole.ADMIN);
      await controller.findByResource(
        { resourceType: 'session_note', resourceId: 'note-uuid-001' },
        req as Request,
      );
      expect(service.findByResource).toHaveBeenCalledWith('session_note', 'note-uuid-001', {
        page: 1,
        limit: 20,
      });
    });

    it('throws ForbiddenException for client role', async () => {
      const req = makeReq(UserRole.CLIENT);
      await expect(
        controller.findByResource(
          { resourceType: 'session_note', resourceId: 'note-uuid-001' },
          req as Request,
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
