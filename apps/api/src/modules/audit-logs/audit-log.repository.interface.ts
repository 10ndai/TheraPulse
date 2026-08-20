import type { AuditLog } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';

export const AUDIT_LOG_REPOSITORY = Symbol('IAuditLogRepository');

/** Input for creating a new audit log entry. */
export interface CreateAuditLogInput {
  /** Nullable: system-initiated actions have no human actor. */
  actorId?: string;
  /** Semantic action name in dot-notation: domain.verb (e.g. 'user.login'). */
  action: string;
  /** The domain entity type affected (e.g. 'user', 'worksheet', 'session_note'). */
  resourceType: string;
  /** The specific entity ID, if applicable. */
  resourceId?: string;
  /**
   * Non-sensitive context only: field names, counts, status codes.
   * NEVER include field values, PHI, or PII here.
   */
  details?: Record<string, unknown>;
  ipAddress: string;
  userAgent: string;
}

/**
 * Append-only repository for audit logs.
 * No update() or delete() methods — audit logs are immutable by design
 * and protected by a database-level RULE that blocks UPDATE and DELETE.
 */
export interface IAuditLogRepository {
  create(data: CreateAuditLogInput): Promise<AuditLog>;
  findAll(options: PaginationOptions): Promise<PaginatedResult<AuditLog>>;
  findById(id: string): Promise<AuditLog | null>;
  /** Returns all audit entries for a given actor, newest first. */
  findByActor(actorId: string, options: PaginationOptions): Promise<PaginatedResult<AuditLog>>;
  /** Returns all audit entries for a specific resource, newest first. */
  findByResource(
    resourceType: string,
    resourceId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<AuditLog>>;
}
