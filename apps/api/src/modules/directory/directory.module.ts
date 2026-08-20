import { Module } from '@nestjs/common';
import { DirectoryController } from './directory.controller';
import { DirectoryService } from './directory.service';
import { TherapistProfilesModule } from '../therapist-profiles/therapist-profiles.module';

@Module({
  imports: [TherapistProfilesModule],
  controllers: [DirectoryController],
  providers: [DirectoryService],
})
export class DirectoryModule {}
