import { Controller, ForbiddenException, Get, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from './audit-log.service';

interface AuthenticatedRequest extends Request {
  user: { id: string; role: UserRole };
}

interface FindByResourceQuery {
  resourceType: string;
  resourceId: string;
  page?: string;
  limit?: string;
}

@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async findByResource(@Query() query: FindByResourceQuery, @Req() req: AuthenticatedRequest) {
    const { role } = req.user;
    if (role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only administrators can view audit logs.');
    }

    const page = query.page ? parseInt(query.page, 10) : 1;
    const limit = query.limit ? parseInt(query.limit, 10) : 20;

    const result = await this.auditLogService.findByResource(query.resourceType, query.resourceId, {
      page,
      limit,
    });

    return { success: true, data: result.data, meta: result.meta };
  }
}
