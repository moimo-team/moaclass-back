import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReviewAiSummaryService } from './review-ai-summary.service';

@Injectable()
export class ReviewAiSummaryScheduler {
  private readonly logger = new Logger(ReviewAiSummaryScheduler.name);

  constructor(
    private readonly reviewAiSummaryService: ReviewAiSummaryService,
  ) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
    timeZone: 'Asia/Seoul',
  })
  async handleMidnightSummaryJob() {
    this.logger.log('Started daily lesson review summary job');
    await this.reviewAiSummaryService.refreshAllLessonReviewSummaries();
    this.logger.log('Finished daily lesson review summary job');
  }
}
