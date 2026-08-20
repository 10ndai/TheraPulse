import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ApprovalStatus, UserRole } from '@prisma/client';
import { TherapistProfilesService } from '../../../src/modules/therapist-profiles/therapist-profiles.service';
import { THERAPIST_PROFILE_REPOSITORY } from '../../../src/modules/therapist-profiles/therapist-profiles.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../../../src/modules/audit-logs/audit-log.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

const THERAPIST_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000099';
const OTHER_THERAPIST_ID = '00000000-0000-0000-0000-000000000002';

const mockProfile = {
  id: 'profile-00000000-0000-0000-0000-000000000001',
  userId: THERAPIST_ID,
  name: 'Dr. Jane Smith',
  bio: 'Experienced therapist',
  specializations: ['CBT', 'EMDR'],
  qualifications: ['MSc Psychology'],
  licenseNumber: 'ZW-PSY-001',
  languages: ['English', 'Shona'],
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
  bio: 'Experienced therapist',
  specializations: ['CBT', 'EMDR'],
  qualifications: ['MSc Psychology'],
  licenseNumber: 'ZW-PSY-001',
  languages: ['English', 'Shona'],
  city: 'Harare',
  province: 'Harare',
};

describe('TherapistProfilesService', () => {
  let service: TherapistProfilesService;
  let mockProfileRepo: {
    findByUserId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findAll: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockProfileRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      findAll: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        TherapistProfilesService,
        AuditLogService,
        { provide: THERAPIST_PROFILE_REPOSITORY, useValue: mockProfileRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<TherapistProfilesService>(TherapistProfilesService);
  });

  // ── createProfile() ───────────────────────────────────────────────────────

  describe('createProfile()', () => {
    it('creates and returns the therapist profile', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      const result = await service.createProfile(THERAPIST_ID, mockCreateDto, mockMeta);

      expect(result).toEqual(mockProfile);
    });

    it('throws ConflictException when profile already exists', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);

      await expect(service.createProfile(THERAPIST_ID, mockCreateDto, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates profile with correct userId', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      await service.createProfile(THERAPIST_ID, mockCreateDto, mockMeta);

      expect(mockProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { connect: { id: THERAPIST_ID } },
        }),
      );
    });

    it('does NOT allow setting approvalStatus in create DTO', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      await service.createProfile(THERAPIST_ID, mockCreateDto, mockMeta);

      expect(mockProfileRepo.create).not.toHaveBeenCalledWith(
        expect.objectContaining({ approvalStatus: expect.anything() }),
      );
    });

    it('writes an audit log after creation', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      await service.createProfile(THERAPIST_ID, mockCreateDto, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'therapist_profile.create',
          actorId: THERAPIST_ID,
          resourceType: 'therapist_profile',
          resourceId: mockProfile.id,
          ipAddress: '127.0.0.1',
        }),
      );
    });
  });

  // ── getOwnProfile() ───────────────────────────────────────────────────────

  describe('getOwnProfile()', () => {
    it('returns the therapist profile for the given userId', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);

      const result = await service.getOwnProfile(THERAPIST_ID);

      expect(result).toEqual(mockProfile);
      expect(mockProfileRepo.findByUserId).toHaveBeenCalledWith(THERAPIST_ID);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);

      await expect(service.getOwnProfile(THERAPIST_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getProfileById() ──────────────────────────────────────────────────────

  describe('getProfileById()', () => {
    it('returns the profile when admin requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfileById(mockProfile.id, ADMIN_ID, UserRole.ADMIN);

      expect(result).toEqual(mockProfile);
    });

    it('returns the profile when the owning therapist requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfileById(mockProfile.id, THERAPIST_ID, UserRole.THERAPIST);

      expect(result).toEqual(mockProfile);
    });

    it('throws ForbiddenException when a different therapist requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      await expect(
        service.getProfileById(mockProfile.id, OTHER_THERAPIST_ID, UserRole.THERAPIST),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findById.mockResolvedValue(null);

      await expect(service.getProfileById('nonexistent', ADMIN_ID, UserRole.ADMIN)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ── updateOwnProfile() ────────────────────────────────────────────────────

  describe('updateOwnProfile()', () => {
    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);

      await expect(
        service.updateOwnProfile(THERAPIST_ID, { name: 'Updated' }, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates and returns the profile', async () => {
      const updated = { ...mockProfile, name: 'Updated Name' };
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue(updated);

      const result = await service.updateOwnProfile(
        THERAPIST_ID,
        { name: 'Updated Name' },
        mockMeta,
      );

      expect(result).toEqual(updated);
    });

    it('calls repository update with profile id and data', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue(mockProfile);

      await service.updateOwnProfile(THERAPIST_ID, { city: 'Bulawayo' }, mockMeta);

      expect(mockProfileRepo.update).toHaveBeenCalledWith(
        mockProfile.id,
        expect.objectContaining({ city: 'Bulawayo' }),
      );
    });

    it('does NOT allow updating approvalStatus via this method', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue(mockProfile);

      await service.updateOwnProfile(THERAPIST_ID, { city: 'Bulawayo' }, mockMeta);

      expect(mockProfileRepo.update).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ approvalStatus: expect.anything() }),
      );
    });

    it('writes an audit log after update', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue({ ...mockProfile, name: 'Updated' });

      await service.updateOwnProfile(THERAPIST_ID, { name: 'Updated' }, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'therapist_profile.update',
          actorId: THERAPIST_ID,
          resourceType: 'therapist_profile',
          resourceId: mockProfile.id,
        }),
      );
    });
  });
});
