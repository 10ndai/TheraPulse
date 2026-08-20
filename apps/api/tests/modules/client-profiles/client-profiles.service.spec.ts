import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ClientProfilesService } from '../../../src/modules/client-profiles/client-profiles.service';
import { CLIENT_PROFILE_REPOSITORY } from '../../../src/modules/client-profiles/client-profiles.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../../../src/modules/audit-logs/audit-log.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

const CLIENT_ID = '00000000-0000-0000-0000-000000000001';
const OTHER_CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const THERAPIST_ID = '00000000-0000-0000-0000-000000000010';
const ADMIN_ID = '00000000-0000-0000-0000-000000000099';

const mockProfile = {
  id: 'client-profile-001',
  userId: CLIENT_ID,
  name: 'John Doe',
  city: 'Harare',
  province: 'Harare',
  dateOfBirth: null,
  phone: null,
  emergencyContact: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockCreateDto = {
  name: 'John Doe',
  city: 'Harare',
  province: 'Harare',
};

describe('ClientProfilesService', () => {
  let service: ClientProfilesService;
  let mockProfileRepo: {
    findByUserId: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockProfileRepo = {
      findByUserId: vi.fn(),
      findById: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        ClientProfilesService,
        AuditLogService,
        { provide: CLIENT_PROFILE_REPOSITORY, useValue: mockProfileRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<ClientProfilesService>(ClientProfilesService);
  });

  // ── createProfile() ───────────────────────────────────────────────────────

  describe('createProfile()', () => {
    it('creates and returns the client profile', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      const result = await service.createProfile(CLIENT_ID, mockCreateDto, mockMeta);

      expect(result).toEqual(mockProfile);
    });

    it('throws ConflictException when profile already exists', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);

      await expect(service.createProfile(CLIENT_ID, mockCreateDto, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });

    it('creates profile with correct userId', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      await service.createProfile(CLIENT_ID, mockCreateDto, mockMeta);

      expect(mockProfileRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user: { connect: { id: CLIENT_ID } },
        }),
      );
    });

    it('writes an audit log after creation', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);
      mockProfileRepo.create.mockResolvedValue(mockProfile);

      await service.createProfile(CLIENT_ID, mockCreateDto, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'client_profile.create',
          actorId: CLIENT_ID,
          resourceType: 'client_profile',
          resourceId: mockProfile.id,
          ipAddress: '127.0.0.1',
        }),
      );
    });
  });

  // ── getOwnProfile() ───────────────────────────────────────────────────────

  describe('getOwnProfile()', () => {
    it('returns the client profile for the given userId', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);

      const result = await service.getOwnProfile(CLIENT_ID);

      expect(result).toEqual(mockProfile);
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(null);

      await expect(service.getOwnProfile(CLIENT_ID)).rejects.toThrow(NotFoundException);
    });
  });

  // ── getProfileById() ──────────────────────────────────────────────────────

  describe('getProfileById()', () => {
    it('returns the profile when admin requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfileById(mockProfile.id, ADMIN_ID, UserRole.ADMIN);

      expect(result).toEqual(mockProfile);
    });

    it('returns the profile when the owning client requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfileById(mockProfile.id, CLIENT_ID, UserRole.CLIENT);

      expect(result).toEqual(mockProfile);
    });

    it('returns the profile when a therapist requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      const result = await service.getProfileById(mockProfile.id, THERAPIST_ID, UserRole.THERAPIST);

      expect(result).toEqual(mockProfile);
    });

    it('throws ForbiddenException when a different client requests', async () => {
      mockProfileRepo.findById.mockResolvedValue(mockProfile);

      await expect(
        service.getProfileById(mockProfile.id, OTHER_CLIENT_ID, UserRole.CLIENT),
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
        service.updateOwnProfile(CLIENT_ID, { name: 'Updated' }, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates and returns the profile', async () => {
      const updated = { ...mockProfile, name: 'Updated Name' };
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue(updated);

      const result = await service.updateOwnProfile(CLIENT_ID, { name: 'Updated Name' }, mockMeta);

      expect(result).toEqual(updated);
    });

    it('calls repository update with profile id and data', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue(mockProfile);

      await service.updateOwnProfile(CLIENT_ID, { city: 'Bulawayo' }, mockMeta);

      expect(mockProfileRepo.update).toHaveBeenCalledWith(
        mockProfile.id,
        expect.objectContaining({ city: 'Bulawayo' }),
      );
    });

    it('writes an audit log after update', async () => {
      mockProfileRepo.findByUserId.mockResolvedValue(mockProfile);
      mockProfileRepo.update.mockResolvedValue({ ...mockProfile, name: 'Updated' });

      await service.updateOwnProfile(CLIENT_ID, { name: 'Updated' }, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'client_profile.update',
          actorId: CLIENT_ID,
          resourceType: 'client_profile',
          resourceId: mockProfile.id,
        }),
      );
    });
  });
});
