import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';
import {
  AUDIT_LOG_REPOSITORY,
  type CreateAuditLogInput,
} from '../../../src/modules/audit-logs/audit-log.repository.interface';

const mockAuditLog = {
  id: '00000000-0000-0000-0000-000000000001',
  actorId: '00000000-0000-0000-0000-000000000002',
  action: 'user.login',
  resourceType: 'user',
  resourceId: null,
  details: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: new Date('2026-01-01'),
};

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockRepo: { create: ReturnType<typeof vi.fn>; findByResource: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    mockRepo = { create: vi.fn(), findByResource: vi.fn() };

    const module = await Test.createTestingModule({
      providers: [AuditLogService, { provide: AUDIT_LOG_REPOSITORY, useValue: mockRepo }],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
  });

  // ── log() ─────────────────────────────────────────────────────────────────

  describe('log()', () => {
    it('delegates to repository.create() and returns the audit log', async () => {
      mockRepo.create.mockResolvedValue(mockAuditLog);

      const input: CreateAuditLogInput = {
        actorId: mockAuditLog.actorId,
        action: 'user.login',
        resourceType: 'user',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
      };
      const result = await service.log(input);

      expect(result).toEqual(mockAuditLog);
      expect(mockRepo.create).toHaveBeenCalledOnce();
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('logs system actions without an actorId', async () => {
      const systemLog = { ...mockAuditLog, actorId: null };
      mockRepo.create.mockResolvedValue(systemLog);

      const input: CreateAuditLogInput = {
        action: 'system.startup',
        resourceType: 'system',
        ipAddress: '127.0.0.1',
        userAgent: 'internal',
      };
      const result = await service.log(input);

      expect(result).toEqual(systemLog);
      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('passes details through to repository', async () => {
      mockRepo.create.mockResolvedValue(mockAuditLog);

      const input: CreateAuditLogInput = {
        action: 'user.login',
        resourceType: 'user',
        ipAddress: '127.0.0.1',
        userAgent: 'Mozilla/5.0',
        details: { reason: 'suspicious_activity', attempts: 3 },
      };
      await service.log(input);

      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('passes resourceId through to repository', async () => {
      mockRepo.create.mockResolvedValue(mockAuditLog);

      const input: CreateAuditLogInput = {
        action: 'worksheet.submit',
        resourceType: 'worksheet',
        resourceId: 'worksheet-uuid',
        ipAddress: '10.0.0.1',
        userAgent: 'Chrome/120',
      };
      await service.log(input);

      expect(mockRepo.create).toHaveBeenCalledWith(input);
    });

    it('propagates repository errors', async () => {
      mockRepo.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(
        service.log({
          action: 'user.login',
          resourceType: 'user',
          ipAddress: '127.0.0.1',
          userAgent: 'Mozilla/5.0',
        }),
      ).rejects.toThrow('DB connection failed');
    });
  });

  // ── findByResource() ───────────────────────────────────────────────────────

  describe('findByResource()', () => {
    const mockPaginated = {
      data: [mockAuditLog],
      meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
    };

    it('delegates to repository.findByResource() and returns paginated result', async () => {
      mockRepo.findByResource.mockResolvedValue(mockPaginated);
      const result = await service.findByResource('session_note', 'note-001', {
        page: 1,
        limit: 20,
      });
      expect(result).toEqual(mockPaginated);
      expect(mockRepo.findByResource).toHaveBeenCalledWith('session_note', 'note-001', {
        page: 1,
        limit: 20,
      });
    });

    it('propagates repository errors', async () => {
      mockRepo.findByResource.mockRejectedValue(new Error('DB error'));
      await expect(
        service.findByResource('session_note', 'note-001', { page: 1, limit: 20 }),
      ).rejects.toThrow('DB error');
    });
  });
});
