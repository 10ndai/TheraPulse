import { SetMetadata } from '@nestjs/common';

/** Metadata key used by AuditInterceptor to read the semantic action name. */
export const AUDIT_ACTION_KEY = 'audit_action';

/**
 * Marks a route handler with a semantic audit action name.
 * The AuditInterceptor reads this metadata and writes an audit log entry
 * on every request to the decorated handler.
 *
 * Convention: dot-notation `domain.verb` — the first segment becomes the
 * `resourceType` in the audit log entry.
 *
 * @example
 * \@AuditAction('user.login')
 * \@Post('login')
 * login(@Body() dto: LoginDto) { ... }
 *
 * \@AuditAction('worksheet.submit')
 * \@Post(':id/submit')
 * submit(@Param('id') id: string) { ... }
 */
export const AuditAction = (action: string) => SetMetadata(AUDIT_ACTION_KEY, action);
