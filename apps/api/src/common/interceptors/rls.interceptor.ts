import { Injectable } from '@nestjs/common';
import type { CallHandler, ExecutionContext, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
// eslint-disable-next-line @typescript-eslint/consistent-type-imports -- DI token, needed as value for reflect-metadata
import { RlsContextService } from './rls-context.service';

interface RequestUser {
  sub: string;
  role: string;
}

/**
 * Per-request interceptor that stores the authenticated user's ID and role
 * into AsyncLocalStorage so the Prisma RLS middleware can set PostgreSQL
 * session variables (app.user_id, app.user_role) for each query.
 *
 * Must run AFTER JwtAuthGuard sets request.user.
 */
@Injectable()
export class RlsInterceptor implements NestInterceptor {
  constructor(private readonly rlsContext: RlsContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{ user?: RequestUser }>();
    const user = request.user;

    if (!user) {
      return next.handle();
    }

    return new Observable((subscriber) => {
      this.rlsContext.run({ userId: user.sub, role: user.role }, () => {
        next.handle().subscribe({
          next: (value: unknown) => subscriber.next(value),
          error: (err: unknown) => subscriber.error(err),
          complete: () => subscriber.complete(),
        });
      });
    });
  }
}
