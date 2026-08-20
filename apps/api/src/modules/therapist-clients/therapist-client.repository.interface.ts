import type { TherapistClient, RelationshipStatus } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';

export const THERAPIST_CLIENT_REPOSITORY = Symbol('ITherapistClientRepository');

export interface TherapistClientWithClient extends TherapistClient {
  client: {
    email: string;
    clientProfile: { name: string | null } | null;
  };
}

export interface ITherapistClientRepository {
  create(therapistId: string, clientId: string): Promise<TherapistClient>;
  findById(id: string): Promise<TherapistClient | null>;
  findByTherapistAndClient(therapistId: string, clientId: string): Promise<TherapistClient | null>;
  findByTherapist(
    therapistId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistClientWithClient>>;
  findByClient(
    clientId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistClient>>;
  updateStatus(id: string, status: RelationshipStatus): Promise<TherapistClient>;
}
