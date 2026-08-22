import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { ConfigService } from '@nestjs/config';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { JwtService } from '@nestjs/jwt';
import { type User, type UserRole, UserStatus } from '@prisma/client';
import { compare, hash } from 'bcrypt';
import { randomBytes } from 'crypto';
import type { IUserRepository } from '../users/users.repository.interface';
import { USER_REPOSITORY } from '../users/users.repository.interface';
import type { IRefreshTokenRepository } from './refresh-token.repository.interface';
import { REFRESH_TOKEN_REPOSITORY } from './refresh-token.repository.interface';
import type { IBackupCodeRepository } from './backup-code.repository.interface';
import { BACKUP_CODE_REPOSITORY } from './backup-code.repository.interface';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../audit-logs/audit-log.service';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { LoginRateLimiter } from './login-rate-limiter';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { TotpService } from './totp.service';
import type { TotpSecretResult } from './totp.service';
import * as qrcode from 'qrcode';

export interface RequestMeta {
  ipAddress: string;
  userAgent: string;
}

/** Safe user data returned after registration or login — no credentials. */
export type RegisterResponseData = Omit<User, 'passwordHash' | 'totpSecret'>;

/** The authenticated user, secrets stripped — same shape register and login return. */
export type CurrentUserResponseData = RegisterResponseData;

/** Accepted role values for public registration (ADMIN excluded). */
export type PublicRole = 'THERAPIST' | 'CLIENT';

export interface RegisterDto {
  email: string;
  password: string;
  role: PublicRole;
}

export interface LoginDto {
  email: string;
  password: string;
}

/** Returned for users without TOTP, or clients. */
export interface LoginResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: RegisterResponseData;
}

/** Returned for TOTP-enabled therapists — full login requires TOTP verification. */
export interface TotpPendingResponseData {
  requiresTotpVerification: true;
  totpPendingToken: string;
}

export interface RefreshResponseData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface TotpSetupResponseData {
  otpauthUri: string;
  qrCodeDataUrl: string;
}

export interface EnableTotpResponseData {
  backupCodes: string[];
}

/** JWT access token payload. */
export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: UserRole;
}

interface TotpPendingPayload {
  sub: string;
  purpose: 'totp_pending';
}

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

@Injectable()
export class AuthService {
  private readonly bcryptCost: number;

  constructor(
    @Inject(USER_REPOSITORY)
    private readonly userRepo: IUserRepository,
    @Inject(REFRESH_TOKEN_REPOSITORY)
    private readonly refreshTokenRepo: IRefreshTokenRepository,
    @Inject(BACKUP_CODE_REPOSITORY)
    private readonly backupCodeRepo: IBackupCodeRepository,
    private readonly auditLogService: AuditLogService,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
    private readonly rateLimiter: LoginRateLimiter,
    private readonly totpService: TotpService,
  ) {
    this.bcryptCost = this.config.get<number>('BCRYPT_COST_FACTOR', 12);
  }

  // ── register() ────────────────────────────────────────────────────────────

  /**
   * Registers a new user.
   * - THERAPIST → status PENDING (requires admin approval before login).
   * - CLIENT    → status ACTIVE (can log in immediately).
   */
  async register(dto: RegisterDto, meta: RequestMeta): Promise<RegisterResponseData> {
    const existing = await this.userRepo.findByEmail(dto.email);
    if (existing) {
      throw new ConflictException('Email already registered');
    }

    const passwordHash = await hash(dto.password, this.bcryptCost);
    const status = dto.role === 'THERAPIST' ? UserStatus.PENDING : UserStatus.ACTIVE;

    const user = await this.userRepo.create({
      email: dto.email,
      passwordHash,
      role: dto.role as UserRole,
      status,
    });

    await this.auditLogService.log({
      actorId: user.id,
      action: 'user.register',
      resourceType: 'user',
      resourceId: user.id,
      details: { role: user.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const { passwordHash: _ph, totpSecret: _ts, ...safeUser } = user;
    return safeUser;
  }

  // ── getCurrentUser() ──────────────────────────────────────────────────────

  /**
   * Resolves the authenticated user for GET /auth/me.
   *
   * The id comes from the verified access-token subject, never from client
   * input, so a caller can only ever read their own record. Secrets are
   * stripped the same way register() and login() do.
   */
  async getCurrentUser(userId: string): Promise<CurrentUserResponseData> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new NotFoundException('User not found');
    }
    const { passwordHash: _ph, totpSecret: _ts, ...safeUser } = user;
    return safeUser;
  }

  // ── login() ───────────────────────────────────────────────────────────────

  /**
   * Authenticates a user.
   * - If TOTP is enabled: returns a short-lived pending token instead of full tokens.
   * - Otherwise: issues JWT access + refresh tokens immediately.
   */
  async login(
    dto: LoginDto,
    meta: RequestMeta,
  ): Promise<LoginResponseData | TotpPendingResponseData> {
    const user = await this.userRepo.findByEmail(dto.email);
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.rateLimiter.check(dto.email);

    const passwordMatch = await compare(dto.password, user.passwordHash);
    if (!passwordMatch) {
      this.rateLimiter.recordFailure(dto.email);
      await this.auditLogService.log({
        actorId: user.id,
        action: 'user.login.failed',
        resourceType: 'user',
        resourceId: user.id,
        details: { reason: 'invalid_password' },
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status === UserStatus.PENDING) {
      throw new UnauthorizedException('Account pending approval');
    }
    if (user.status === UserStatus.SUSPENDED) {
      throw new UnauthorizedException('Account suspended');
    }
    if (user.status === UserStatus.DELETED) {
      throw new UnauthorizedException('Invalid credentials');
    }

    this.rateLimiter.reset(dto.email);

    // TOTP-enabled users must complete a second factor before receiving tokens
    if (user.totpEnabled) {
      const totpPendingToken = this.jwtService.sign(
        { sub: user.id, purpose: 'totp_pending' },
        { expiresIn: '5m' },
      );
      return { requiresTotpVerification: true, totpPendingToken };
    }

    return this.issueTokens(user, meta);
  }

  // ── completeTotpLogin() ───────────────────────────────────────────────────

  /**
   * Second factor for TOTP-enabled users.
   * Accepts either a 6-digit TOTP code or an 8-char backup code.
   * Issues full access + refresh tokens on success.
   */
  async completeTotpLogin(
    totpPendingToken: string,
    code: string,
    meta: RequestMeta,
  ): Promise<LoginResponseData> {
    let payload: TotpPendingPayload;
    try {
      payload = this.jwtService.verify<TotpPendingPayload>(totpPendingToken);
    } catch {
      throw new UnauthorizedException('Invalid or expired TOTP session');
    }

    if (payload.purpose !== 'totp_pending') {
      throw new UnauthorizedException('Invalid TOTP session token');
    }

    const user = await this.userRepo.findById(payload.sub);
    if (!user || !user.totpEnabled || !user.totpSecret) {
      throw new UnauthorizedException('Invalid TOTP session');
    }

    // Try TOTP code first
    if (this.totpService.verifyToken(user.totpSecret, code)) {
      return this.issueTokens(user, meta);
    }

    // Fall back to backup codes
    const unusedCodes = await this.backupCodeRepo.findUnusedByUser(user.id);
    for (const backupCode of unusedCodes) {
      const matches = await compare(code, backupCode.codeHash);
      if (matches) {
        await this.backupCodeRepo.markUsed(backupCode.id);
        return this.issueTokens(user, meta);
      }
    }

    throw new UnauthorizedException('Invalid TOTP code');
  }

  // ── setupTotp() ───────────────────────────────────────────────────────────

  /**
   * Generates a TOTP secret for the user and returns the OTP auth URI + QR code.
   * Does NOT enable TOTP — the user must verify the code via enableTotp().
   */
  async setupTotp(userId: string): Promise<TotpSetupResponseData> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled');
    }

    const { secret, otpauthUri }: TotpSecretResult = this.totpService.generateSecret(user.email);

    await this.userRepo.update(userId, { totpSecret: secret });

    const qrCodeDataUrl = await qrcode.toDataURL(otpauthUri);
    return { otpauthUri, qrCodeDataUrl };
  }

  // ── enableTotp() ──────────────────────────────────────────────────────────

  /**
   * Verifies the TOTP code against the stored secret, then activates TOTP for the user.
   * Generates and returns 8 single-use backup codes (plaintext, shown once).
   */
  async enableTotp(userId: string, totpCode: string): Promise<EnableTotpResponseData> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.totpSecret) {
      throw new BadRequestException('TOTP setup not initiated — call /auth/totp/setup first');
    }
    if (user.totpEnabled) {
      throw new BadRequestException('TOTP is already enabled');
    }

    if (!this.totpService.verifyToken(user.totpSecret, totpCode)) {
      throw new BadRequestException('Invalid TOTP code');
    }

    const plainCodes = this.totpService.generateBackupCodes();
    const codeHashes = await Promise.all(plainCodes.map((code) => hash(code, this.bcryptCost)));

    await this.userRepo.update(userId, { totpEnabled: true });
    await this.backupCodeRepo.createMany(userId, codeHashes);

    return { backupCodes: plainCodes };
  }

  // ── disableTotp() ─────────────────────────────────────────────────────────

  /**
   * Disables TOTP for the user after verifying the current TOTP code.
   * Deletes all backup codes.
   */
  async disableTotp(userId: string, totpCode: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }
    if (!user.totpEnabled) {
      throw new BadRequestException('TOTP is not enabled');
    }

    if (!this.totpService.verifyToken(user.totpSecret!, totpCode)) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.userRepo.update(userId, { totpEnabled: false, totpSecret: null });
    await this.backupCodeRepo.deleteAllForUser(userId);
  }

  // ── refreshTokens() ───────────────────────────────────────────────────────

  /**
   * Rotates a refresh token: validates the old one, revokes it, and issues new tokens.
   * On reuse detection (already-revoked token): all tokens for the user are revoked.
   */
  async refreshTokens(rawRefreshToken: string, meta: RequestMeta): Promise<RefreshResponseData> {
    const separatorIndex = rawRefreshToken.indexOf(':');
    if (separatorIndex === -1) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const tokenId = rawRefreshToken.slice(0, separatorIndex);
    const rawToken = rawRefreshToken.slice(separatorIndex + 1);

    const record = await this.refreshTokenRepo.findById(tokenId);
    if (!record) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.revokedAt !== null) {
      await this.refreshTokenRepo.revokeAllForUser(record.userId);
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (record.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token expired');
    }

    const tokenMatch = await compare(rawToken, record.tokenHash);
    if (!tokenMatch) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    await this.refreshTokenRepo.revoke(tokenId);

    const user = await this.userRepo.findById(record.userId);
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' },
    );

    const newRawToken = randomBytes(32).toString('hex');
    const newRecord = await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: await hash(newRawToken, this.bcryptCost),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    await this.auditLogService.log({
      actorId: user.id,
      action: 'user.token.refresh',
      resourceType: 'user',
      resourceId: user.id,
      details: {},
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    return {
      accessToken,
      refreshToken: `${newRecord.id}:${newRawToken}`,
      expiresIn: 900,
    };
  }

  // ── private helpers ───────────────────────────────────────────────────────

  private async issueTokens(user: User, meta: RequestMeta): Promise<LoginResponseData> {
    const accessToken = this.jwtService.sign(
      { sub: user.id, email: user.email, role: user.role },
      { expiresIn: '15m' },
    );

    const rawToken = randomBytes(32).toString('hex');
    const tokenRecord = await this.refreshTokenRepo.create({
      userId: user.id,
      tokenHash: await hash(rawToken, this.bcryptCost),
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    });

    await this.auditLogService.log({
      actorId: user.id,
      action: 'user.login',
      resourceType: 'user',
      resourceId: user.id,
      details: { role: user.role },
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
    });

    const { passwordHash: _ph, totpSecret: _ts, ...safeUser } = user;
    return {
      accessToken,
      refreshToken: `${tokenRecord.id}:${rawToken}`,
      expiresIn: 900,
      user: safeUser,
    };
  }
}
