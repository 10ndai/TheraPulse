import { Controller, ForbiddenException, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { DashboardService } from './dashboard.service';
import type { AdminStats, ClientProgress, TherapistStats } from './dashboard.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('therapist')
  async getTherapistOverview(
    @Req() req: AuthenticatedRequest,
    @Query('therapistId') therapistIdParam?: string,
  ): Promise<{ success: true; data: TherapistStats }> {
    const { id, role } = req.user;

    let targetId: string;
    if (role === UserRole.THERAPIST) {
      targetId = id;
    } else if (role === UserRole.ADMIN && therapistIdParam) {
      targetId = therapistIdParam;
    } else {
      throw new ForbiddenException('Access denied.');
    }

    const data = await this.dashboardService.getTherapistStats(targetId);
    return { success: true, data };
  }

  @Get('client')
  async getClientProgress(
    @Req() req: AuthenticatedRequest,
    @Query('clientId') clientIdParam?: string,
  ): Promise<{ success: true; data: ClientProgress }> {
    const { id, role } = req.user;

    let targetId: string;
    if (role === UserRole.CLIENT) {
      targetId = id;
    } else if ((role === UserRole.THERAPIST || role === UserRole.ADMIN) && clientIdParam) {
      targetId = clientIdParam;
    } else {
      throw new ForbiddenException('Access denied.');
    }

    const data = await this.dashboardService.getClientProgress(targetId);
    return { success: true, data };
  }

  @Get('admin')
  async getAdminStats(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: AdminStats }> {
    const { role } = req.user;
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can view platform stats.');
    }

    const data = await this.dashboardService.getAdminStats();
    return { success: true, data };
  }
}
