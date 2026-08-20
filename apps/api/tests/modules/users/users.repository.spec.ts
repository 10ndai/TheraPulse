import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UserRole, UserStatus } from '@prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { UserRepository } from '../../../src/modules/users/users.repository';

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  passwordHash: '$2b$12$hash',
  role: 'CLIENT' as const,
  status: UserStatus.ACTIVE,
  totpSecret: null,
  totpEnabled: false,
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

const mockPrisma = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
};

describe('UserRepository', () => {
  let repo: UserRepository;

  beforeEach(async () => {
    vi.clearAllMocks();

    const module = await Test.createTestingModule({
      providers: [{ provide: PrismaService, useValue: mockPrisma }, UserRepository],
    }).compile();

    repo = module.get<UserRepository>(UserRepository);
  });

  // ── findById ──────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the user when found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await repo.findById(mockUser.id);
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUser.id },
      });
    });

    it('returns null when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await repo.findById('non-existent-id');
      expect(result).toBeNull();
    });
  });

  // ── findByEmail ───────────────────────────────────────────────────────────

  describe('findByEmail()', () => {
    it('returns the user when found by email', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      const result = await repo.findByEmail('user@example.com');
      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'user@example.com' },
      });
    });

    it('returns null when email not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await repo.findByEmail('nobody@example.com');
      expect(result).toBeNull();
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll()', () => {
    it('returns paginated users with correct meta', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await repo.findAll({}, { page: 1, limit: 20 });

      expect(result.data).toEqual([mockUser]);
      expect(result.meta).toEqual({
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      });
    });

    it('calculates skip correctly for page 2', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(25);

      await repo.findAll({}, { page: 2, limit: 20 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 20, take: 20 }),
      );
    });

    it('returns correct totalPages for partial last page', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockUser]);
      mockPrisma.user.count.mockResolvedValue(21);

      const result = await repo.findAll({}, { page: 1, limit: 20 });

      expect(result.meta.totalPages).toBe(2);
    });
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('creates and returns the new user', async () => {
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const data = {
        email: mockUser.email,
        passwordHash: mockUser.passwordHash,
        role: mockUser.role,
      };
      const result = await repo.create(data);

      expect(result).toEqual(mockUser);
      expect(mockPrisma.user.create).toHaveBeenCalledWith({ data });
    });
  });

  // ── update ────────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('updates and returns the user', async () => {
      const updated = { ...mockUser, status: UserStatus.SUSPENDED };
      mockPrisma.user.update.mockResolvedValue(updated);

      const result = await repo.update(mockUser.id, { status: UserStatus.SUSPENDED });

      expect(result).toEqual(updated);
      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { status: UserStatus.SUSPENDED },
      });
    });

    it('throws NotFoundException when user to update does not exist', async () => {
      mockPrisma.user.update.mockRejectedValue(
        Object.assign(new Error('Record not found'), { code: 'P2025' }),
      );
      await expect(repo.update('non-existent-id', {})).rejects.toThrow(NotFoundException);
    });
  });

  // ── findPendingTherapists ─────────────────────────────────────────────────

  describe('findPendingTherapists()', () => {
    const mockTherapist = { ...mockUser, role: UserRole.THERAPIST, status: UserStatus.PENDING };

    it('queries for THERAPIST role with PENDING status', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockTherapist]);
      mockPrisma.user.count.mockResolvedValue(1);

      await repo.findPendingTherapists({ page: 1, limit: 20 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { role: UserRole.THERAPIST, status: UserStatus.PENDING },
        }),
      );
    });

    it('returns paginated result with correct meta', async () => {
      mockPrisma.user.findMany.mockResolvedValue([mockTherapist]);
      mockPrisma.user.count.mockResolvedValue(1);

      const result = await repo.findPendingTherapists({ page: 1, limit: 20 });

      expect(result.data).toEqual([mockTherapist]);
      expect(result.meta).toEqual({ page: 1, limit: 20, total: 1, totalPages: 1 });
    });

    it('calculates skip correctly for page 2', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(25);

      await repo.findPendingTherapists({ page: 2, limit: 10 });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── softDelete ────────────────────────────────────────────────────────────

  describe('softDelete()', () => {
    it('sets user status to DELETED', async () => {
      mockPrisma.user.update.mockResolvedValue({ ...mockUser, status: UserStatus.DELETED });

      await repo.softDelete(mockUser.id);

      expect(mockPrisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUser.id },
        data: { status: UserStatus.DELETED },
      });
    });

    it('throws NotFoundException when user to delete does not exist', async () => {
      mockPrisma.user.update.mockRejectedValue(
        Object.assign(new Error('Record not found'), { code: 'P2025' }),
      );
      await expect(repo.softDelete('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });
});
