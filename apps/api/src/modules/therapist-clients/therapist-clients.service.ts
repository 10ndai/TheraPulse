import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type TherapistClient, UserRole, type RelationshipStatus } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { TherapistClientWithClient } from './therapist-client.repository.interface';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
import { THERAPIST_CLIENT_REPOSITORY } from './therapist-client.repository.interface';
import type { ITherapistClientRepository } from './therapist-client.repository.interface';
import { USER_REPOSITORY } from '../users/users.repository.interface';
import type { IUserRepository } from '../users/users.repository.interface';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class TherapistClientsService {
  constructor(
    @Inject(THERAPIST_CLIENT_REPOSITORY)
    private readonly relRepo: ITherapistClientRepository,
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async addClient(
    therapistId: string,
    clientId: string,
    meta: RequestMeta,
  ): Promise<TherapistClient> {
    const client = await this.userRepo.findById(clientId);
    if (!client) {
      throw new NotFoundException('Client not found');
    }
    if (client.role !== UserRole.CLIENT) {
      throw new BadRequestException('User is not a client');
    }

    const existing = await this.relRepo.findByTherapistAndClient(therapistId, clientId);
    if (existing) {
      throw new ConflictException('Relationship already exists');
    }

    const relationship = await this.relRepo.create(therapistId, clientId);

    await this.auditLogService.log({
      action: 'therapist_client.add',
      actorId: therapistId,
      resourceType: 'therapist_client',
      resourceId: relationship.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return relationship;
  }

  async getMyClients(
    therapistId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistClientWithClient>> {
    return this.relRepo.findByTherapist(therapistId, options);
  }

  async getMyTherapists(
    clientId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<TherapistClient>> {
    return this.relRepo.findByClient(clientId, options);
  }

  async updateStatus(
    relationshipId: string,
    therapistId: string,
    status: RelationshipStatus,
    meta: RequestMeta,
  ): Promise<TherapistClient> {
    const relationship = await this.relRepo.findById(relationshipId);
    if (!relationship) {
      throw new NotFoundException('Relationship not found');
    }
    if (relationship.therapistId !== therapistId) {
      throw new ForbiddenException('Access denied');
    }

    const updated = await this.relRepo.updateStatus(relationshipId, status);

    await this.auditLogService.log({
      action: 'therapist_client.status_update',
      actorId: therapistId,
      resourceType: 'therapist_client',
      resourceId: relationshipId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { status },
    });

    return updated;
  }
}
