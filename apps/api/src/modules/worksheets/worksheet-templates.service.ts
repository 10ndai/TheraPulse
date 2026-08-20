import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { UserRole, type WorksheetType, type WorksheetTemplate } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { CreateWorksheetTemplateDto, UpdateWorksheetTemplateDto } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
import { WORKSHEET_TEMPLATE_REPOSITORY } from './worksheet-templates.repository.interface';
import type {
  IWorksheetTemplateRepository,
  WorksheetTemplateFilters,
} from './worksheet-templates.repository.interface';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import type { RequestMeta } from '../admin/admin.service';

@Injectable()
export class WorksheetTemplatesService {
  constructor(
    @Inject(WORKSHEET_TEMPLATE_REPOSITORY)
    private readonly templateRepo: IWorksheetTemplateRepository,
    private readonly auditLogService: AuditLogService,
  ) {}

  async createTemplate(
    dto: CreateWorksheetTemplateDto,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
    isSystem = false,
  ): Promise<WorksheetTemplate> {
    if (actorRole === UserRole.CLIENT) {
      throw new ForbiddenException('Clients cannot create worksheet templates');
    }

    const effectiveIsSystem = actorRole === UserRole.ADMIN ? isSystem : false;

    const template = await this.templateRepo.create({
      title: dto.title,
      type: dto.type as WorksheetType,
      formSchema: dto.formSchema as object,
      ...(dto.scoringConfig !== undefined ? { scoringConfig: dto.scoringConfig as object } : {}),
      isSystem: effectiveIsSystem,
      isPublished: false,
      version: 1,
      ...(actorId && { createdBy: { connect: { id: actorId } } }),
    } as Parameters<typeof this.templateRepo.create>[0]);

    await this.auditLogService.log({
      action: 'worksheet_template.create',
      actorId,
      resourceType: 'worksheet_template',
      resourceId: template.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { title: template.title, type: template.type },
    });

    return template;
  }

  async getTemplate(id: string, actorId: string, actorRole: UserRole): Promise<WorksheetTemplate> {
    const template = await this.templateRepo.findById(id);

    if (!template) {
      throw new NotFoundException('Worksheet template not found');
    }

    this.assertCanView(template, actorId, actorRole);

    return template;
  }

  async listTemplates(
    filters: Omit<WorksheetTemplateFilters, 'actorId' | 'actorRole'>,
    options: PaginationOptions,
    actorId: string,
    actorRole: UserRole,
  ): Promise<PaginatedResult<WorksheetTemplate>> {
    return this.templateRepo.findByFilters({ ...filters, actorId, actorRole }, options);
  }

  async updateTemplate(
    id: string,
    dto: UpdateWorksheetTemplateDto,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<WorksheetTemplate> {
    const template = await this.templateRepo.findById(id);

    if (!template) {
      throw new NotFoundException('Worksheet template not found');
    }

    if (template.isPublished) {
      throw new BadRequestException(
        'Published templates are immutable. Create a new version instead.',
      );
    }

    this.assertCanModify(template, actorId, actorRole);

    const updated = await this.templateRepo.update(id, {
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.formSchema !== undefined && { formSchema: dto.formSchema as object }),
      ...(dto.scoringConfig !== undefined && { scoringConfig: dto.scoringConfig as object }),
    });

    await this.auditLogService.log({
      action: 'worksheet_template.update',
      actorId,
      resourceType: 'worksheet_template',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { updatedFields: Object.keys(dto) },
    });

    return updated;
  }

  async publishTemplate(
    id: string,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<WorksheetTemplate> {
    const template = await this.templateRepo.findById(id);

    if (!template) {
      throw new NotFoundException('Worksheet template not found');
    }

    if (template.isPublished) {
      throw new BadRequestException('Template is already published');
    }

    this.assertCanModify(template, actorId, actorRole);

    const published = await this.templateRepo.update(id, {
      isPublished: true,
      version: template.version + 1,
    });

    await this.auditLogService.log({
      action: 'worksheet_template.publish',
      actorId,
      resourceType: 'worksheet_template',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { version: published.version },
    });

    return published;
  }

  async cloneTemplate(
    id: string,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<WorksheetTemplate> {
    if (actorRole === UserRole.CLIENT) {
      throw new ForbiddenException('Clients cannot clone worksheet templates');
    }

    const source = await this.templateRepo.findById(id);

    if (!source) {
      throw new NotFoundException('Worksheet template not found');
    }

    const cloned = await this.templateRepo.create({
      title: `Copy of ${source.title}`,
      type: source.type,
      formSchema: source.formSchema as object,
      ...(source.scoringConfig !== null ? { scoringConfig: source.scoringConfig as object } : {}),
      isSystem: false,
      isPublished: false,
      version: 1,
      createdBy: { connect: { id: actorId } },
    } as Parameters<typeof this.templateRepo.create>[0]);

    await this.auditLogService.log({
      action: 'worksheet_template.clone',
      actorId,
      resourceType: 'worksheet_template',
      resourceId: cloned.id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      details: { sourceTemplateId: id },
    });

    return cloned;
  }

  async deleteTemplate(
    id: string,
    actorId: string,
    actorRole: UserRole,
    meta: RequestMeta,
  ): Promise<void> {
    const template = await this.templateRepo.findById(id);

    if (!template) {
      throw new NotFoundException('Worksheet template not found');
    }

    this.assertCanModify(template, actorId, actorRole);

    await this.templateRepo.softDelete(id);

    await this.auditLogService.log({
      action: 'worksheet_template.delete',
      actorId,
      resourceType: 'worksheet_template',
      resourceId: id,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });
  }

  private assertCanView(template: WorksheetTemplate, actorId: string, actorRole: UserRole): void {
    if (actorRole === UserRole.ADMIN) return;
    if (template.isPublished) return;

    if (actorRole === UserRole.THERAPIST && template.createdById === actorId) return;

    throw new ForbiddenException('You do not have access to this template');
  }

  private assertCanModify(template: WorksheetTemplate, actorId: string, actorRole: UserRole): void {
    if (actorRole === UserRole.ADMIN) return;
    if (template.createdById === actorId) return;

    throw new ForbiddenException('You do not have permission to modify this template');
  }
}
