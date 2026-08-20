import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RelationshipStatus, UserRole, UserStatus } from '@prisma/client';
import { TherapistClientsService } from '../../../src/modules/therapist-clients/therapist-clients.service';
import { THERAPIST_CLIENT_REPOSITORY } from '../../../src/modules/therapist-clients/therapist-client.repository.interface';
import { USER_REPOSITORY } from '../../../src/modules/users/users.repository.interface';
import { AUDIT_LOG_REPOSITORY } from '../../../src/modules/audit-logs/audit-log.repository.interface';
import { AuditLogService } from '../../../src/modules/audit-logs/audit-log.service';

const mockMeta = { ipAddress: '127.0.0.1', userAgent: 'TestAgent/1.0' };

const THERAPIST_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';
const OTHER_THERAPIST_ID = '00000000-0000-0000-0000-000000000003';

const mockClient = {
  id: CLIENT_ID,
  email: 'client@example.com',
  role: UserRole.CLIENT,
  status: UserStatus.ACTIVE,
};

const mockRelationship = {
  id: 'rel-001',
  therapistId: THERAPIST_ID,
  clientId: CLIENT_ID,
  status: RelationshipStatus.ACTIVE,
  startedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

describe('TherapistClientsService', () => {
  let service: TherapistClientsService;
  let mockRelRepo: {
    create: ReturnType<typeof vi.fn>;
    findById: ReturnType<typeof vi.fn>;
    findByTherapistAndClient: ReturnType<typeof vi.fn>;
    findByTherapist: ReturnType<typeof vi.fn>;
    findByClient: ReturnType<typeof vi.fn>;
    updateStatus: ReturnType<typeof vi.fn>;
  };
  let mockUserRepo: { findById: ReturnType<typeof vi.fn> };
  let mockAuditRepo: { create: ReturnType<typeof vi.fn> };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockRelRepo = {
      create: vi.fn(),
      findById: vi.fn(),
      findByTherapistAndClient: vi.fn(),
      findByTherapist: vi.fn(),
      findByClient: vi.fn(),
      updateStatus: vi.fn(),
    };
    mockUserRepo = { findById: vi.fn() };
    mockAuditRepo = { create: vi.fn().mockResolvedValue({}) };

    const module = await Test.createTestingModule({
      providers: [
        TherapistClientsService,
        AuditLogService,
        { provide: THERAPIST_CLIENT_REPOSITORY, useValue: mockRelRepo },
        { provide: USER_REPOSITORY, useValue: mockUserRepo },
        { provide: AUDIT_LOG_REPOSITORY, useValue: mockAuditRepo },
      ],
    }).compile();

    service = module.get<TherapistClientsService>(TherapistClientsService);
  });

  // ── addClient() ───────────────────────────────────────────────────────────

  describe('addClient()', () => {
    it('creates a relationship between therapist and client', async () => {
      mockUserRepo.findById.mockResolvedValue(mockClient);
      mockRelRepo.findByTherapistAndClient.mockResolvedValue(null);
      mockRelRepo.create.mockResolvedValue(mockRelationship);

      const result = await service.addClient(THERAPIST_ID, CLIENT_ID, mockMeta);

      expect(result).toEqual(mockRelationship);
      expect(mockRelRepo.create).toHaveBeenCalledWith(THERAPIST_ID, CLIENT_ID);
    });

    it('throws NotFoundException when client user does not exist', async () => {
      mockUserRepo.findById.mockResolvedValue(null);

      await expect(service.addClient(THERAPIST_ID, CLIENT_ID, mockMeta)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws BadRequestException when user is not a CLIENT role', async () => {
      mockUserRepo.findById.mockResolvedValue({ ...mockClient, role: UserRole.THERAPIST });

      await expect(service.addClient(THERAPIST_ID, CLIENT_ID, mockMeta)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('throws ConflictException when relationship already exists', async () => {
      mockUserRepo.findById.mockResolvedValue(mockClient);
      mockRelRepo.findByTherapistAndClient.mockResolvedValue(mockRelationship);

      await expect(service.addClient(THERAPIST_ID, CLIENT_ID, mockMeta)).rejects.toThrow(
        ConflictException,
      );
    });

    it('writes an audit log after creation', async () => {
      mockUserRepo.findById.mockResolvedValue(mockClient);
      mockRelRepo.findByTherapistAndClient.mockResolvedValue(null);
      mockRelRepo.create.mockResolvedValue(mockRelationship);

      await service.addClient(THERAPIST_ID, CLIENT_ID, mockMeta);

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'therapist_client.add',
          actorId: THERAPIST_ID,
          resourceType: 'therapist_client',
          resourceId: mockRelationship.id,
        }),
      );
    });
  });

  // ── getMyClients() ────────────────────────────────────────────────────────

  describe('getMyClients()', () => {
    it('returns paginated client relationships for a therapist', async () => {
      const paginated = {
        data: [mockRelationship],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockRelRepo.findByTherapist.mockResolvedValue(paginated);

      const result = await service.getMyClients(THERAPIST_ID, { page: 1, limit: 20 });

      expect(result).toEqual(paginated);
      expect(mockRelRepo.findByTherapist).toHaveBeenCalledWith(THERAPIST_ID, {
        page: 1,
        limit: 20,
      });
    });
  });

  // ── getMyTherapists() ─────────────────────────────────────────────────────

  describe('getMyTherapists()', () => {
    it('returns paginated therapist relationships for a client', async () => {
      const paginated = {
        data: [mockRelationship],
        meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
      };
      mockRelRepo.findByClient.mockResolvedValue(paginated);

      const result = await service.getMyTherapists(CLIENT_ID, { page: 1, limit: 20 });

      expect(result).toEqual(paginated);
      expect(mockRelRepo.findByClient).toHaveBeenCalledWith(CLIENT_ID, { page: 1, limit: 20 });
    });
  });

  // ── updateStatus() ────────────────────────────────────────────────────────

  describe('updateStatus()', () => {
    it('throws NotFoundException when relationship does not exist', async () => {
      mockRelRepo.findById.mockResolvedValue(null);

      await expect(
        service.updateStatus('nonexistent', THERAPIST_ID, RelationshipStatus.PAUSED, mockMeta),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when therapist does not own the relationship', async () => {
      mockRelRepo.findById.mockResolvedValue(mockRelationship);

      await expect(
        service.updateStatus(
          mockRelationship.id,
          OTHER_THERAPIST_ID,
          RelationshipStatus.PAUSED,
          mockMeta,
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('updates and returns the relationship', async () => {
      const updated = { ...mockRelationship, status: RelationshipStatus.PAUSED };
      mockRelRepo.findById.mockResolvedValue(mockRelationship);
      mockRelRepo.updateStatus.mockResolvedValue(updated);

      const result = await service.updateStatus(
        mockRelationship.id,
        THERAPIST_ID,
        RelationshipStatus.PAUSED,
        mockMeta,
      );

      expect(result.status).toBe(RelationshipStatus.PAUSED);
    });

    it('writes an audit log after update', async () => {
      mockRelRepo.findById.mockResolvedValue(mockRelationship);
      mockRelRepo.updateStatus.mockResolvedValue({
        ...mockRelationship,
        status: RelationshipStatus.TERMINATED,
      });

      await service.updateStatus(
        mockRelationship.id,
        THERAPIST_ID,
        RelationshipStatus.TERMINATED,
        mockMeta,
      );

      expect(mockAuditRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'therapist_client.status_update',
          actorId: THERAPIST_ID,
          resourceType: 'therapist_client',
          resourceId: mockRelationship.id,
        }),
      );
    });
  });
});
