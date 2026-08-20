import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { AdminService } from '../../../src/modules/admin/admin.service';
import { USER_REPOSITORY } from '../../../src/modules/users/users.repository.interface';
import { THERAPIST_PROFILE_REPOSITORY } from '../../../src/modules/therapist-profiles/therapist-profiles.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../../../src/modules/audit-logs/audit-log.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

const mockPendingTherapist = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'therapist@example.com',
  passwordHash: '$2b$12$hash',
  role: UserRole.THERAPIST,
  status: UserStatus.PENDING,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockAdminId = '00000000-0000-0000-0000-000000000099';

describe('AdminService', () => {
  let service: AdminService;
  let mockUserRepo: {
    findPendingTherapists: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockTherapistProfileRepo: {
    findByUserId: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockUserRepo = {
      findPendingTherapists: vi.fn(),
      findById: vi.fn(),
      update: vi.fn(),
    };
    mockTherapistProfileRepo = {
      findByUserId: vi.fn().mockResolvedValue(null),
      update: vi.fn(),
    };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        AuditLogService,
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: THERAPIST_PROFILE_REPOSITORY, useValue: mockTherapistProfileRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
  });

  // ── listPendingTherapists() ───────────────────────────────────────────────

  describe('listPendingTherapists()', () => {
    it('returns paginated pending therapists', async () => {
      const paginated = {
        data: [mockPendingTherapist],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockUserRepo.findPendingTherapists.mockResolvedValue(paginated);

      const result = await service.listPendingTherapists({ page: 1, limit: 20 });

      expect(result).toEqual(paginated);
      expect(mockUserRepo.findPendingTherapists).toHaveBeenCalledWith({ page: 1, limit: 20 });
    });

    it('returns empty data when no pending therapists exist', async () => {
      mockUserRepo.findPendingTherapists.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      const result = await service.listPendingTherapists({ page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
    });
  });

  // ── approveTherapist() ───────────────────────────────────────────────────

  describe('approveTherapist()', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.approveTherapist('nonexistent-id', mockAdminId, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when user is not a THERAPIST', async () => {
      mockUserRepo.findById.mockResolvedValue({ ...mockPendingTherapist, role: UserRole.CLIENT });

      await expect(
        service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when therapist is not in PENDING status', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...mockPendingTherapist,
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates user status to ACTIVE', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({ ...mockPendingTherapist, status: UserStatus.ACTIVE });

      await service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockUserRepo.update).toHaveBeenCalledWith(mockPendingTherapist.id, {
        status: UserStatus.ACTIVE,
      });
    });

    it('updates therapist profile approvalStatus and approvedById when profile exists', async () => {
      const mockProfile = {
        id: 'profile-001',
        userId: mockPendingTherapist.id,
        approvalStatus: 'PENDING',
        approvedById: null,
      };
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({ ...mockPendingTherapist, status: UserStatus.ACTIVE });
      mockTherapistProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockTherapistProfileRepo.update.mockResolvedValue({
        ...mockProfile,
        approvalStatus: 'APPROVED',
        approvedById: mockAdminId,
      });

      await service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockTherapistProfileRepo.update).toHaveBeenCalledWith(
        mockProfile.id,
        expect.objectContaining({
          approvalStatus: 'APPROVED',
          approver: { connect: { id: mockAdminId } },
        }),
      );
    });

    it('does NOT update profile when no therapist profile exists', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({ ...mockPendingTherapist, status: UserStatus.ACTIVE });
      mockTherapistProfileRepo.findByUserId.mockResolvedValue(null);

      await service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockTherapistProfileRepo.update).not.toHaveBeenCalled();
    });

    it('writes an audit log with action therapist.approve', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({ ...mockPendingTherapist, status: UserStatus.ACTIVE });

      await service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'therapist.approve',
          actorId: mockAdminId,
          resourceType: 'user',
          resourceId: mockPendingTherapist.id,
          ipAddress: '127.0.0.1',
          userAgent: 'TestAgent/1.0',
        }),
      );
    });

    it('returns safe user data (no passwordHash, no totpSecret)', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({ ...mockPendingTherapist, status: UserStatus.ACTIVE });

      const result = await service.approveTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('totpSecret');
      expect(result).toMatchObject({
        id: mockPendingTherapist.id,
        status: UserStatus.ACTIVE,
      });
    });
  });

  // ── rejectTherapist() ────────────────────────────────────────────────────

  describe('rejectTherapist()', () => {
    it('throws NotFoundException when user does not exist', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(
        service.rejectTherapist('nonexistent-id', mockAdminId, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when user is not a THERAPIST', async () => {
      mockUserRepo.findById.mockResolvedValue({ ...mockPendingTherapist, role: UserRole.CLIENT });

      await expect(
        service.rejectTherapist(mockPendingTherapist.id, mockAdminId, mockMeta),
      ).rejects.toThrow(BadRequestException);
    });

    it('throws BadRequestException when therapist is not in PENDING status', async () => {
      mockUserRepo.findById.mockResolvedValue({
        ...mockPendingTherapist,
        status: UserStatus.ACTIVE,
      });

      await expect(
        service.rejectTherapist(mockPendingTherapist.id, mockAdminId, mockMeta),
      ).rejects.toThrow(BadRequestException);
    });

    it('updates user status to SUSPENDED', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({
        ...mockPendingTherapist,
        status: UserStatus.SUSPENDED,
      });

      await service.rejectTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockUserRepo.update).toHaveBeenCalledWith(mockPendingTherapist.id, {
        status: UserStatus.SUSPENDED,
      });
    });

    it('updates therapist profile approvalStatus to REJECTED when profile exists', async () => {
      const mockProfile = {
        id: 'profile-001',
        userId: mockPendingTherapist.id,
        approvalStatus: 'PENDING',
        approvedById: null,
      };
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({
        ...mockPendingTherapist,
        status: UserStatus.SUSPENDED,
      });
      mockTherapistProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockTherapistProfileRepo.update.mockResolvedValue({
        ...mockProfile,
        approvalStatus: 'REJECTED',
        approvedById: mockAdminId,
      });

      await service.rejectTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockTherapistProfileRepo.update).toHaveBeenCalledWith(
        mockProfile.id,
        expect.objectContaining({
          approvalStatus: 'REJECTED',
          approver: { connect: { id: mockAdminId } },
        }),
      );
    });

    it('writes an audit log with action therapist.reject', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({
        ...mockPendingTherapist,
        status: UserStatus.SUSPENDED,
      });

      await service.rejectTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'therapist.reject',
          actorId: mockAdminId,
          resourceType: 'user',
          resourceId: mockPendingTherapist.id,
        }),
      );
    });

    it('returns safe user data reflecting SUSPENDED status', async () => {
      mockUserRepo.findById.mockResolvedValue(mockPendingTherapist);
      mockUserRepo.update.mockResolvedValue({
        ...mockPendingTherapist,
        status: UserStatus.SUSPENDED,
      });

      const result = await service.rejectTherapist(mockPendingTherapist.id, mockAdminId, mockMeta);

      expect(result).not.toHaveProperty('passwordHash');
      expect(result).not.toHaveProperty('totpSecret');
      expect(result).toMatchObject({
        id: mockPendingTherapist.id,
        status: UserStatus.SUSPENDED,
      });
    });
  });
});
