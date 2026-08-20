import { Body, Controller, Get, Param, Post, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { UserRole, WorksheetSubmission } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { AccessTokenPayload } from '../auth/auth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { WorksheetSubmissionsService } from './worksheet-submissions.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

interface SubmitDto {
  assignmentId: string;
  responses: Record<string, unknown>;
  status: 'DRAFT' | 'SUBMITTED';
}

interface ListQuery {
  page?: number;
  limit?: number;
  assignmentId?: string;
}

@Controller('worksheet-submissions')
export class WorksheetSubmissionsController {
  constructor(private readonly service: WorksheetSubmissionsService) {}

  @Post()
  async submit(
    @Body() dto: SubmitDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: WorksheetSubmission }> {
    const { sub: id, role } = req.user;
    const meta = this.extractMeta(req);
    const data = await this.service.submit(dto, id, role as UserRole, meta);
    return { success: true, data };
  }

  @Get()
  async list(
    @Query() query: ListQuery,
    @Req() req: AuthenticatedRequest,
  ): Promise<{
    success: true;
    data: WorksheetSubmission[];
    meta: PaginatedResult<WorksheetSubmission>['meta'];
  }> {
    const { sub: id, role } = req.user;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = query.assignmentId ? { assignmentId: query.assignmentId } : {};
    const result = await this.service.listSubmissions(filters, id, role as UserRole, {
      page,
      limit,
    });
    return { success: true, data: result.data as WorksheetSubmission[], meta: result.meta };
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: WorksheetSubmission }> {
    const { sub: actorId, role } = req.user;
    const data = await this.service.getSubmission(id, actorId, role as UserRole);
    return { success: true, data };
  }

  @Get(':id/verify')
  async verify(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: { valid: boolean } }> {
    const { sub: actorId, role } = req.user;
    const data = await this.service.verifyIntegrity(id, actorId, role as UserRole);
    return { success: true, data };
  }

  // ── private helpers ────────────────────────────────────────────────────────

  private extractMeta(req: Request): { ip: string; userAgent: string } {
    return {
      ip: req.ip ?? 'unknown',
      userAgent: req.get('user-agent') ?? 'unknown',
    };
  }
}
