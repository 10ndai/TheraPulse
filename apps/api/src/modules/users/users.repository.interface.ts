import type { User, Prisma, UserRole } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type {
  BaseRepository,
  PaginationOptions,
} from '../../common/repositories/base.repository.interface';

export const USER_REPOSITORY = Symbol('IUserRepository');

export interface UserFilters {
  role?: UserRole;
}

export interface IUserRepository extends BaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput
> {
  /** Look up a user by their unique email address. */
  findByEmail(email: string): Promise<User | null>;
  /** Returns a paginated list of THERAPIST users with PENDING status. */
  findPendingTherapists(options: PaginationOptions): Promise<PaginatedResult<User>>;
  /** Returns paginated users matching optional role filter. */
  findAll(filters?: UserFilters, options?: PaginationOptions): Promise<PaginatedResult<User>>;
}
