import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ApprovalStatus } from '@prisma/client';
import { DirectoryController } from '../../../src/modules/directory/directory.controller';
import { DirectoryService } from '../../../src/modules/directory/directory.service';

const mockProfiles = [
  {
    id: 'profile-001',
    userId: '00000000-0000-0000-0000-000000000001',
    name: 'Dr. Jane Smith',
    bio: 'CBT specialist',
    specializations: ['CBT'],
    qualifications: ['MSc Psychology'],
    licenseNumber: 'ZW-PSY-001',
    languages: ['English'],
    city: 'Harare',
    province: 'Harare',
    phone: null,
    approvalStatus: ApprovalStatus.APPROVED,
    approvedById: '00000000-0000-0000-0000-000000000099',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  },
];

describe('DirectoryController', () => {
  let controller: DirectoryController;
  let mockService: { searchTherapists: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockService = { searchTherapists: vi.fn() };

    const module = await Test.createTestingModule({
      controllers: [DirectoryController],
      providers: [{ provide: DirectoryService, useValue: mockService }],
    }).compile();

    controller = module.get<DirectoryController>(DirectoryController);
  });

  describe('GET /directory/therapists', () => {
    it('returns success envelope with therapist profiles', async () => {
      mockService.searchTherapists.mockResolvedValue({
        data: mockProfiles,
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.search({});

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfiles);
    });

    it('passes search filters to service', async () => {
      mockService.searchTherapists.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await controller.search({
        name: 'Jane',
        city: 'Harare',
        specialization: 'CBT',
        page: 1,
        limit: 10,
      });

      expect(mockService.searchTherapists).toHaveBeenCalledWith(
        { name: 'Jane', city: 'Harare', specialization: 'CBT' },
        { page: 1, limit: 10 },
      );
    });

    it('defaults page=1, limit=20 when not provided', async () => {
      mockService.searchTherapists.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await controller.search({});

      expect(mockService.searchTherapists).toHaveBeenCalledWith(expect.any(Object), {
        page: 1,
        limit: 20,
      });
    });

    it('returns pagination meta', async () => {
      const meta = { page: 1, limit: 20, total: 5, totalPages: 1 };
      mockService.searchTherapists.mockResolvedValue({ data: mockProfiles, meta });

      const result = await controller.search({});

      expect(result.meta).toEqual(meta);
    });
  });
});
