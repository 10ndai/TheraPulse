import type { PaginatedResult } from '@therapulse/shared';

// Re-export so repository interfaces can import from a single location
export type { PaginatedResult };

export interface PaginationOptions {
  page: number;
  limit: number;
}

/**
 * Base contract that every domain repository must satisfy.
 * Enforces Liskov Substitution — every concrete implementation is
 * substitutable for this interface wherever a repository is expected.
 *
 * T  — the entity type (e.g. User, TherapistProfile)
 * C  — the create-input type
 * U  — the update-input type (typically Partial<C>)
 *
 * findAll is intentionally omitted: filter shapes vary per repository
 * and each interface defines its own findAll signature.
 */
export interface BaseRepository<T, C, U> {
  findById(id: string): Promise<T | null>;
  create(data: C): Promise<T>;
  update(id: string, data: U): Promise<T>;
  /** For User: sets status=DELETED. For profiles: hard-deletes the record. */
  softDelete(id: string): Promise<void>;
}
