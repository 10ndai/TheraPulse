import { Module } from '@nestjs/common';
import { TherapistClientsController } from './therapist-clients.controller';
import { TherapistClientsService } from './therapist-clients.service';
import { TherapistClientRepository } from './therapist-client.repository';
import { THERAPIST_CLIENT_REPOSITORY } from './therapist-client.repository.interface';
import { UsersModule } from '../users/users.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [UsersModule, AuditLogsModule],
  controllers: [TherapistClientsController],
  providers: [
    TherapistClientsService,
    { provide: THERAPIST_CLIENT_REPOSITORY, useClass: TherapistClientRepository },
    TherapistClientRepository,
  ],
  exports: [THERAPIST_CLIENT_REPOSITORY, TherapistClientsService],
})
export class TherapistClientsModule {}
