import { Inject, Injectable } from '@nestjs/common';
import type { AuditLog } from '@prisma/client';
import type { PaginatedResult } from '@therapulse/shared';
import type { PaginationOptions } from '../../common/repositories/base.repository.interface';
import {
  AUDIT_LOG_REPOSITORY,
  type CreateAuditLogInput,
  type IAuditLogRepository,
} from './audit-log.repository.interface';

/**
 * Provides audit logging capabilities to the rest of the application.
 * Inject this service into guards, interceptors, and domain services
 * to record security-relevant events.
 *
 * NEVER log PHI/PII in the details field — only metadata such as
 * field names, counts, and status codes.
 */
@Injectable()
export class AuditLogService {
  constructor(
    @Inject(AUDIT_LOG_REPOSITORY)
    private readonly auditLogRepository: IAuditLogRepository,
  ) {}

  async log(data: CreateAuditLogInput): Promise<AuditLog> {
    return this.auditLogRepository.create(data);
  }

  async findByResource(
    resourceType: string,
    resourceId: string,
    options: PaginationOptions,
  ): Promise<PaginatedResult<AuditLog>> {
    return this.auditLogRepository.findByResource(resourceType, resourceId, options);
  }
}
