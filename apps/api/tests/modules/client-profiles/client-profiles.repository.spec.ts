import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ClientProfileRepository } from '../../../src/modules/client-profiles/client-profiles.repository';

const mockProfile = {
  id: '00000000-0000-0000-0000-000000000020',
  userId: '00000000-0000-0000-0000-000000000002',
  name: 'Blessing Chikwanda',
  city: 'London',
  province: null,
  dateOfBirth: null,
  phone: null,
  emergencyContact: null,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  clientProfile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

describe('ClientProfileRepository', () => {
  let repo: ClientProfileRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: mockPrisma }, ClientProfileRepository],
    }).compile();

    repo = module.get<ClientProfileRepository>(ClientProfileRepository);
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the profile when found', async () => {
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockProfile);
      const result = await repo.findById(mockProfile.id);
      expect(result).toEqual(mockProfile);
    });

    it('returns null when not found', async () => {
      mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
      expect(await repo.findById('no-such-id')).toBeNull();
    });
  });

  // ── findByUserId ──────────────────────────────────────────────────────────

  describe('findByUserId()', () => {
    it('looks up by userId field', async () => {
      mockPrisma.clientProfile.findUnique.mockResolvedValue(mockProfile);
      const result = await repo.findByUserId(mockProfile.userId);
      expect(result).toEqual(mockProfile);
      expect(mockPrisma.clientProfile.findUnique).toHaveBeenCalledWith({
        where: { userId: mockProfile.userId },
      });
    });

    it('returns null when no profile exists for the user', async () => {
      mockPrisma.clientProfile.findUnique.mockResolvedValue(null);
      expect(await repo.findByUserId('no-such-user-id')).toBeNull();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated profiles', async () => {
      mockPrisma.clientProfile.findMany.mockResolvedValue([mockProfile]);
      mockPrisma.clientProfile.count.mockResolvedValue(1);

      const result = await repo.findAll({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockProfile]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns the profile', async () => {
      mockPrisma.clientProfile.create.mockResolvedValue(mockProfile);
      const data = { name: 'Blessing Chikwanda', userId: mockProfile.userId };
      const result = await repo.create(data);
      expect(result).toEqual(mockProfile);
      expect(mockPrisma.clientProfile.create).toHaveBeenCalledWith({ data });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the profile', async () => {
      const updated = { ...mockProfile, city: 'Harare' };
      mockPrisma.clientProfile.update.mockResolvedValue(updated);

      const result = await repo.update(mockProfile.id, { city: 'Harare' });

      expect(result).toEqual(updated);
      expect(mockPrisma.clientProfile.update).toHaveBeenCalledWith({
        where: { id: mockProfile.id },
        data: { city: 'Harare' },
      });
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.clientProfile.update.mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'P2025' }),
      );
      await expect(repo.update('no-such-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('hard-deletes the profile', async () => {
      mockPrisma.clientProfile.delete.mockResolvedValue(mockProfile);
      await repo.softDelete(mockProfile.id);
      expect(mockPrisma.clientProfile.delete).toHaveBeenCalledWith({
        where: { id: mockProfile.id },
      });
    });

    it('throws NotFoundException when profile does not exist', async () => {
      mockPrisma.clientProfile.delete.mockRejectedValue(
        Object.assign(new Error('not found'), { code: 'P2025' }),
      );
      await expect(repo.softDelete('no-such-id')).rejects.toThrow(NotFoundException);
    });
  });
});
