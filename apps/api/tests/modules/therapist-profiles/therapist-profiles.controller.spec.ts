import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, UserRole } from '@prisma/client';
import { TherapistProfilesController } from '../../../src/modules/therapist-profiles/therapist-profiles.controller';
import { TherapistProfilesService } from '../../../src/modules/therapist-profiles/therapist-profiles.service';
import type { Request } from 'express';

const THERAPIST_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000099';

const mockTherapistRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: THERAPIST_ID, role: UserRole.THERAPIST },
} as unknown as Request & { user: { sub: string; role: UserRole } };

const mockAdminRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: ADMIN_ID, role: UserRole.ADMIN },
} as unknown as Request & { user: { sub: string; role: UserRole } };

const mockProfile = {
  id: 'profile-001',
  userId: THERAPIST_ID,
  name: 'Dr. Jane Smith',
  bio: 'Experienced therapist',
  specializations: ['CBT'],
  qualifications: ['MSc Psychology'],
  licenseNumber: 'ZW-PSY-001',
  languages: ['English'],
  city: 'Harare',
  province: 'Harare',
  phone: null,
  approvalStatus: ApprovalStatus.PENDING,
  approvedById: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockCreateDto = {
  name: 'Dr. Jane Smith',
  specializations: ['CBT'],
  qualifications: ['MSc Psychology'],
  languages: ['English'],
};

describe('TherapistProfilesController', () => {
  let controller: TherapistProfilesController;
  let mockService: {
    createProfile: ReturnType<typeof vi.fn>;
    getOwnProfile: ReturnType<typeof vi.fn>;
    getProfileById: ReturnType<typeof vi.fn>;
    updateOwnProfile: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockService = {
      createProfile: vi.fn(),
      getOwnProfile: vi.fn(),
      getProfileById: vi.fn(),
      updateOwnProfile: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [TherapistProfilesController],
      providers: [{ provide: TherapistProfilesService, useValue: mockService }],
    }).compile();

    controller = module.get<TherapistProfilesController>(TherapistProfilesController);
  });

  // ── POST /therapist-profiles ───────────────────────────────────────────────

  describe('POST /therapist-profiles', () => {
    it('returns success envelope with created profile', async () => {
      mockService.createProfile.mockResolvedValue(mockProfile);

      const result = await controller.create(mockCreateDto, mockTherapistRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it('calls service with userId from token and dto', async () => {
      mockService.createProfile.mockResolvedValue(mockProfile);

      await controller.create(mockCreateDto, mockTherapistRequest);

      expect(mockService.createProfile).toHaveBeenCalledWith(
        THERAPIST_ID,
        mockCreateDto,
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });

    it('propagates ConflictException when profile already exists', async () => {
      mockService.createProfile.mockRejectedValue(new ConflictException());

      await expect(controller.create(mockCreateDto, mockTherapistRequest)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── GET /therapist-profiles/me ────────────────────────────────────────────

  describe('GET /therapist-profiles/me', () => {
    it('returns success envelope with own profile', async () => {
      mockService.getOwnProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMe(mockTherapistRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it('calls service with userId from token', async () => {
      mockService.getOwnProfile.mockResolvedValue(mockProfile);

      await controller.getMe(mockTherapistRequest);

      expect(mockService.getOwnProfile).toHaveBeenCalledWith(THERAPIST_ID);
    });

    it('propagates NotFoundException when profile not found', async () => {
      mockService.getOwnProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.getMe(mockTherapistRequest)).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /therapist-profiles/:id ───────────────────────────────────────────

  describe('GET /therapist-profiles/:id', () => {
    it('returns profile for admin', async () => {
      mockService.getProfileById.mockResolvedValue(mockProfile);

      const result = await controller.getById(mockProfile.id, mockAdminRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it('calls service with profileId, actorId, and role', async () => {
      mockService.getProfileById.mockResolvedValue(mockProfile);

      await controller.getById(mockProfile.id, mockAdminRequest);

      expect(mockService.getProfileById).toHaveBeenCalledWith(
        mockProfile.id,
        ADMIN_ID,
        UserRole.ADMIN,
      );
    });

    it('propagates ForbiddenException for wrong therapist', async () => {
      mockService.getProfileById.mockRejectedValue(new ForbiddenException());

      await expect(controller.getById(mockProfile.id, mockTherapistRequest)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('propagates NotFoundException when profile not found', async () => {
      mockService.getProfileById.mockRejectedValue(new NotFoundException());

      await expect(controller.getById('nonexistent', mockAdminRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── PATCH /therapist-profiles/me ──────────────────────────────────────────

  describe('PATCH /therapist-profiles/me', () => {
    it('returns success envelope with updated profile', async () => {
      const updated = { ...mockProfile, name: 'Updated Name' };
      mockService.updateOwnProfile.mockResolvedValue(updated);

      const result = await controller.updateMe({ name: 'Updated Name' }, mockTherapistRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('calls service with userId from token and dto', async () => {
      mockService.updateOwnProfile.mockResolvedValue(mockProfile);

      await controller.updateMe({ city: 'Bulawayo' }, mockTherapistRequest);

      expect(mockService.updateOwnProfile).toHaveBeenCalledWith(
        THERAPIST_ID,
        { city: 'Bulawayo' },
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });

    it('propagates NotFoundException when profile not found', async () => {
      mockService.updateOwnProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.updateMe({ name: 'Updated' }, mockTherapistRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
