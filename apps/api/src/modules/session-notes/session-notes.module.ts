import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { EncryptionModule } from '../encryption/encryption.module';
import { SessionNotesController } from './session-notes.controller';
import { SessionNotesRepository } from './session-notes.repository';
import { SESSION_NOTE_REPOSITORY } from './session-notes.repository.interface';
import { SessionNotesService } from './session-notes.service';

@Module({
  imports: [PrismaModule, AuditLogsModule, EncryptionModule],
  controllers: [SessionNotesController],
  providers: [
    SessionNotesService,
    { provide: SESSION_NOTE_REPOSITORY, useClass: SessionNotesRepository },
  ],
  exports: [SessionNotesService, SESSION_NOTE_REPOSITORY],
})
export class SessionNotesModule {}
