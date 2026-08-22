import { Controller, Get, Param, Patch, Query, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { Notification } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import { paginationQuerySchema } from '@therapulse/shared';
import type { AccessTokenPayload } from '../auth/auth.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { NotificationsService } from './notifications.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

interface ListQuery {
  // Express query params are always strings at runtime; typing these as
  // `number` let a raw string reach Prisma (`take: "50"` -> 500).
  page?: number | string;
  limit?: number | string;
  unreadOnly?: boolean;
}

/** Coerces + bounds page/limit via the shared schema (min 1, max MAX_LIMIT). */
const paginationPipe = new ZodValidationPipe(paginationQuerySchema);

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationsService) {}

  @Get()
  async list(
    @Query() query: ListQuery,
    @Req() req: AuthenticatedRequest,
  ): Promise<{ success: true; data: Notification[]; meta: PaginatedResult<Notification>['meta'] }> {
    const { sub: id } = req.user;
    const { page, limit } = paginationPipe.transform({
      page: query.page,
      limit: query.limit,
    }) as { page: number; limit: number };
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
