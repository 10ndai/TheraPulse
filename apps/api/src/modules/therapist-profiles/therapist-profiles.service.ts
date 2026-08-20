import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { type TherapistProfile, UserRole } from '@prisma/client';
import type { CreateTherapistProfileDto, UpdateTherapistProfileDto } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
import { THERAPIST_PROFILE_REPOSITORY } from './therapist-profiles.repository.interface';
import type { ITherapistProfileRepository } from './therapist-profiles.repository.interface';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

@Injectable()
export class TherapistProfilesService {
  constructor(
    @Inject(THERAPIST_PROFILE_REPOSITORY)
    private readonly profileRepo: ITherapistProfileRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createProfile(
    userId: string,
    dto: CreateTherapistProfileDto,
    meta: RequestMeta,
  ): Promise<TherapistProfile> {
    const existing = await this.profileRepo.findByUserId(userId);
    if (existing) {
      throw new ConflictException('Therapist profile already exists');
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
      action: 'therapist_profile.create',
      actorId: userId,
      resourceType: 'therapist_profile',
      resourceId: profile.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return profile;
  }

  async getOwnProfile(userId: string): Promise<TherapistProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Therapist profile not found');
    }
    return profile;
  }

  async getProfileById(
    profileId: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<TherapistProfile> {
    const profile = await this.profileRepo.findById(profileId);
    if (!profile) {
      throw new NotFoundException('Therapist profile not found');
    }

    if (actorRole !== UserRole.ADMIN && profile.userId !== actorId) {
      throw new ForbiddenException('Access denied');
    }

    return profile;
  }

  async updateOwnProfile(
    userId: string,
    dto: UpdateTherapistProfileDto,
    meta: RequestMeta,
  ): Promise<TherapistProfile> {
    const profile = await this.profileRepo.findByUserId(userId);
    if (!profile) {
      throw new NotFoundException('Therapist profile not found');
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
      action: 'therapist_profile.update',
      actorId: userId,
      resourceType: 'therapist_profile',
      resourceId: profile.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return updated;
  }
}
