import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { AuditLogRepository } from '../../../src/modules/audit-logs/audit-log.repository';

const mockAuditLog = {
  id: '00000000-0000-0000-0000-000000000001',
  actorId: '00000000-0000-0000-0000-000000000002',
  action: 'user.login',
  resourceType: 'user',
  resourceId: '00000000-0000-0000-0000-000000000003',
  details: null,
  ipAddress: '127.0.0.1',
  userAgent: 'Mozilla/5.0',
  createdAt: new Date('2026-01-01'),
};

const mockPrisma = {
  auditLog: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

describe('AuditLogRepository', () => {
  let repo: AuditLogRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: mockPrisma }, AuditLogRepository],
    }).compile();

    repo = module.get<AuditLogRepository>(AuditLogRepository);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns the audit log entry', async () => {
      mockPrisma.auditLog.create.mockResolvedValue(mockAuditLog);

      const data = {
        actorId: mockAuditLog.actorId,
        action: mockAuditLog.action,
        resourceType: mockAuditLog.resourceType,
        resourceId: mockAuditLog.resourceId,
        ipAddress: mockAuditLog.ipAddress,
        userAgent: mockAuditLog.userAgent,
      };
      const result = await repo.create(data);

      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({ data });
    });

    it('creates entry without optional fields (system action)', async () => {
      const systemLog = { ...mockAuditLog, actorId: null, resourceId: null, details: null };
      mockPrisma.auditLog.create.mockResolvedValue(systemLog);

      const data = {
        action: 'system.startup',
        resourceType: 'system',
        ipAddress: '127.0.0.1',
        userAgent: 'internal',
      };
      const result = await repo.create(data);

      expect(result).toEqual(systemLog);
      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({ data });
    });
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the audit log when found', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(mockAuditLog);
      const result = await repo.findById(mockAuditLog.id);
      expect(result).toEqual(mockAuditLog);
      expect(mockPrisma.auditLog.findUnique).toHaveBeenCalledWith({
        where: { id: mockAuditLog.id },
      });
    });

    it('returns null when audit log not found', async () => {
      mockPrisma.auditLog.findUnique.mockResolvedValue(null);
      const result = await repo.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated audit logs ordered by newest first', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockAuditLog]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });

    it('calculates skip correctly for page 2', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(25);

      await repo.findAll({ page: 2, limit: 20 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('returns correct totalPages for partial last page', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(21);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(2);
    });
  });

  // ── findByActor ───────────────────────────────────────────────────────────

  describe('findByActor()', () => {
    it('returns audit logs filtered by actor, newest first', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repo.findByActor(mockAuditLog.actorId, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockAuditLog]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { actorId: mockAuditLog.actorId },
          orderBy: { createdAt: 'desc' },
        }),
      );
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { actorId: mockAuditLog.actorId },
      });
    });

    it('returns correct pagination meta for actor logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(3);

      const result = await repo.findByActor(mockAuditLog.actorId, { page: 1, limit: 2 });

      expect(result.meta).toEqual({ page: 1, limit: 2, total: 3, totalPages: 2 });
    });

    it('calculates skip correctly for actor log page 2', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(10);

      await repo.findByActor(mockAuditLog.actorId, { page: 2, limit: 5 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 5, take: 5 }),
      );
    });
  });

  // ── findByResource ────────────────────────────────────────────────────────

  describe('findByResource()', () => {
    it('returns audit logs filtered by resourceType and resourceId', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([mockAuditLog]);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await repo.findByResource('user', mockAuditLog.resourceId, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([mockAuditLog]);
      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { resourceType: 'user', resourceId: mockAuditLog.resourceId },
        }),
      );
      expect(mockPrisma.auditLog.count).toHaveBeenCalledWith({
        where: { resourceType: 'user', resourceId: mockAuditLog.resourceId },
      });
    });

    it('returns correct pagination meta for resource logs', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      const result = await repo.findByResource('worksheet', 'some-id', { page: 1, limit: 10 });

      expect(result.meta).toEqual({ page: 1, limit: 10, total: 0, totalPages: 0 });
    });

    it('orders resource logs by newest first', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await repo.findByResource('session_note', 'note-id', { page: 1, limit: 10 });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { createdAt: 'desc' } }),
      );
    });
  });

  // ── append-only contract ──────────────────────────────────────────────────

  describe('append-only contract', () => {
    it('does not expose update() method', () => {
      expect((repo as unknown as Record<string, unknown>)['update']).toBeUndefined();
    });

    it('does not expose softDelete() method', () => {
      expect((repo as unknown as Record<string, unknown>)['softDelete']).toBeUndefined();
    });

    it('does not expose delete() method', () => {
      expect((repo as unknown as Record<string, unknown>)['delete']).toBeUndefined();
    });
  });
});
