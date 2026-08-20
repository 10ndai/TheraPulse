import {
  Body,
  Controller,
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
import { UserRole, RelationshipStatus } from '@prisma/client';
import type { TherapistClient } from '@prisma/client';
import { z } from 'zod';
import type { ApiSuccessResponse, PaginationMeta } from '@therapulse/shared';
import type { TherapistClientWithClient } from './therapist-client.repository.interface';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { TherapistClientsService } from './therapist-clients.service';
import type { AccessTokenPayload } from '../auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

const addClientSchema = z.object({
  clientId: z.string().uuid('clientId must be a valid UUID'),
});

const updateStatusSchema = z.object({
  status: z.nativeEnum(RelationshipStatus),
});

type AddClientDto = z.infer<typeof addClientSchema>;
type UpdateStatusDto = z.infer<typeof updateStatusSchema>;

@Controller('relationships')
export class TherapistClientsController {
  constructor(private readonly relService: TherapistClientsService) {}

  /**
   * POST /relationships
   * Therapist adds a client to their caseload.
   */
  @Roles(UserRole.THERAPIST)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async addClient(
    @Body(new ZodValidationPipe(addClientSchema)) dto: AddClientDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TherapistClient>> {
    const data = await this.relService.addClient(req.user.sub, dto.clientId, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * GET /relationships/my-clients
   * Returns the authenticated therapist's clients.
   */
  @Roles(UserRole.THERAPIST)
  @Get('my-clients')
  @HttpCode(HttpStatus.OK)
  async getMyClients(
    @Query() query: { page?: number | string; limit?: number | string },
    @Req() req: AuthenticatedRequest,
  ): Promise<
    ApiSuccessResponse<{ id: string; name: string | null; email: string }[]> & {
      meta?: PaginationMeta;
    }
  > {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const result = await this.relService.getMyClients(req.user.sub, { page, limit });
    const data = (result.data as TherapistClientWithClient[]).map((rel) => ({
      id: rel.clientId,
      name: rel.client.clientProfile?.name ?? null,
      email: rel.client.email,
    }));
    return { success: true, data, meta: result.meta };
  }

  /**
   * GET /relationships/my-therapists
   * Returns the authenticated client's therapists.
   */
  @Roles(UserRole.CLIENT)
  @Get('my-therapists')
  @HttpCode(HttpStatus.OK)
  async getMyTherapists(
    @Query() query: { page?: number | string; limit?: number | string },
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TherapistClient[]> & { meta?: PaginationMeta }> {
    const page = query.page ? Number(query.page) : 1;
    const limit = query.limit ? Number(query.limit) : 20;
    const result = await this.relService.getMyTherapists(req.user.sub, { page, limit });
    return { success: true, data: result.data as TherapistClient[], meta: result.meta };
  }

  /**
   * PATCH /relationships/:id/status
   * Therapist updates a relationship status (PAUSED, TERMINATED).
   */
  @Roles(UserRole.THERAPIST)
  @Patch(':id/status')
  @HttpCode(HttpStatus.OK)
  async updateStatus(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(updateStatusSchema)) dto: UpdateStatusDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TherapistClient>> {
    const data = await this.relService.updateStatus(id, req.user.sub, dto.status, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }
}
