import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { UploadModule } from '../upload/upload.module';
import { ReviewsController } from './reviews.controller';
import { ReviewsService } from './reviews.service';
import { LessonReviewsController } from './lesson-reviews.controller';
import { TeacherReviewsController } from './teacher-reviews.controller';
import { CouponsModule } from '../coupons/coupons.module';
import { PointsModule } from '../points/points.module';
import { ReviewAiSummaryService } from './review-ai-summary.service';
import { ReviewAiSummaryScheduler } from './review-ai-summary.scheduler';

@Module({
  imports: [PrismaModule, UploadModule, CouponsModule, PointsModule],
  controllers: [
    ReviewsController,
    LessonReviewsController,
    TeacherReviewsController,
  ],
  providers: [ReviewsService, ReviewAiSummaryService, ReviewAiSummaryScheduler],
})
export class ReviewsModule {}
