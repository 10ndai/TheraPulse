import type { RefreshToken } from '@prisma/client';

export const REFRESH_TOKEN_REPOSITORY = Symbol('IRefreshTokenRepository');

export interface CreateRefreshTokenInput {
  userId: string;
  tokenHash: string;
  expiresAt: Date;
}

export interface IRefreshTokenRepository {
  create(data: CreateRefreshTokenInput): Promise<RefreshToken>;
  findById(id: string): Promise<RefreshToken | null>;
  /** Sets revokedAt on the given token record. */
  revoke(id: string): Promise<RefreshToken>;
  /** Sets revokedAt on every active (non-revoked) token belonging to this user. */
  revokeAllForUser(userId: string): Promise<void>;
}
