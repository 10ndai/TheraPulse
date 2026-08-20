import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole, WorksheetType, WorksheetTemplate } from '@prisma/client';
import type {
  ApiSuccessResponse,
  PaginationMeta,
  CreateWorksheetTemplateDto,
  UpdateWorksheetTemplateDto,
} from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { WorksheetTemplatesService } from './worksheet-templates.service';
import type { AccessTokenPayload } from '../auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

interface ListQuery {
  type?: WorksheetType;
  isPublished?: boolean | string;
  isSystem?: boolean | string;
  page?: number | string;
  limit?: number | string;
}

interface CreateTemplateBody extends CreateWorksheetTemplateDto {
  isSystem?: boolean;
}

@Controller('worksheet-templates')
export class WorksheetTemplatesController {
  constructor(private readonly service: WorksheetTemplatesService) {}

  /**
   * POST /worksheet-templates
   * Create a new draft worksheet template. ADMIN and THERAPIST only.
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateTemplateBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetTemplate>> {
    const { isSystem, ...dto } = body;
    const data = await this.service.createTemplate(
      dto,
      req.user.sub,
      req.user.role as UserRole,
      this.extractMeta(req),
      isSystem,
    );
    return { success: true, data };
  }

  /**
   * GET /worksheet-templates
   * List templates visible to the authenticated actor.
   */
  @Get()
  @HttpCode(HttpStatus.OK)
  async list(
    @Query() query: ListQuery,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetTemplate[]> & { meta: PaginationMeta }> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;

    const filters = {
      ...(query.type && { type: query.type }),
      ...(query.isPublished !== undefined && {
        isPublished: query.isPublished === true || query.isPublished === 'true',
      }),
      ...(query.isSystem !== undefined && {
        isSystem: query.isSystem === true || query.isSystem === 'true',
      }),
    };

    const result = await this.service.listTemplates(
      filters,
      { page, limit },
      req.user.sub,
      req.user.role as UserRole,
    );

    return { success: true, data: result.data as WorksheetTemplate[], meta: result.meta };
  }

  /**
   * GET /worksheet-templates/:id
   * Get a single template by ID.
   */
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetTemplate>> {
    const data = await this.service.getTemplate(id, req.user.sub, req.user.role as UserRole);
    return { success: true, data };
  }

  /**
   * PATCH /worksheet-templates/:id
   * Update a draft template. Owner or ADMIN only; published templates are immutable.
   */
  @Patch(':id')
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateWorksheetTemplateDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetTemplate>> {
    const data = await this.service.updateTemplate(
      id,
      dto,
      req.user.sub,
      req.user.role as UserRole,
      this.extractMeta(req),
    );
    return { success: true, data };
  }

  /**
   * POST /worksheet-templates/:id/publish
   * Publish a draft template — increments version and makes it immutable.
   */
  @Post(':id/publish')
  @HttpCode(HttpStatus.OK)
  async publish(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetTemplate>> {
    const data = await this.service.publishTemplate(
      id,
      req.user.sub,
      req.user.role as UserRole,
      this.extractMeta(req),
    );
    return { success: true, data };
  }

  /**
   * POST /worksheet-templates/:id/clone
   * Clone a template into a new draft. ADMIN and THERAPIST only.
   */
  @Post(':id/clone')
  @HttpCode(HttpStatus.CREATED)
  async clone(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetTemplate>> {
    const data = await this.service.cloneTemplate(
      id,
      req.user.sub,
      req.user.role as UserRole,
      this.extractMeta(req),
    );
    return { success: true, data };
  }

  /**
   * DELETE /worksheet-templates/:id
   * Delete a template. Owner or ADMIN only.
   */
  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<null>> {
    await this.service.deleteTemplate(
      id,
      req.user.sub,
      req.user.role as UserRole,
      this.extractMeta(req),
    );
    return { success: true, data: null };
  }

  private extractMeta(req: AuthenticatedRequest) {
    return {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    };
  }
}
