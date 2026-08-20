import { Module } from '@nestjs/common';
import { TherapistProfilesController } from './therapist-profiles.controller';
import { TherapistProfilesService } from './therapist-profiles.service';
import { TherapistProfileRepository } from './therapist-profiles.repository';
import { THERAPIST_PROFILE_REPOSITORY } from './therapist-profiles.repository.interface';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [TherapistProfilesController],
  providers: [
    TherapistProfilesService,
    { provide: THERAPIST_PROFILE_REPOSITORY, useClass: TherapistProfileRepository },
    TherapistProfileRepository,
  ],
  exports: [THERAPIST_PROFILE_REPOSITORY, TherapistProfileRepository, TherapistProfilesService],
})
export class TherapistProfilesModule {}
