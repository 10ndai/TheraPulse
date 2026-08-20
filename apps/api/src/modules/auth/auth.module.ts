import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RefreshTokenRepository } from './refresh-token.repository';
import { REFRESH_TOKEN_REPOSITORY } from './refresh-token.repository.interface';
import { BackupCodeRepository } from './backup-code.repository';
import { BACKUP_CODE_REPOSITORY } from './backup-code.repository.interface';
import { LoginRateLimiter } from './login-rate-limiter';
import { TotpService } from './totp.service';
import { UsersModule } from '../users/users.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [
    UsersModule,
    AuditLogsModule,
    PrismaModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: { expiresIn: '15m' },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    TotpService,
    LoginRateLimiter,
    { provide: REFRESH_TOKEN_REPOSITORY, useClass: RefreshTokenRepository },
    { provide: BACKUP_CODE_REPOSITORY, useClass: BackupCodeRepository },
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
