import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { Reflector } from '@nestjs/core';
import { from, of, throwError, type Observable } from 'rxjs';
import { catchError, map, mergeMap } from 'rxjs/operators';
import type { Request } from 'express';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { AuditLogService } from '../../modules/audit-logs/audit-log.service';
import { AUDIT_ACTION_KEY } from '../decorators/audit-action.decorator';
import type { CreateAuditLogInput } from '../../modules/audit-logs/audit-log.repository.interface';

type AuthenticatedRequest = Request & { user?: { sub: string } };

/**
 * Writes an audit log entry for every route handler decorated with
 * @AuditAction('domain.verb'). Handlers without the decorator are
 * passed through unchanged — no audit entry is written.
 *
 * Resilience guarantee: if the audit log write fails (e.g. DB outage),
 * the response or error is still forwarded to the client. The audit
 * system must never take down the primary API.
 *
 * Register globally in AppModule via APP_INTERCEPTOR.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const action = this.reflector.get<string | undefined>(AUDIT_ACTION_KEY, context.getHandler());

    if (!action) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const entry = this.buildEntry(request, action);

    return next.handle().pipe(
      mergeMap((data: unknown) =>
        from(this.auditLogService.log(entry)).pipe(
          map(() => data),
          // Audit write failure must never break the successful response
          catchError(() => of(data)),
        ),
      ),
      catchError((error: unknown) =>
        from(this.auditLogService.log({ ...entry, details: { failed: true } })).pipe(
          // Swallow audit failure so the original error is preserved
          catchError(() => of(null)),
          mergeMap(() => throwError(() => error as Error)),
        ),
      ),
    );
  }

  private buildEntry(request: AuthenticatedRequest, action: string): CreateAuditLogInput {
    const actorSub = request.user?.sub;
    const resourceId = (request.params as Record<string, string | undefined>)['id'];
    return {
      ...(actorSub !== undefined ? { actorId: actorSub } : {}),
      action,
      resourceType: action.split('.')[0] ?? 'unknown',
      ...(resourceId !== undefined ? { resourceId } : {}),
      ipAddress: this.extractIp(request),
      userAgent: (request.headers['user-agent'] as string | undefined) ?? 'unknown',
    };
  }

  private extractIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0]?.trim() ?? 'unknown';
    }
    return request.ip ?? 'unknown';
  }
}
