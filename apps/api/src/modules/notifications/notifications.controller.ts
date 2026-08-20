import { Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { Notification } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { AccessTokenPayload } from '../auth/auth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { NotificationsService } from './notifications.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

interface ListQuery {
  page?: number;
  limit?: number;
  unreadOnly?: boolean;
}

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async list(
    @Query() query: ListQuery,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: Notification[]; meta: PaginatedResult<Notification>['meta'] }> {
    const { sub: id } = req.user;
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const filters = query.unreadOnly ? { unreadOnly: true } : {};
    const result = await this.service.listForRecipient(id, filters, { page, limit });
    return { success: true, data: result.data as Notification[], meta: result.meta };
  }

  @Patch('read-all')
  async markAllRead(
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: { marked: number } }> {
    const { sub: id } = req.user;
    const marked = await this.service.markAllRead(id);
    return { success: true, data: { marked } };
  }

  @Patch(':id/read')
  async markRead(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: Notification }> {
    const { sub: actorId } = req.user;
    const data = await this.service.markRead(id, actorId);
    return { success: true, data };
  }
}
