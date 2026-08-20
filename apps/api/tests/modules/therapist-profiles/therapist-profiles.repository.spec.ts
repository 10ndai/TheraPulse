import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ApprovalStatus } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TherapistProfileRepository } from '../../../src/modules/therapist-profiles/therapist-profiles.repository';

const mockProfile = {
  id: '00000000-0000-0000-0000-000000000010',
  userId: '00000000-0000-0000-0000-000000000001',
  name: 'Dr. Tariro Moyo',
  bio: 'Specialises in anxiety.',
  specializations: ['anxiety', 'CBT'],
  qualifications: ['MSc Clinical Psychology'],
  licenseNumber: 'HPCZ-CP-00142',
  languages: ['English', 'Shona'],
  city: 'Harare',
  province: 'Harare',
  phone: null,
  approvalStatus: ApprovalStatus.APPROVED,
  approvedById: '00000000-0000-0000-0000-000000000099',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  therapistProfile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('TherapistProfileRepository', () => {
  let repo: TherapistProfileRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: mockPrisma }, TherapistProfileRepository],
    }).compile();

    repo = module.get<TherapistProfileRepository>(TherapistProfileRepository);
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the profile when found', async () => {
      mockPrisma.therapistProfile.findUnique.mockResolvedValue(mockProfile);
      const result = await repo.findById(mockProfile.id);
      expect(result).toEqual(mockProfile);
    });

    it('returns null when not found', async () => {
      mockPrisma.therapistProfile.findUnique.mockResolvedValue(null);
      expect(await repo.findById('no-such-id')).toBeNull();
    });
  });

  // ── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('looks up by user_id field', async () => {
      mockPrisma.therapistProfile.findUnique.mockResolvedValue(mockProfile);
      const result = await repo.findByUserId(mockProfile.userId);
      expect(result).toEqual(mockProfile);
      expect(mockPrisma.therapistProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockProfile.userId },
      });
    });

    it('returns null when no profile exists for the user', async () => {
      mockPrisma.therapistProfile.findUnique.mockResolvedValue(null);
      expect(await repo.findByUserId('no-such-user-id')).toBeNull();
    });
  });

  // ── findByApprovalStatus ──────────────────────────────────────────────────

  describe('findByApprovalStatus()', () => {
    it('returns paginated profiles filtered by approval status', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      const result = await repo.findByApprovalStatus(ApprovalStatus.APPROVED, {
        page: 1,
        limit: 20,
      });

      expect(result.data).toEqual([mockProfile]);
      expect(result.meta.total).toBe(1);
      expect(mockPrisma.therapistProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { approvalStatus: ApprovalStatus.APPROVED },
        }),
      );
    });
  });

  // ── searchApproved ───────────────────────────────────────────────────────

  describe('searchApproved()', () => {
    it('filters by approvalStatus=APPROVED always', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      await repo.searchApproved({}, { page: 1, limit: 20 });

      expect(mockPrisma.therapistProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ approvalStatus: ApprovalStatus.APPROVED }),
        }),
      );
    });

    it('adds name filter when provided', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      await repo.searchApproved({ name: 'Tariro' }, { page: 1, limit: 20 });

      expect(mockPrisma.therapistProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            name: expect.objectContaining({ contains: 'Tariro' }),
          }),
        }),
      );
    });

    it('adds city filter when provided', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      await repo.searchApproved({ city: 'Harare' }, { page: 1, limit: 20 });

      expect(mockPrisma.therapistProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            city: expect.objectContaining({ contains: 'Harare' }),
          }),
        }),
      );
    });

    it('adds specialization filter when provided', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      await repo.searchApproved({ specialization: 'CBT' }, { page: 1, limit: 20 });

      expect(mockPrisma.therapistProfile.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            specializations: expect.objectContaining({ has: 'CBT' }),
          }),
        }),
      );
    });

    it('returns paginated results', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      const result = await repo.searchApproved({}, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockProfile]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns all profiles paginated', async () => {
      mockPrisma.therapistProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.therapistProfile.count.mockResolvedValue(1);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockProfile]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns the profile', async () => {
      mockPrisma.therapistProfile.create.mockResolvedValue(mockProfile);
      const result = await repo.create({
        data: { name: 'Dr. Moyo', userId: mockProfile.userId },
      } as never);
      expect(result).toEqual(mockProfile);
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the profile', async () => {
      const updated = { ...mockProfile, city: 'Bulawayo' };
      mockPrisma.therapistProfile.update.mockResolvedValue(updated);

      const result = await repo.update(mockProfile.id, { city: 'Bulawayo' });

      expect(result).toEqual(updated);
      expect(mockPrisma.therapistProfile.update).toHaveBeenCalledWith({
        where: { id: mockProfile.id },
        data: { city: 'Bulawayo' },
      });
    });

    it('throws NotFoundException when profile to update does not exist', async () => {
      mockPrisma.therapistProfile.update.mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'P2025' }),
      );
      await expect(repo.update('no-such-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('hard-deletes the profile (no status field on TherapistProfile)', async () => {
      mockPrisma.therapistProfile.delete.mockResolvedValue(mockProfile);
      await repo.softDelete(mockProfile.id);
      expect(mockPrisma.therapistProfile.delete).toHaveBeenCalledWith({
        where: { id: mockProfile.id },
      });
    });

    it('throws NotFoundException when profile to delete does not exist', async () => {
      mockPrisma.therapistProfile.delete.mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'P2025' }),
      );
      await expect(repo.softDelete('no-such-id')).rejects.toThrow(NotFoundException);
    });
  });
});
