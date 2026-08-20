import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { UserRole } from '@prisma/client';
import type { ClientProfile } from '@prisma/client';
import { createClientProfileSchema, updateClientProfileSchema } from '@therapulse/shared';
import type {
  CreateClientProfileDto,
  UpdateClientProfileDto,
  ApiSuccessResponse,
} from '@therapulse/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { ClientProfilesService } from './client-profiles.service';
import type { AccessTokenPayload } from '../auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller('client-profiles')
export class ClientProfilesController {
  constructor(private readonly profilesService: ClientProfilesService) {}

  /**
   * POST /client-profiles
   * Creates the authenticated client's profile.
   */
  @Roles(UserRole.CLIENT)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createClientProfileSchema)) dto: CreateClientProfileDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<ClientProfile>> {
    const data = await this.profilesService.createProfile(req.user.sub, dto, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * GET /client-profiles/me
   * Returns the authenticated client's own profile.
   */
  @Roles(UserRole.CLIENT)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: AuthenticatedRequest): Promise<ApiSuccessResponse<ClientProfile>> {
    const data = await this.profilesService.getOwnProfile(req.user.sub);
    return { success: true, data };
  }

  /**
   * GET /client-profiles/:id
   * Returns a client profile by ID.
   * Clients can only view their own; therapists and admins can view any.
   */
  @Roles(UserRole.CLIENT, UserRole.THERAPIST, UserRole.ADMIN)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<ClientProfile>> {
    const data = await this.profilesService.getProfileById(
      id,
      req.user.sub,
      req.user.role as UserRole,
    );
    return { success: true, data };
  }

  /**
   * PATCH /client-profiles/me
   * Updates the authenticated client's own profile.
   */
  @Roles(UserRole.CLIENT)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @Body(new ZodValidationPipe(updateClientProfileSchema)) dto: UpdateClientProfileDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<ClientProfile>> {
    const data = await this.profilesService.updateOwnProfile(req.user.sub, dto, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }
}
