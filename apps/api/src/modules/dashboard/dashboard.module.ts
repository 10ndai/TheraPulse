import { Module } from '@nestjs/common';
import { WorksheetsModule } from '../worksheets/worksheets.module';
import { SessionNotesModule } from '../session-notes/session-notes.module';
import { UsersModule } from '../users/users.module';
import { DashboardService } from './dashboard.service';
import { DashboardController } from './dashboard.controller';

@Module({
  imports: [WorksheetsModule, SessionNotesModule, UsersModule],
  controllers: [DashboardController],
  providers: [DashboardService],
  exports: [DashboardService],
})
export class DashboardModule {}
