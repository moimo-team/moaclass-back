import { Module } from '@nestjs/common';
import { LessonsController } from './lessons.controller';
import { LessonSchedulesController } from './lesson-schedules.controller';
import { LessonsService } from './lessons.service';
import { LessonSchedulesService } from './lesson-schedules.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadModule } from '../upload/upload.module';

@Module({
  imports: [UploadModule],
  controllers: [LessonsController, LessonSchedulesController],
  providers: [LessonsService, LessonSchedulesService, PrismaService],

  exports: [LessonsService, LessonSchedulesService],
})
export class LessonsModule {}
