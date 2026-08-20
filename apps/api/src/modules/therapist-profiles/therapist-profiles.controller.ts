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
import { createTherapistProfileSchema, updateTherapistProfileSchema } from '@therapulse/shared';
import type {
  CreateTherapistProfileDto,
  UpdateTherapistProfileDto,
  ApiSuccessResponse,
} from '@therapulse/shared';
import type { TherapistProfile } from '@prisma/client';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Roles } from '../../common/decorators/roles.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { TherapistProfilesService } from './therapist-profiles.service';
import type { AccessTokenPayload } from '../auth/auth.service';

type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller('therapist-profiles')
export class TherapistProfilesController {
  constructor(private readonly profilesService: TherapistProfilesService) {}

  /**
   * POST /therapist-profiles
   * Creates the authenticated therapist's profile.
   */
  @Roles(UserRole.THERAPIST)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body(new ZodValidationPipe(createTherapistProfileSchema)) dto: CreateTherapistProfileDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TherapistProfile>> {
    const data = await this.profilesService.createProfile(req.user.sub, dto, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * GET /therapist-profiles/me
   * Returns the authenticated therapist's own profile.
   */
  @Roles(UserRole.THERAPIST)
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async getMe(@Req() req: AuthenticatedRequest): Promise<ApiSuccessResponse<TherapistProfile>> {
    const data = await this.profilesService.getOwnProfile(req.user.sub);
    return { success: true, data };
  }

  /**
   * GET /therapist-profiles/:id
   * Returns a profile by profile ID.
   * Admin can view any profile; a therapist can only view their own.
   */
  @Roles(UserRole.THERAPIST, UserRole.ADMIN)
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  async getById(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TherapistProfile>> {
    const data = await this.profilesService.getProfileById(
      id,
      req.user.sub,
      req.user.role as UserRole,
    );
    return { success: true, data };
  }

  /**
   * PATCH /therapist-profiles/me
   * Updates the authenticated therapist's own profile.
   */
  @Roles(UserRole.THERAPIST)
  @Patch('me')
  @HttpCode(HttpStatus.OK)
  async updateMe(
    @Body(new ZodValidationPipe(updateTherapistProfileSchema)) dto: UpdateTherapistProfileDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TherapistProfile>> {
    const data = await this.profilesService.updateOwnProfile(req.user.sub, dto, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }
}
