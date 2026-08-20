import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { DashboardController } from '../../../src/modules/dashboard/dashboard.controller';
import { DashboardService } from '../../../src/modules/dashboard/dashboard.service';

const therapistId = 'therapist-uuid-001';
const clientId = 'client-uuid-001';

const mockTherapistStats = {
  totalAssignments: 10,
  completedAssignments: 6,
  totalNotes: 4,
};

const mockClientProgress = {
  totalAssignments: 5,
  completedSubmissions: 3,
  completionRate: 60,
  scoreTrend: [{ date: '2026-03-01', score: 15 }],
};

const mockAdminStats = {
  totalTherapists: 12,
  totalClients: 48,
  totalSubmissions: 200,
  totalNotes: 80,
};

const makeService = () => ({
  getTherapistStats: vi.fn().mockResolvedValue(mockTherapistStats),
  getClientProgress: vi.fn().mockResolvedValue(mockClientProgress),
  getAdminStats: vi.fn().mockResolvedValue(mockAdminStats),
});

function makeReq(
  id: string,
  role: UserRole,
): Partial<Request> & { user: { id: string; role: UserRole } } {
  return { user: { id, role }, ip: '127.0.0.1', get: vi.fn(() => 'test-agent') };
}

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: ReturnType<typeof makeService>;

  beforeEach(async () => {
    service = makeService();
    const module = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [{ provide: DashboardService, useValue: service }],
    }).compile();

    controller = module.get(DashboardController);
  });

  // ── GET /dashboard/therapist ──────────────────────────────────────────────

  describe('getTherapistOverview()', () => {
    it('returns therapist stats for a THERAPIST user', async () => {
      const req = makeReq(therapistId, UserRole.THERAPIST);
      const result = await controller.getTherapistOverview(req as Request);
      expect(result).toEqual({ success: true, data: mockTherapistStats });
      expect(service.getTherapistStats).toHaveBeenCalledWith(therapistId);
    });

    it('throws ForbiddenException for CLIENT role', async () => {
      const req = makeReq(clientId, UserRole.CLIENT);
      await expect(controller.getTherapistOverview(req as Request)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows ADMIN to view therapist stats (with explicit therapistId query param)', async () => {
      const req = makeReq('admin-001', UserRole.ADMIN);
      const result = await controller.getTherapistOverview(req as Request, therapistId);
      expect(result).toEqual({ success: true, data: mockTherapistStats });
      expect(service.getTherapistStats).toHaveBeenCalledWith(therapistId);
    });

    it('throws ForbiddenException for ADMIN without therapistId param', async () => {
      const req = makeReq('admin-001', UserRole.ADMIN);
      await expect(controller.getTherapistOverview(req as Request)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── GET /dashboard/client ─────────────────────────────────────────────────

  describe('getClientProgress()', () => {
    it('returns client progress for a CLIENT user', async () => {
      const req = makeReq(clientId, UserRole.CLIENT);
      const result = await controller.getClientProgress(req as Request);
      expect(result).toEqual({ success: true, data: mockClientProgress });
      expect(service.getClientProgress).toHaveBeenCalledWith(clientId);
    });

    it('throws ForbiddenException for THERAPIST role without clientId param', async () => {
      const req = makeReq(therapistId, UserRole.THERAPIST);
      await expect(controller.getClientProgress(req as Request)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('allows THERAPIST with clientId query param', async () => {
      const req = makeReq(therapistId, UserRole.THERAPIST);
      const result = await controller.getClientProgress(req as Request, clientId);
      expect(result).toEqual({ success: true, data: mockClientProgress });
      expect(service.getClientProgress).toHaveBeenCalledWith(clientId);
    });

    it('allows ADMIN with clientId query param', async () => {
      const req = makeReq('admin-001', UserRole.ADMIN);
      const result = await controller.getClientProgress(req as Request, clientId);
      expect(result).toEqual({ success: true, data: mockClientProgress });
    });

    it('throws ForbiddenException for ADMIN without clientId', async () => {
      const req = makeReq('admin-001', UserRole.ADMIN);
      await expect(controller.getClientProgress(req as Request)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ── GET /dashboard/admin ──────────────────────────────────────────────────

  describe('getAdminStats()', () => {
    it('returns admin stats for ADMIN role', async () => {
      const req = makeReq('admin-001', UserRole.ADMIN);
      const result = await controller.getAdminStats(req as Request);
      expect(result).toEqual({ success: true, data: mockAdminStats });
    });

    it('throws ForbiddenException for THERAPIST role', async () => {
      const req = makeReq(therapistId, UserRole.THERAPIST);
      await expect(controller.getAdminStats(req as Request)).rejects.toThrow(ForbiddenException);
    });

    it('throws ForbiddenException for CLIENT role', async () => {
      const req = makeReq(clientId, UserRole.CLIENT);
      await expect(controller.getAdminStats(req as Request)).rejects.toThrow(ForbiddenException);
    });
  });
});
