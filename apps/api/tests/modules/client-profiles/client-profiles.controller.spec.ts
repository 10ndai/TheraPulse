import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { ClientProfilesController } from '../../../src/modules/client-profiles/client-profiles.controller';
import { ClientProfilesService } from '../../../src/modules/client-profiles/client-profiles.service';
import type { Request } from 'express';

const CLIENT_ID = '00000000-0000-0000-0000-000000000001';
const ADMIN_ID = '00000000-0000-0000-0000-000000000099';

const mockClientRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: CLIENT_ID, role: UserRole.CLIENT },
} as unknown as Request & { user: { sub: string; role: UserRole } };

const mockAdminRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: ADMIN_ID, role: UserRole.ADMIN },
} as unknown as Request & { user: { sub: string; role: UserRole } };

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
};

describe('ClientProfilesController', () => {
  let controller: ClientProfilesController;
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
      controllers: [ClientProfilesController],
      providers: [{ provide: ClientProfilesService, useValue: mockService }],
    }).compile();

    controller = module.get<ClientProfilesController>(ClientProfilesController);
  });

  // ── POST /client-profiles ─────────────────────────────────────────────────

  describe('POST /client-profiles', () => {
    it('returns success envelope with created profile', async () => {
      mockService.createProfile.mockResolvedValue(mockProfile);

      const result = await controller.create(mockCreateDto, mockClientRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it('calls service with userId from token and dto', async () => {
      mockService.createProfile.mockResolvedValue(mockProfile);

      await controller.create(mockCreateDto, mockClientRequest);

      expect(mockService.createProfile).toHaveBeenCalledWith(
        CLIENT_ID,
        mockCreateDto,
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });

    it('propagates ConflictException when profile already exists', async () => {
      mockService.createProfile.mockRejectedValue(new ConflictException());

      await expect(controller.create(mockCreateDto, mockClientRequest)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  // ── GET /client-profiles/me ───────────────────────────────────────────────

  describe('GET /client-profiles/me', () => {
    it('returns success envelope with own profile', async () => {
      mockService.getOwnProfile.mockResolvedValue(mockProfile);

      const result = await controller.getMe(mockClientRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockProfile);
    });

    it('calls service with userId from token', async () => {
      mockService.getOwnProfile.mockResolvedValue(mockProfile);

      await controller.getMe(mockClientRequest);

      expect(mockService.getOwnProfile).toHaveBeenCalledWith(CLIENT_ID);
    });

    it('propagates NotFoundException when profile not found', async () => {
      mockService.getOwnProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.getMe(mockClientRequest)).rejects.toThrow(NotFoundException);
    });
  });

  // ── GET /client-profiles/:id ──────────────────────────────────────────────

  describe('GET /client-profiles/:id', () => {
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

    it('propagates ForbiddenException for wrong client', async () => {
      mockService.getProfileById.mockRejectedValue(new ForbiddenException());

      await expect(controller.getById(mockProfile.id, mockClientRequest)).rejects.toThrow(
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

  // ── PATCH /client-profiles/me ─────────────────────────────────────────────

  describe('PATCH /client-profiles/me', () => {
    it('returns success envelope with updated profile', async () => {
      const updated = { ...mockProfile, name: 'Updated Name' };
      mockService.updateOwnProfile.mockResolvedValue(updated);

      const result = await controller.updateMe({ name: 'Updated Name' }, mockClientRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('calls service with userId from token and dto', async () => {
      mockService.updateOwnProfile.mockResolvedValue(mockProfile);

      await controller.updateMe({ city: 'Bulawayo' }, mockClientRequest);

      expect(mockService.updateOwnProfile).toHaveBeenCalledWith(
        CLIENT_ID,
        { city: 'Bulawayo' },
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });

    it('propagates NotFoundException when profile not found', async () => {
      mockService.updateOwnProfile.mockRejectedValue(new NotFoundException());

      await expect(controller.updateMe({ name: 'Updated' }, mockClientRequest)).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
