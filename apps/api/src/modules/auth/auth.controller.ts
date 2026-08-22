import { Body, Controller, Get, HttpCode, HttpStatus, Post, Req } from '@nestjs/common';
import { z } from 'zod';
import type { Request } from 'express';
import {
  registerSchema,
  loginSchema,
  refreshTokenRequestSchema,
  totpTokenSchema,
} from '@therapulse/shared';
import type {
  LoginDto as SharedLoginDto,
  RefreshTokenRequestDto,
  TotpTokenDto,
} from '@therapulse/shared';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Public } from '../../common/decorators/public.decorator';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuthService } from './auth.service';
import type {
  RegisterResponseData,
  RegisterDto,
  LoginResponseData,
  TotpPendingResponseData,
  RefreshResponseData,
  TotpSetupResponseData,
  EnableTotpResponseData,
  AccessTokenPayload,
  CurrentUserResponseData,
} from './auth.service';
import type { ApiSuccessResponse } from '@therapulse/shared';

/**
 * Public registration schema: restricts role to THERAPIST or CLIENT.
 * ADMIN accounts are created via seeding only — never via a public endpoint.
 */
export const publicRegisterSchema = registerSchema.extend({
  role: z.enum(['THERAPIST', 'CLIENT']),
});

/** Schema for TOTP verify endpoint (public — uses totpPendingToken + TOTP/backup code). */
const totpVerifySchema = z.object({
  totpPendingToken: z.string().min(1, 'totpPendingToken is required'),
  code: z.string().min(1, 'code is required'),
});

type TotpVerifyDto = z.infer<typeof totpVerifySchema>;

/** Augmented Express request with authenticated user payload. */
type AuthenticatedRequest = Request & { user: AccessTokenPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * GET /api/auth/me
   * Returns the authenticated user. The web BFF proxies here so the access
   * token stays in the httpOnly cookie and never reaches client-side JS.
   */
  @Get('me')
  @HttpCode(HttpStatus.OK)
  async me(@Req() req: AuthenticatedRequest): Promise<ApiSuccessResponse<CurrentUserResponseData>> {
    const data = await this.authService.getCurrentUser(req.user.sub);
    return { success: true, data };
  }

  /**
   * POST /api/auth/register
   * Registers a new therapist (status=PENDING) or client (status=ACTIVE).
   */
  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(
    @Body(new ZodValidationPipe(publicRegisterSchema)) dto: RegisterDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<RegisterResponseData>> {
    const data = await this.authService.register(dto, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * POST /api/auth/login
   * Authenticates a user. For TOTP-enabled therapists, returns a pending token
   * rather than full access/refresh tokens.
   */
  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) dto: SharedLoginDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<LoginResponseData | TotpPendingResponseData>> {
    const data = await this.authService.login(dto, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * POST /api/auth/refresh
   * Exchanges a valid refresh token for new access + refresh tokens (rotation).
   */
  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body(new ZodValidationPipe(refreshTokenRequestSchema)) dto: RefreshTokenRequestDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<RefreshResponseData>> {
    const data = await this.authService.refreshTokens(dto.refreshToken, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }

  /**
   * POST /api/auth/totp/setup
   * Generates a new TOTP secret and returns OTP auth URI + QR code.
   * Requires authentication. Does NOT enable TOTP until /totp/enable is called.
   */
  @Post('totp/setup')
  @HttpCode(HttpStatus.OK)
  async totpSetup(
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<TotpSetupResponseData>> {
    const data = await this.authService.setupTotp(req.user.sub);
    return { success: true, data };
  }

  /**
   * POST /api/auth/totp/enable
   * Verifies the TOTP code from the authenticator app and activates TOTP.
   * Returns one-time backup codes — user must save these.
   */
  @Post('totp/enable')
  @HttpCode(HttpStatus.OK)
  async totpEnable(
    @Body(new ZodValidationPipe(totpTokenSchema)) dto: TotpTokenDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<EnableTotpResponseData>> {
    const data = await this.authService.enableTotp(req.user.sub, dto.token);
    return { success: true, data };
  }

  /**
   * POST /api/auth/totp/disable
   * Disables TOTP after verifying the current TOTP code. Deletes all backup codes.
   */
  @Post('totp/disable')
  @HttpCode(HttpStatus.OK)
  async totpDisable(
    @Body(new ZodValidationPipe(totpTokenSchema)) dto: TotpTokenDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApiSuccessResponse<null>> {
    await this.authService.disableTotp(req.user.sub, dto.token);
    return { success: true, data: null };
  }

  /**
   * POST /api/auth/totp/verify
   * Completes a two-step login by verifying a TOTP code (or backup code)
   * against the pending token issued during /auth/login.
   */
  @Public()
  @Post('totp/verify')
  @HttpCode(HttpStatus.OK)
  async totpVerify(
    @Body(new ZodValidationPipe(totpVerifySchema)) dto: TotpVerifyDto,
    @Req() req: Request,
  ): Promise<ApiSuccessResponse<LoginResponseData>> {
    const data = await this.authService.completeTotpLogin(dto.totpPendingToken, dto.code, {
      ipAddress: req.ip ?? 'unknown',
      userAgent: (req.headers['user-agent'] as string | undefined) ?? 'unknown',
    });
    return { success: true, data };
  }
}
