import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { envSchema } from './config/env.schema';
import { CacheControlInterceptor } from './common/interceptors/cache-control.interceptor';
import { AuditInterceptor } from './common/interceptors/audit.interceptor';
import { RlsInterceptor } from './common/interceptors/rls.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { TherapistProfilesModule } from './modules/therapist-profiles/therapist-profiles.module';
import { ClientProfilesModule } from './modules/client-profiles/client-profiles.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { AuthModule } from './modules/auth/auth.module';
import { AdminModule } from './modules/admin/admin.module';
import { TherapistClientsModule } from './modules/therapist-clients/therapist-clients.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { WorksheetsModule } from './modules/worksheets/worksheets.module';
import { SessionNotesModule } from './modules/session-notes/session-notes.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    // Validate all required env vars at startup using the Zod schema.
    // isGlobal: true makes ConfigService available in all modules without re-importing.
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config: Record<string, unknown>) => {
        const result = envSchema.safeParse(config);
        if (!result.success) {
          throw new Error(`Environment variable validation failed:\n${result.error.message}`);
        }
        return result.data;
      },
    }),

    // Global IP-based rate limiting — 100 requests per 60-second window.
    // Login-specific per-email rate limiting is handled in AuthModule (TP-012).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 100 }],
    }),

    PrismaModule,
    AuditLogsModule,
    AuthModule,
    AdminModule,
    TherapistClientsModule,
    DirectoryModule,
    WorksheetsModule,
    SessionNotesModule,
    NotificationsModule,
    DashboardModule,
    UsersModule,
    TherapistProfilesModule,
    ClientProfilesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Apply ThrottlerGuard globally — all routes rate-limited unless @SkipThrottle()
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    // Apply Cache-Control: no-store to all responses
    { provide: APP_INTERCEPTOR, useClass: CacheControlInterceptor },
    // Write audit log entries for handlers decorated with @AuditAction()
    { provide: APP_INTERCEPTOR, useClass: AuditInterceptor },
    // Set AsyncLocalStorage RLS context from the authenticated user — runs after JwtAuthGuard
    { provide: APP_INTERCEPTOR, useClass: RlsInterceptor },
    // Validate JWT on all routes — @Public() routes are exempt
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    // Enforce @Roles() restrictions — runs after JwtAuthGuard sets request.user
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
