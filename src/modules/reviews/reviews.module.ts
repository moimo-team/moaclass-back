import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { LessonReviewsController } from './lesson-reviews.controller';
import { TeacherReviewsController } from './teacher-reviews.controller';

@Module({
  imports: [PrismaModule, UploadModule],
  controllers: [
    ReviewsController,
    LessonReviewsController,
    TeacherReviewsController,
  ],
  providers: [ReviewsService],
})
export class ReviewsModule {}
