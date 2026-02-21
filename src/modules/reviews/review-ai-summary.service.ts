import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewAiSummaryService {
  private readonly logger = new Logger(ReviewAiSummaryService.name);
  private static readonly MIN_REVIEW_COUNT_FOR_SUMMARY = 5;

  constructor(private readonly prisma: PrismaService) {}

  async refreshAllLessonReviewSummaries() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is missing. Skip review AI summary job.',
      );
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const lessons = await this.prisma.lesson.findMany({
      where: {
        status: { not: 'DELETED' },
      },
      select: {
        id: true,
        title: true,
        updatedAt: true,
        reviewAiSummary: true,
        reviews: {
          where: { content: { not: '' } },
          orderBy: { createdAt: 'desc' },
          select: { rating: true, content: true, updatedAt: true },
          take: 5,
        },
      },
    });

    for (const lesson of lessons) {
      try {
        if (
          lesson.reviews.length <
          ReviewAiSummaryService.MIN_REVIEW_COUNT_FOR_SUMMARY
        ) {
          if (lesson.reviewAiSummary !== null) {
            await this.prisma.lesson.update({
              where: { id: lesson.id },
              data: { reviewAiSummary: null },
            });
          }
          continue;
        }

        const latestReviewUpdatedAt = lesson.reviews.reduce(
          (latest, review) =>
            review.updatedAt > latest ? review.updatedAt : latest,
          lesson.reviews[0].updatedAt,
        );

        const summaryAlreadyFresh =
          lesson.reviewAiSummary !== null &&
          latestReviewUpdatedAt <= lesson.updatedAt;

        if (summaryAlreadyFresh) {
          continue;
        }

        const summary = await this.generateSummaryForLesson(
          model,
          lesson.title,
          lesson.reviewAiSummary,
          lesson.reviews,
        );

        if (!summary) continue;

        await this.prisma.lesson.update({
          where: { id: lesson.id },
          data: { reviewAiSummary: summary },
        });
      } catch (error) {
        this.logger.error(
          `Failed to update review summary for lessonId=${lesson.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      }
    }
  }

  private async generateSummaryForLesson(
    model: ReturnType<GoogleGenerativeAI['getGenerativeModel']>,
    lessonTitle: string,
    previousSummary: string | null,
    reviews: Array<{ rating: number; content: string; updatedAt: Date }>,
  ): Promise<string | null> {
    if (reviews.length < ReviewAiSummaryService.MIN_REVIEW_COUNT_FOR_SUMMARY) {
      return null;
    }

    const reviewText = reviews
      .map(
        (review, index) =>
          `${index + 1}. [rating ${review.rating}] ${review.content.trim()}`,
      )
      .join('\n');

    const safePreviousSummary = previousSummary?.trim() ?? '';

    const prompt = `
You are an analyst for class reviews.
Update the lesson summary using the previous summary and the 5 most recent reviews.
Write only one Korean paragraph.

Rules:
- Return only one paragraph in the style of [종합].
- Length must be between 100 and 200 Korean characters.
- Focus only on positive and neutral points.
- Exclude negative aspects entirely.
- No headings, no bullets, no Q&A format.
- Do not invent facts not present in the reviews.
- If previous summary exists, keep continuity while reflecting recent reviews.

Class title: ${lessonTitle}
Previous summary:
${safePreviousSummary || '(none)'}

Reviews:
${reviewText}
`.trim();

    const result = await model.generateContent(prompt);
    const text = result.response.text().trim();

    return text.length > 0 ? text : null;
  }
}
