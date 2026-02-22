import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class ReviewAiSummaryService {
  private readonly logger = new Logger(ReviewAiSummaryService.name);
  private static readonly MIN_REVIEW_COUNT_FOR_SUMMARY = 5;
  private static readonly LESSON_BATCH_SIZE = 100;
  private static readonly MAX_CONCURRENCY = 3;

  constructor(private readonly prisma: PrismaService) {}

  async refreshAllLessonReviewSummaries(options?: { lessonIds?: number[] }) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      this.logger.warn(
        'GEMINI_API_KEY is missing. Skip review AI summary job.',
      );
      return;
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    let cursorId: number | undefined;

    while (true) {
      const whereCondition = {
        status: { not: 'DELETED' as const },
        ...(options?.lessonIds && { id: { in: options.lessonIds } }),
        ...(cursorId !== undefined && {
          AND: [{ id: { gt: cursorId } }],
        }),
      };

      const lessons = await this.prisma.lesson.findMany({
        where: whereCondition,
        orderBy: { id: 'asc' },
        take: ReviewAiSummaryService.LESSON_BATCH_SIZE,
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

      if (lessons.length === 0) {
        break;
      }

      await this.runWithConcurrencyLimit(
        lessons,
        ReviewAiSummaryService.MAX_CONCURRENCY,
        async (lesson) => {
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
              return;
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
              return;
            }

            const summary = await this.generateSummaryForLesson(
              model,
              lesson.title,
              lesson.reviewAiSummary,
              lesson.reviews,
            );

            if (!summary) return;

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
        },
      );

      cursorId = lessons[lessons.length - 1]?.id;
    }
  }

  private async runWithConcurrencyLimit<T>(
    items: T[],
    maxConcurrency: number,
    worker: (item: T) => Promise<void>,
  ): Promise<void> {
    const safeConcurrency = Math.max(1, maxConcurrency);
    let currentIndex = 0;

    const runWorker = async () => {
      while (true) {
        const index = currentIndex;
        currentIndex += 1;
        if (index >= items.length) {
          return;
        }
        await worker(items[index]);
      }
    };

    const workers = Array.from(
      { length: Math.min(safeConcurrency, items.length) },
      () => runWorker(),
    );

    await Promise.all(workers);
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
