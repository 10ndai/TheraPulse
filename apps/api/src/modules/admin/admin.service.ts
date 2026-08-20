import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type User, UserRole, UserStatus, ApprovalStatus } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
import { USER_REPOSITORY } from '../users/users.repository.interface';
import type { IUserRepository } from '../users/users.repository.interface';
import { THERAPIST_PROFILE_REPOSITORY } from '../therapist-profiles/therapist-profiles.repository.interface';
import type { ITherapistProfileRepository } from '../therapist-profiles/therapist-profiles.repository.interface';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

export type SafeUser = Omit<User, 'passwordHash' | 'totpSecret'>;

@Injectable()
export class AdminService {
  constructor(
    @Inject(USER_REPOSITORY) private readonly userRepo: IUserRepository,
    @Inject(THERAPIST_PROFILE_REPOSITORY)
    private readonly therapistProfileRepo: ITherapistProfileRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async listPendingTherapists(options: PaginationOptions): Promise<PaginatedResult<User>> {
    return this.userRepo.findPendingTherapists(options);
  }

  async approveTherapist(
    therapistId: string,
    adminId: string,
    meta: RequestMeta,
  ): Promise<SafeUser> {
    const user = await this.findPendingTherapistOrThrow(therapistId);

    const updated = await this.userRepo.update(user.id, { status: UserStatus.ACTIVE });

    await this.maybeUpdateProfile(user.id, adminId, ApprovalStatus.APPROVED);

    await this.auditLogService.log({
      action: 'therapist.approve',
      actorId: adminId,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toSafeUser(updated);
  }

  async rejectTherapist(
    therapistId: string,
    adminId: string,
    meta: RequestMeta,
  ): Promise<SafeUser> {
    const user = await this.findPendingTherapistOrThrow(therapistId);

    const updated = await this.userRepo.update(user.id, { status: UserStatus.SUSPENDED });

    await this.maybeUpdateProfile(user.id, adminId, ApprovalStatus.REJECTED);

    await this.auditLogService.log({
      action: 'therapist.reject',
      actorId: adminId,
      resourceType: 'user',
      resourceId: user.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return this.toSafeUser(updated);
  }

  private async findPendingTherapistOrThrow(therapistId: string): Promise<User> {
    const user = await this.userRepo.findById(therapistId);

    if (!user) {
      throw new NotFoundException('Therapist not found');
    }
    if (user.role !== UserRole.THERAPIST) {
      throw new BadRequestException('User is not a therapist');
    }
    if (user.status !== UserStatus.PENDING) {
      throw new BadRequestException('Therapist is not in PENDING status');
    }

    return user;
  }

  private async maybeUpdateProfile(
    userId: string,
    adminId: string,
    approvalStatus: ApprovalStatus,
  ): Promise<void> {
    const profile = await this.therapistProfileRepo.findByUserId(userId);
    if (!profile) return;

    await this.therapistProfileRepo.update(profile.id, {
      approvalStatus,
      approver: { connect: { id: adminId } },
    });
  }

  private toSafeUser(user: User): SafeUser {
    const { passwordHash: _p, totpSecret: _t, ...safe } = user;
    return safe;
  }
}
