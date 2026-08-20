import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { RelationshipStatus } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TherapistClientRepository } from '../../../src/modules/therapist-clients/therapist-client.repository';

const THERAPIST_ID = '00000000-0000-0000-0000-000000000001';
const CLIENT_ID = '00000000-0000-0000-0000-000000000002';

const mockRelationship = {
  id: 'rel-00000000-0000-0000-0000-000000000001',
  therapistId: THERAPIST_ID,
  clientId: CLIENT_ID,
  status: RelationshipStatus.ACTIVE,
  startedAt: new Date('2026-01-01'),
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  therapistClient: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
};

describe('TherapistClientRepository', () => {
  let repo: TherapistClientRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: mockPrisma }, TherapistClientRepository],
    }).compile();

    repo = module.get<TherapistClientRepository>(TherapistClientRepository);
  });

  describe('create()', () => {
    it('creates relationship with ACTIVE status', async () => {
      mockPrisma.therapistClient.create.mockResolvedValue(mockRelationship);

      const result = await repo.create(THERAPIST_ID, CLIENT_ID);

      expect(result).toEqual(mockRelationship);
      expect(mockPrisma.therapistClient.create).toHaveBeenCalledWith({
        data: {
          therapistId: THERAPIST_ID,
          clientId: CLIENT_ID,
          status: RelationshipStatus.ACTIVE,
        },
      });
    });
  });

  describe('findById()', () => {
    it('returns relationship when found', async () => {
      mockPrisma.therapistClient.findUnique.mockResolvedValue(mockRelationship);

      const result = await repo.findById(mockRelationship.id);

      expect(result).toEqual(mockRelationship);
      expect(mockPrisma.therapistClient.findUnique).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.therapistClient.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findByTherapistAndClient()', () => {
    it('queries by compound unique key', async () => {
      mockPrisma.therapistClient.findUnique.mockResolvedValue(mockRelationship);

      await repo.findByTherapistAndClient(THERAPIST_ID, CLIENT_ID);

      expect(mockPrisma.therapistClient.findUnique).toHaveBeenCalledWith({
        where: { therapistId_clientId: { therapistId: THERAPIST_ID, clientId: CLIENT_ID } },
      });
    });

    it('returns null when not found', async () => {
      mockPrisma.therapistClient.findUnique.mockResolvedValue(null);

      const result = await repo.findByTherapistAndClient(THERAPIST_ID, CLIENT_ID);

      expect(result).toBeNull();
    });
  });

  describe('findByTherapist()', () => {
    it('returns paginated results filtered by therapistId', async () => {
      mockPrisma.therapistClient.findMany.mockResolvedValue([mockRelationship]);
      mockPrisma.therapistClient.count.mockResolvedValue(1);

      const result = await repo.findByTherapist(THERAPIST_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockRelationship]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
      expect(mockPrisma.therapistClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { therapistId: THERAPIST_ID } }),
      );
    });
  });

  describe('findByClient()', () => {
    it('returns paginated results filtered by clientId', async () => {
      mockPrisma.therapistClient.findMany.mockResolvedValue([mockRelationship]);
      mockPrisma.therapistClient.count.mockResolvedValue(1);

      const result = await repo.findByClient(CLIENT_ID, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockRelationship]);
      expect(mockPrisma.therapistClient.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { clientId: CLIENT_ID } }),
      );
    });
  });

  describe('updateStatus()', () => {
    it('updates relationship status', async () => {
      const updated = { ...mockRelationship, status: RelationshipStatus.PAUSED };
      mockPrisma.therapistClient.update.mockResolvedValue(updated);

      const result = await repo.updateStatus(mockRelationship.id, RelationshipStatus.PAUSED);

      expect(result).toEqual(updated);
      expect(mockPrisma.therapistClient.update).toHaveBeenCalledWith({
        where: { id: mockRelationship.id },
        data: { status: RelationshipStatus.PAUSED },
      });
    });
  });
});
