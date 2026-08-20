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
import type { AssignmentStatus, UserRole, WorksheetAssignment } from '@prisma/client';
import type { ApiSuccessResponse, PaginationMeta } from '@therapulse/shared';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { WorksheetAssignmentsService } from './worksheet-assignments.service';
import type { CreateAssignmentDto, AssignmentStatusFilters } from './worksheet-assignments.service';
import type { WorksheetAssignmentWithTemplate } from './worksheet-assignments.repository.interface';
import type { AccessTokenPayload } from '../auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

interface ListQuery {
  status?: AssignmentStatus;
  page?: number | string;
  limit?: number | string;
  clientId?: string;
}

interface UpdateStatusBody {
  status: AssignmentStatus;
}

function extractMeta(req: AuthenticatedRequest) {
  return {
    ipAddress: req.ip ?? 'unknown',
    userAgent: req.get('user-agent') ?? 'unknown',
  };
}

@Controller('worksheet-assignments')
export class WorksheetAssignmentsController {
  constructor(private readonly service: WorksheetAssignmentsService) {}

  /**
   * POST /worksheet-assignments
   * Create a new assignment (ADMIN, THERAPIST only).
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() body: CreateAssignmentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetAssignment>> {
    const data = await this.service.createAssignment(
      body,
      req.user.sub,
      req.user.role as UserRole,
      extractMeta(req),
    );
    return { success: true, data };
  }

  /**
   * GET /worksheet-assignments
   * List assignments visible to the actor (role-scoped).
   */
  @Get()
  async list(
    @Query() query: ListQuery,
    @Req() req: AuthenticatedRequest,
    @Query() pagination: { page?: number | string; limit?: number | string },
  ): Promise<
    ApiSuccessResponse<readonly WorksheetAssignmentWithTemplate[]> & { meta: PaginationMeta }
  > {
    const filters: AssignmentStatusFilters = {
      ...(query.status !== undefined && { status: query.status }),
      ...(query.clientId !== undefined && { clientId: query.clientId }),
    };
    const page = Number(pagination.page ?? 1);
    const limit = Math.min(Number(pagination.limit ?? 20), 100);

    const result = await this.service.listAssignments(
      filters,
      req.user.sub,
      req.user.role as UserRole,
      { page, limit },
    );

    return { success: true, data: result.data, meta: result.meta };
  }

  /**
   * GET /worksheet-assignments/:id
   * Get a single assignment (role-checked).
   */
  @Get(':id')
  async getOne(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetAssignment>> {
    const data = await this.service.getAssignment(id, req.user.sub, req.user.role as UserRole);
    return { success: true, data };
  }

  /**
   * PATCH /worksheet-assignments/:id/status
   * Update assignment status (CLIENT only: PENDING → IN_PROGRESS → COMPLETED).
   */
  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body() body: UpdateStatusBody,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<WorksheetAssignment>> {
    const data = await this.service.updateStatus(
      id,
      body.status,
      req.user.sub,
      req.user.role as UserRole,
      extractMeta(req),
    );
    return { success: true, data };
  }

  /**
   * DELETE /worksheet-assignments/:id
   * Soft-delete an assignment (ADMIN, THERAPIST who owns it).
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<null>> {
    await this.service.deleteAssignment(
      id,
      req.user.sub,
      req.user.role as UserRole,
      extractMeta(req),
    );
    return { success: true, data: null };
  }
}
