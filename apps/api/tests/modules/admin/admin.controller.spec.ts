import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminController } from '../../../src/modules/admin/admin.controller';
import { AdminService } from '../../../src/modules/admin/admin.service';
import type { Request } from 'express';

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

const mockRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: '00000000-0000-0000-0000-000000000099', role: UserRole.ADMIN },
} as unknown as Request & { user: { sub: string; role: UserRole } };

const mockApprovedUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  role: UserRole.THERAPIST,
  status: UserStatus.ACTIVE,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockRejectedUser = {
  ...mockApprovedUser,
  status: UserStatus.SUSPENDED,
};

const mockPaginatedResult = {
  data: [
    {
      id: '00000000-0000-0000-0000-000000000001',
      email: 'therapist@example.com',
      role: UserRole.THERAPIST,
      status: UserStatus.PENDING,
      totpEnabled: false,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-01'),
    },
  ],
  meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
};

describe('AdminController', () => {
  let controller: AdminController;
  let mockAdminService: {
    listPendingTherapists: ReturnType<typeof vi.fn>;
    approveTherapist: ReturnType<typeof vi.fn>;
    rejectTherapist: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockAdminService = {
      listPendingTherapists: vi.fn(),
      approveTherapist: vi.fn(),
      rejectTherapist: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [AdminController],
      providers: [{ provide: AdminService, useValue: mockAdminService }],
    }).compile();

    controller = module.get<AdminController>(AdminController);
  });

  // ── GET /admin/therapists/pending ─────────────────────────────────────────

  describe('GET /admin/therapists/pending', () => {
    it('returns success envelope with paginated pending therapists', async () => {
      mockAdminService.listPendingTherapists.mockResolvedValue(mockPaginatedResult);

      const result = await controller.listPending({ page: 1, limit: 20 });

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPaginatedResult.data);
      expect(result.meta).toEqual(mockPaginatedResult.meta);
    });

    it('passes pagination params to service', async () => {
      mockAdminService.listPendingTherapists.mockResolvedValue({
        data: [],
        meta: { page: 2, limit: 10, total: 0, totalPages: 0 },
      });

      await controller.listPending({ page: 2, limit: 10 });

      expect(mockAdminService.listPendingTherapists).toHaveBeenCalledWith({ page: 2, limit: 10 });
    });

    it('defaults to page=1, limit=20 when no query params provided', async () => {
      mockAdminService.listPendingTherapists.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await controller.listPending({});

      expect(mockAdminService.listPendingTherapists).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });
  });

  // ── PATCH /admin/therapists/:id/approve ───────────────────────────────────

  describe('PATCH /admin/therapists/:id/approve', () => {
    it('returns success envelope with updated user on approval', async () => {
      mockAdminService.approveTherapist.mockResolvedValue(mockApprovedUser);

      const result = await controller.approve(mockApprovedUser.id, mockRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockApprovedUser);
    });

    it('calls service with therapistId, adminId from token, and request meta', async () => {
      mockAdminService.approveTherapist.mockResolvedValue(mockApprovedUser);

      await controller.approve(mockApprovedUser.id, mockRequest);

      expect(mockAdminService.approveTherapist).toHaveBeenCalledWith(
        mockApprovedUser.id,
        mockRequest.user.sub,
        expect.objectContaining({
          ipAddress: mockMeta.ipAddress,
          userAgent: mockMeta.userAgent,
        }),
      );
    });

    it('propagates NotFoundException from service', async () => {
      mockAdminService.approveTherapist.mockRejectedValue(new NotFoundException());

      await expect(controller.approve('nonexistent-id', mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException from service', async () => {
      mockAdminService.approveTherapist.mockRejectedValue(new BadRequestException());

      await expect(controller.approve(mockApprovedUser.id, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ── PATCH /admin/therapists/:id/reject ────────────────────────────────────

  describe('PATCH /admin/therapists/:id/reject', () => {
    it('returns success envelope with updated user on rejection', async () => {
      mockAdminService.rejectTherapist.mockResolvedValue(mockRejectedUser);

      const result = await controller.reject(mockRejectedUser.id, mockRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRejectedUser);
    });

    it('calls service with therapistId, adminId from token, and request meta', async () => {
      mockAdminService.rejectTherapist.mockResolvedValue(mockRejectedUser);

      await controller.reject(mockRejectedUser.id, mockRequest);

      expect(mockAdminService.rejectTherapist).toHaveBeenCalledWith(
        mockRejectedUser.id,
        mockRequest.user.sub,
        expect.objectContaining({
          ipAddress: mockMeta.ipAddress,
          userAgent: mockMeta.userAgent,
        }),
      );
    });

    it('propagates NotFoundException from service', async () => {
      mockAdminService.rejectTherapist.mockRejectedValue(new NotFoundException());

      await expect(controller.reject('nonexistent-id', mockRequest)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('propagates BadRequestException from service', async () => {
      mockAdminService.rejectTherapist.mockRejectedValue(new BadRequestException());

      await expect(controller.reject(mockRejectedUser.id, mockRequest)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
