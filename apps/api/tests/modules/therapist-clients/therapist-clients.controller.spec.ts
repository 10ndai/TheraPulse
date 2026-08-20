import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RelationshipStatus, UserRole } from '@prisma/client';
import { TherapistClientsController } from '../../../src/modules/therapist-clients/therapist-clients.controller';
import { TherapistClientsService } from '../../../src/modules/therapist-clients/therapist-clients.service';
import type { Request } from 'express';

const THERAPIST_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';

const mockTherapistRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: THERAPIST_ID, role: UserRole.THERAPIST },
} as unknown as Request & { user: { sub: string; role: UserRole } };

const mockClientRequest = {
  ip: '127.0.0.1',
  headers: { 'user-agent': 'TestAgent/1.0' },
  user: { sub: CLIENT_ID, role: UserRole.CLIENT },
} as unknown as Request & { user: { sub: string; role: UserRole } };

const mockRelationship = {
  id: 'rel-001',
  therapistId: THERAPIST_ID,
  clientId: CLIENT_ID,
  status: RelationshipStatus.ACTIVE,
  startedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

/**
 * findByTherapist() eager-loads the client relation, so the my-clients
 * endpoint receives TherapistClientWithClient and flattens it for the UI.
 */
const mockRelationshipWithClient = {
  ...mockRelationship,
  client: {
    email: 'client@example.com',
    clientProfile: { name: 'Tendai Moyo' },
  },
};

describe('TherapistClientsController', () => {
  let controller: TherapistClientsController;
  let mockService: {
    addClient: ReturnType<typeof vi.fn>;
    getMyClients: ReturnType<typeof vi.fn>;
    getMyTherapists: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockService = {
      addClient: vi.fn(),
      getMyClients: vi.fn(),
      getMyTherapists: vi.fn(),
      updateStatus: vi.fn(),
    };

    const module = await Test.createTestingModule({
      controllers: [TherapistClientsController],
      providers: [{ provide: TherapistClientsService, useValue: mockService }],
    }).compile();

    controller = module.get<TherapistClientsController>(TherapistClientsController);
  });

  // ── POST /relationships ───────────────────────────────────────────────────

  describe('POST /relationships', () => {
    it('returns success envelope with created relationship', async () => {
      mockService.addClient.mockResolvedValue(mockRelationship);

      const result = await controller.addClient({ clientId: CLIENT_ID }, mockTherapistRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockRelationship);
    });

    it('calls service with therapistId from token and clientId from body', async () => {
      mockService.addClient.mockResolvedValue(mockRelationship);

      await controller.addClient({ clientId: CLIENT_ID }, mockTherapistRequest);

      expect(mockService.addClient).toHaveBeenCalledWith(
        THERAPIST_ID,
        CLIENT_ID,
        expect.objectContaining({ ipAddress: '127.0.0.1' }),
      );
    });

    it('propagates ConflictException when relationship already exists', async () => {
      mockService.addClient.mockRejectedValue(new ConflictException());

      await expect(
        controller.addClient({ clientId: CLIENT_ID }, mockTherapistRequest),
      ).rejects.toThrow(ConflictException);
    });

    it('propagates BadRequestException when clientId is not a CLIENT', async () => {
      mockService.addClient.mockRejectedValue(new BadRequestException());

      await expect(
        controller.addClient({ clientId: CLIENT_ID }, mockTherapistRequest),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ── GET /relationships/my-clients ─────────────────────────────────────────

  describe('GET /relationships/my-clients', () => {
    it('returns paginated client list flattened for the UI', async () => {
      const paginated = {
        data: [mockRelationshipWithClient],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockService.getMyClients.mockResolvedValue(paginated);

      const result = await controller.getMyClients({}, mockTherapistRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([
        { id: CLIENT_ID, name: 'Tendai Moyo', email: 'client@example.com' },
      ]);
      expect(result.meta).toEqual(paginated.meta);
    });

    it('returns a null name when the client has no profile yet', async () => {
      mockService.getMyClients.mockResolvedValue({
        data: [
          {
            ...mockRelationshipWithClient,
            client: { email: 'client@example.com', clientProfile: null },
          },
        ],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      });

      const result = await controller.getMyClients({}, mockTherapistRequest);

      expect(result.data).toEqual([{ id: CLIENT_ID, name: null, email: 'client@example.com' }]);
    });

    it('calls service with therapistId from token', async () => {
      mockService.getMyClients.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await controller.getMyClients({}, mockTherapistRequest);

      expect(mockService.getMyClients).toHaveBeenCalledWith(THERAPIST_ID, expect.any(Object));
    });
  });

  // ── GET /relationships/my-therapists ──────────────────────────────────────

  describe('GET /relationships/my-therapists', () => {
    it('returns paginated therapist list for client', async () => {
      const paginated = {
        data: [mockRelationship],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockService.getMyTherapists.mockResolvedValue(paginated);

      const result = await controller.getMyTherapists({}, mockClientRequest);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(paginated.data);
    });

    it('calls service with clientId from token', async () => {
      mockService.getMyTherapists.mockResolvedValue({
        data: [],
        meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
      });

      await controller.getMyTherapists({}, mockClientRequest);

      expect(mockService.getMyTherapists).toHaveBeenCalledWith(CLIENT_ID, expect.any(Object));
    });
  });

  // ── PATCH /relationships/:id/status ───────────────────────────────────────

  describe('PATCH /relationships/:id/status', () => {
    it('returns success envelope with updated relationship', async () => {
      const updated = { ...mockRelationship, status: RelationshipStatus.PAUSED };
      mockService.updateStatus.mockResolvedValue(updated);

      const result = await controller.updateStatus(
        mockRelationship.id,
        { status: RelationshipStatus.PAUSED },
        mockTherapistRequest,
      );

      expect(result.success).toBe(true);
      expect(result.data).toEqual(updated);
    });

    it('calls service with relationshipId, therapistId, and status', async () => {
      mockService.updateStatus.mockResolvedValue(mockRelationship);

      await controller.updateStatus(
        mockRelationship.id,
        { status: RelationshipStatus.TERMINATED },
        mockTherapistRequest,
      );

      expect(mockService.updateStatus).toHaveBeenCalledWith(
        mockRelationship.id,
        THERAPIST_ID,
        RelationshipStatus.TERMINATED,
        expect.any(Object),
      );
    });

    it('propagates ForbiddenException when therapist does not own the relationship', async () => {
      mockService.updateStatus.mockRejectedValue(new ForbiddenException());

      await expect(
        controller.updateStatus(
          mockRelationship.id,
          { status: RelationshipStatus.PAUSED },
          mockTherapistRequest,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('propagates NotFoundException when relationship does not exist', async () => {
      mockService.updateStatus.mockRejectedValue(new NotFoundException());

      await expect(
        controller.updateStatus(
          'nonexistent',
          { status: RelationshipStatus.PAUSED },
          mockTherapistRequest,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
