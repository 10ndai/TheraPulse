import type { ClientProfile, Prisma } from '@prisma/client';
import type { BaseRepository } from '../../common/repositories/base.repository.interface';

export const CLIENT_PROFILE_REPOSITORY = Symbol('IClientProfileRepository');

export interface IClientProfileRepository extends BaseRepository<
  ClientProfile,
  Prisma.ClientProfileCreateInput,
  Prisma.ClientProfileUpdateInput
> {
  findByUserId(userId: string): Promise<ClientProfile | null>;
}
