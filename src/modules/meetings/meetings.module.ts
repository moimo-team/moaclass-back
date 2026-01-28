import { Module } from '@nestjs/common';
import { MeetingsService } from './meetings.service';
import { ParticipationsService } from './participations.service';
import { MeetingsController } from './meetings.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [MeetingsController],
  providers: [MeetingsService, ParticipationsService],
})
export class MeetingsModule {}
