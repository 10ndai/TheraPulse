import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { UsersModule } from '../users/users.module';
import { TherapistProfilesModule } from '../therapist-profiles/therapist-profiles.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';

@Module({
  imports: [UsersModule, TherapistProfilesModule, AuditLogsModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
