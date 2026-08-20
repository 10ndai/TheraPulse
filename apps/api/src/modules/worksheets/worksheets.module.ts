import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { WorksheetTemplatesController } from './worksheet-templates.controller';
import { WorksheetTemplatesService } from './worksheet-templates.service';
import { WorksheetTemplateRepository } from './worksheet-templates.repository';
import { WORKSHEET_TEMPLATE_REPOSITORY } from './worksheet-templates.repository.interface';
import { WorksheetAssignmentsController } from './worksheet-assignments.controller';
import { WorksheetAssignmentsService } from './worksheet-assignments.service';
import { WorksheetAssignmentsRepository } from './worksheet-assignments.repository';
import { WORKSHEET_ASSIGNMENT_REPOSITORY } from './worksheet-assignments.repository.interface';
import { WorksheetSubmissionsController } from './worksheet-submissions.controller';
import { WorksheetSubmissionsService } from './worksheet-submissions.service';
import { WorksheetSubmissionsRepository } from './worksheet-submissions.repository';
import { WORKSHEET_SUBMISSION_REPOSITORY } from './worksheet-submissions.repository.interface';
import { ScoringService } from './scoring.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, EncryptionModule, NotificationsModule],
  controllers: [
    WorksheetTemplatesController,
    WorksheetAssignmentsController,
    WorksheetSubmissionsController,
  ],
  providers: [
    WorksheetTemplatesService,
    {
      provide: WORKSHEET_TEMPLATE_REPOSITORY,
      useClass: WorksheetTemplateRepository,
    },
    WorksheetAssignmentsService,
    {
      provide: WORKSHEET_ASSIGNMENT_REPOSITORY,
      useClass: WorksheetAssignmentsRepository,
    },
    WorksheetSubmissionsService,
    {
      provide: WORKSHEET_SUBMISSION_REPOSITORY,
      useClass: WorksheetSubmissionsRepository,
    },
    ScoringService,
  ],
  exports: [
    WorksheetTemplatesService,
    WorksheetAssignmentsService,
    WORKSHEET_ASSIGNMENT_REPOSITORY,
    WorksheetSubmissionsService,
    WORKSHEET_SUBMISSION_REPOSITORY,
    ScoringService,
  ],
})
export class WorksheetsModule {}
