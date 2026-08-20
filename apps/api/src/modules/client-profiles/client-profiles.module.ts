import { Module } from '@nestjs/common';
import { ClientProfilesController } from './client-profiles.controller';
import { ClientProfilesService } from './client-profiles.service';
import { ClientProfileRepository } from './client-profiles.repository';
import { CLIENT_PROFILE_REPOSITORY } from './client-profiles.repository.interface';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [AuditLogsModule],
  controllers: [ClientProfilesController],
  providers: [
    ClientProfilesService,
    { provide: CLIENT_PROFILE_REPOSITORY, useClass: ClientProfileRepository },
    ClientProfileRepository,
  ],
  exports: [CLIENT_PROFILE_REPOSITORY, ClientProfileRepository, ClientProfilesService],
})
export class ClientProfilesModule {}
