import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Test } from '@nestjs/testing';
import { UserRole, UserStatus } from '@prisma/client';
import { RefreshTokenRepository } from '../../../src/modules/auth/refresh-token.repository';
import { PrismaService } from '../../../src/prisma/prisma.service';

const NOW = new Date('2026-01-01T00:00:00.000Z');
const EXPIRES_AT = new Date('2026-01-08T00:00:00.000Z');

const mockUser = {
  id: '00000000-0000-0000-0000-000000000001',
  email: 'user@example.com',
  passwordHash: '$2b$12$hash',
  role: UserRole.CLIENT,
  status: UserStatus.ACTIVE,
  totpSecret: null,
  totpEnabled: false,
  createdAt: NOW,
  updatedAt: NOW,
};

const mockToken = {
  id: 'aaaaaaaa-0000-0000-0000-000000000001',
  userId: mockUser.id,
  tokenHash: '$2b$12$refreshhash',
  expiresAt: EXPIRES_AT,
  revokedAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

describe('RefreshTokenRepository', () => {
  let repo: RefreshTokenRepository;
  let mockPrisma: {
    refreshToken: {
      create: ReturnType<typeof vi.fn>;
      findUnique: ReturnType<typeof vi.fn>;
      update: ReturnType<typeof vi.fn>;
      updateMany: ReturnType<typeof vi.fn>;
    };
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    mockPrisma = {
      refreshToken: {
        create: vi.fn(),
        findUnique: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
      },
    };

    const module = await Test.createTestingModule({
      providers: [RefreshTokenRepository, { provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    repo = module.get<RefreshTokenRepository>(RefreshTokenRepository);
  });

  // ── create() ──────────────────────────────────────────────────────────────

  describe('create()', () => {
    it('persists a new refresh token record', async () => {
      mockPrisma.refreshToken.create.mockResolvedValue(mockToken);

      const result = await repo.create({
        userId: mockUser.id,
        tokenHash: '$2b$12$refreshhash',
        expiresAt: EXPIRES_AT,
      });

      expect(result).toEqual(mockToken);
      expect(mockPrisma.refreshToken.create).toHaveBeenCalledWith({
        data: {
          userId: mockUser.id,
          tokenHash: '$2b$12$refreshhash',
          expiresAt: EXPIRES_AT,
        },
      });
    });
  });

  // ── findById() ────────────────────────────────────────────────────────────

  describe('findById()', () => {
    it('returns the token when it exists', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(mockToken);

      const result = await repo.findById(mockToken.id);

      expect(result).toEqual(mockToken);
      expect(mockPrisma.refreshToken.findUnique).toHaveBeenCalledWith({
        where: { id: mockToken.id },
      });
    });

    it('returns null when no token matches', async () => {
      mockPrisma.refreshToken.findUnique.mockResolvedValue(null);

      const result = await repo.findById('nonexistent-id');

      expect(result).toBeNull();
    });
  });

  // ── revoke() ──────────────────────────────────────────────────────────────

  describe('revoke()', () => {
    it('sets revokedAt on the specified token', async () => {
      const revokedToken = { ...mockToken, revokedAt: new Date() };
      mockPrisma.refreshToken.update.mockResolvedValue(revokedToken);

      const result = await repo.revoke(mockToken.id);

      expect(result.revokedAt).not.toBeNull();
      expect(mockPrisma.refreshToken.update).toHaveBeenCalledWith({
        where: { id: mockToken.id },
        data: { revokedAt: expect.any(Date) },
      });
    });
  });

  // ── revokeAllForUser() ────────────────────────────────────────────────────

  describe('revokeAllForUser()', () => {
    it('sets revokedAt on all active tokens for the user', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

      await repo.revokeAllForUser(mockUser.id);

      expect(mockPrisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: mockUser.id, revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    });

    it('resolves without error when user has no active tokens', async () => {
      mockPrisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });

      await expect(repo.revokeAllForUser(mockUser.id)).resolves.toBeUndefined();
    });
  });
});
