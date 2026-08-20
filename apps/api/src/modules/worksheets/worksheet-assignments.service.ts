import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import type { AssignmentStatus, WorksheetAssignment } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { NotificationsService } from '../notifications/notifications.service';
import { WORKSHEET_ASSIGNMENT_REPOSITORY } from './worksheet-assignments.repository.interface';
import type {
  IWorksheetAssignmentRepository,
  WorksheetAssignmentFilters,
  WorksheetAssignmentWithTemplate,
} from './worksheet-assignments.repository.interface';
import { WORKSHEET_TEMPLATE_REPOSITORY } from './worksheet-templates.repository.interface';
import type { IWorksheetTemplateRepository } from './worksheet-templates.repository.interface';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import type { RequestMeta } from '../admin/admin.service';

export interface CreateAssignmentDto {
  templateId: string;
  clientId: string;
  instructions?: string;
  dueDate?: Date;
}

export interface AssignmentStatusFilters {
  status?: AssignmentStatus;
  clientId?: string;
}

@Injectable()
export class WorksheetAssignmentsService {
  constructor(
    @Inject(WORKSHEET_ASSIGNMENT_REPOSITORY)
    private readonly assignmentRepo: IWorksheetAssignmentRepository,
    @Inject(WORKSHEET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IWorksheetTemplateRepository,
    private readonly auditLogService: AuditLogService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createAssignment(
    dto: CreateAssignmentDto,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<WorksheetAssignment> {
    if (actorRole === UserRole.CLIENT) {
      throw new ForbiddenException('Clients cannot create worksheet assignments');
    }

    const template = await this.templateRepo.findById(dto.templateId);
    if (!template) {
      throw new NotFoundException('Worksheet template not found');
    }
    if (!template.isPublished) {
      throw new BadRequestException('Cannot assign an unpublished worksheet template');
    }

    const assignment = await this.assignmentRepo.create({
      template: { connect: { id: dto.templateId } },
      therapist: { connect: { id: actorId } },
      client: { connect: { id: dto.clientId } },
      ...(dto.instructions !== undefined && { instructions: dto.instructions }),
      ...(dto.dueDate !== undefined && { dueDate: dto.dueDate }),
    });

    await this.auditLogService.log({
      actorId,
      action: 'worksheet_assignment.create',
      resourceType: 'WorksheetAssignment',
      resourceId: assignment.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { templateId: dto.templateId, clientId: dto.clientId },
    });

    await this.notificationsService.createNotification({
      recipientId: dto.clientId,
      type: 'NEW_ASSIGNMENT',
      title: `New worksheet assigned: ${template.title}`,
      body: `A therapist has assigned "${template.title}" to you.`,
      resourceType: 'WorksheetAssignment',
      resourceId: assignment.id,
    });

    return assignment;
  }

  async listAssignments(
    filters: AssignmentStatusFilters,
    actorId: string,
    actorRole: UserRole,
    options: PaginationOptions,
  ): Promise<PaginatedResult<WorksheetAssignmentWithTemplate>> {
    const repoFilters: WorksheetAssignmentFilters = {
      actorId,
      actorRole,
      ...(filters.status !== undefined && { status: filters.status }),
      ...(filters.clientId !== undefined && { clientId: filters.clientId }),
    };

    return this.assignmentRepo.findByFilters(repoFilters, options);
  }

  async getAssignment(
    id: string,
    actorId: string,
    actorRole: UserRole,
  ): Promise<WorksheetAssignment> {
    const assignment = await this.assignmentRepo.findById(id);
    if (!assignment) {
      throw new NotFoundException('Worksheet assignment not found');
    }
    this.assertCanView(assignment, actorId, actorRole);
    return assignment;
  }

  async updateStatus(
    id: string,
    status: AssignmentStatus,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<WorksheetAssignment> {
    if (actorRole !== UserRole.CLIENT) {
      throw new ForbiddenException('Only clients can update assignment status');
    }

    const assignment = await this.assignmentRepo.findById(id);
    if (!assignment) {
      throw new NotFoundException('Worksheet assignment not found');
    }
    if (assignment.clientId !== actorId) {
      throw new ForbiddenException('You are not the assigned client for this worksheet');
    }

    const updated = await this.assignmentRepo.update(id, { status });

    await this.auditLogService.log({
      actorId,
      action: 'worksheet_assignment.status_update',
      resourceType: 'WorksheetAssignment',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { previousStatus: assignment.status, newStatus: status },
    });

    return updated;
  }

  async deleteAssignment(
    id: string,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<void> {
    if (actorRole === UserRole.CLIENT) {
      throw new ForbiddenException('Clients cannot delete worksheet assignments');
    }

    const assignment = await this.assignmentRepo.findById(id);
    if (!assignment) {
      throw new NotFoundException('Worksheet assignment not found');
    }
    if (actorRole === UserRole.THERAPIST && assignment.therapistId !== actorId) {
      throw new ForbiddenException('You do not own this worksheet assignment');
    }

    await this.assignmentRepo.softDelete(id);

    await this.auditLogService.log({
      actorId,
      action: 'worksheet_assignment.delete',
      resourceType: 'WorksheetAssignment',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { therapistId: assignment.therapistId, clientId: assignment.clientId },
    });
  }

  private assertCanView(
    assignment: WorksheetAssignment,
    actorId: string,
    actorRole: UserRole,
  ): void {
    if (actorRole === UserRole.ADMIN) return;
    if (actorRole === UserRole.THERAPIST && assignment.therapistId === actorId) return;
    if (actorRole === UserRole.CLIENT && assignment.clientId === actorId) return;
    throw new ForbiddenException('You do not have access to this worksheet assignment');
  }
}
