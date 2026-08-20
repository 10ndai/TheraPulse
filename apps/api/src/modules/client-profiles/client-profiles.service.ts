import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type ClientProfile, UserRole } from '@prisma/client';
import type { CreateClientProfileDto, UpdateClientProfileDto } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
import { CLIENT_PROFILE_REPOSITORY } from './client-profiles.repository.interface';
import type { IClientProfileRepository } from './client-profiles.repository.interface';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class ClientProfilesService {
  constructor(
    @Inject(CLIENT_PROFILE_REPOSITORY)
    private readonly profileRepo: IClientProfileRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createProfile(
    userId: string,
    dto: CreateClientProfileDto,
    meta: RequestMeta,
  ): Promise<ClientProfile> {
    const existing = await this.profileRepo.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Client profile already exists');
    }

    // Strip undefined values — exactOptionalPropertyTypes requires omitting keys, not setting them to undefined
    const createData = Object.fromEntries(
      Object.entries(dto as Record<string, unknown>).filter(([, v]) => v !== undefined),
    );
    const profile = await this.profileRepo.create({
      ...createData,
      user: { connect: { id: userId } },
    } as Parameters<typeof this.profileRepo.create>[0]);

    await this.auditLogService.log({
      action: 'client_profile.create',
      actorId: userId,
      resourceType: 'client_profile',
      resourceId: profile.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return profile;
  }

  async getOwnProfile(userId: string): Promise<ClientProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }
    return profile;
  }

  async getProfileById(
    profileId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<ClientProfile> {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }

    // Clients can only view their own profile; therapists and admins can view any
    if (actorRole === UserRole.CLIENT && profile.userId !== actorId) {
      throw new ForbiddenException('Access denied');
    }

    return profile;
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateClientProfileDto,
    meta: RequestMeta,
  ): Promise<ClientProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Client profile not found');
    }

    // Strip undefined values before passing to repository
    const updateData = Object.fromEntries(
      Object.entries(dto as Record<string, unknown>).filter(([, v]) => v !== undefined),
    );
    const updated = await this.profileRepo.update(
      profile.id,
      updateData as Parameters<typeof this.profileRepo.update>[1],
    );

    await this.auditLogService.log({
      action: 'client_profile.update',
      actorId: userId,
      resourceType: 'client_profile',
      resourceId: profile.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
