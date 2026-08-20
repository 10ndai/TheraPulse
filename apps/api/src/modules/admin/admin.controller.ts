import { Controller, Get, HttpCode, HttpStatus, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import { Roles } from '../../common/decorators/roles.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AdminService } from './admin.service';
import type { SafeUser } from './admin.service';
import type { ApiSuccessResponse } from '@therapulse/shared';
import type { AccessTokenPayload } from '../auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Roles(UserRole.ADMIN)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  /**
   * GET /admin/therapists/pending
   * Returns paginated list of therapists awaiting approval.
   */
  @Get('therapists/pending')
  @HttpCode(HttpStatus.OK)
  async listPending(
    @Query()
    query: {
      page?: number | string;
      limit?: number | string;
    },
  ): Promise<ApiSuccessResponse<SafeUser[]>> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const result = await this.adminService.listPendingTherapists({ page, limit });
    return { success: true, data: result.data as unknown as SafeUser[], meta: result.meta };
  }

  /**
   * PATCH /admin/therapists/:id/approve
   * Approves a pending therapist — sets status to ACTIVE.
   */
  @Patch('therapists/:id/approve')
  @HttpCode(HttpStatus.OK)
  async approve(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<SafeUser>> {
    const data = await this.adminService.approveTherapist(id, req.user.sub, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * PATCH /admin/therapists/:id/reject
   * Rejects a pending therapist — sets status to SUSPENDED.
   */
  @Patch('therapists/:id/reject')
  @HttpCode(HttpStatus.OK)
  async reject(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<SafeUser>> {
    const data = await this.adminService.rejectTherapist(id, req.user.sub, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }
}
