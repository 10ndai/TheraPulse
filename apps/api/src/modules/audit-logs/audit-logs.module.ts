import { Module } from '@nestjs/common';
import { AuditLogRepository } from './audit-log.repository';
import { AUDIT_LOG_REPOSITORY } from './audit-log.repository.interface';
import { AuditLogService } from './audit-log.service';
import { AuditLogsController } from './audit-logs.controller';

@Module({
  controllers: [AuditLogsController],
  providers: [
    { provide: AUDIT_LOG_REPOSITORY, useClass: AuditLogRepository },
    // Also provide by class so tests can resolve it directly
    AuditLogRepository,
    AuditLogService,
  ],
  exports: [AuditLogService, AUDIT_LOG_REPOSITORY, AuditLogRepository],
})
export class AuditLogsModule {}
