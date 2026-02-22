import { PrismaService } from '../../prisma/prisma.service';
import { ReviewAiSummaryService } from './review-ai-summary.service';

const mockGenerateContent = jest.fn();

jest.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
    getGenerativeModel: jest.fn().mockReturnValue({
      generateContent: mockGenerateContent,
    }),
  })),
}));

describe('ReviewAiSummaryService (integration, real DB)', () => {
  let prisma: PrismaService;
  let service: ReviewAiSummaryService;

  let runKey: string;
  let uniqueSeq = 0;
  const userIds: number[] = [];
  const regionIds: number[] = [];
  const lessonCategoryIds: number[] = [];
  const lessonIds: number[] = [];
  const scheduleIds: number[] = [];
  const enrollmentIds: number[] = [];
  const reviewIds: number[] = [];

  const originalGeminiApiKey = process.env.GEMINI_API_KEY;

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run integration tests.');
    }

    runKey = `review_ai_summary_${Date.now()}`;
    process.env.GEMINI_API_KEY = 'test-gemini-api-key';

    prisma = new PrismaService();
    await prisma.$connect();
    service = new ReviewAiSummaryService(prisma);
  });

  afterEach(async () => {
    mockGenerateContent.mockReset();

    if (reviewIds.length > 0) {
      await prisma.reviewImage.deleteMany({
        where: { reviewId: { in: reviewIds } },
      });
      await prisma.review.deleteMany({
        where: { id: { in: reviewIds } },
      });
      reviewIds.length = 0;
    }

    if (enrollmentIds.length > 0) {
      await prisma.enrollment.deleteMany({
        where: { id: { in: enrollmentIds } },
      });
      enrollmentIds.length = 0;
    }

    if (scheduleIds.length > 0) {
      await prisma.lessonSchedule.deleteMany({
        where: { id: { in: scheduleIds } },
      });
      scheduleIds.length = 0;
    }

    if (lessonIds.length > 0) {
      await prisma.lesson.deleteMany({
        where: { id: { in: lessonIds } },
      });
      lessonIds.length = 0;
    }

    if (lessonCategoryIds.length > 0) {
      await prisma.lessonCategory.deleteMany({
        where: { id: { in: lessonCategoryIds } },
      });
      lessonCategoryIds.length = 0;
    }

    if (regionIds.length > 0) {
      await prisma.region.deleteMany({
        where: { id: { in: regionIds } },
      });
      regionIds.length = 0;
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({
        where: { id: { in: userIds } },
      });
      userIds.length = 0;
    }
  });

  afterAll(async () => {
    if (originalGeminiApiKey === undefined) {
      delete process.env.GEMINI_API_KEY;
    } else {
      process.env.GEMINI_API_KEY = originalGeminiApiKey;
    }

    await prisma.$disconnect();
  });

  async function createLessonOwnerAndLesson(
    suffix: string,
    reviewAiSummary?: string | null,
  ) {
    uniqueSeq += 1;
    const token = uniqueSeq.toString().padStart(6, '0');

    const regionName = `r_${token}`;
    const regionRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `
      WITH next_id AS (
        SELECT COALESCE(MAX(id), 0) + 1 AS id FROM regions
      )
      INSERT INTO regions (id, name)
      SELECT id, $1 FROM next_id
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      regionName,
    );
    const regionId = regionRows[0]?.id;
    if (!regionId) {
      throw new Error('Failed to create/fetch region for integration test.');
    }
    regionIds.push(regionId);

    const categoryName = `c_${token}`;
    const categoryRows = await prisma.$queryRawUnsafe<Array<{ id: number }>>(
      `
      WITH next_id AS (
        SELECT COALESCE(MAX(id), 0) + 1 AS id FROM lesson_categories
      )
      INSERT INTO lesson_categories (id, name)
      SELECT id, $1 FROM next_id
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id
      `,
      categoryName,
    );
    const categoryId = categoryRows[0]?.id;
    if (!categoryId) {
      throw new Error(
        'Failed to create/fetch lesson category for integration test.',
      );
    }
    lessonCategoryIds.push(categoryId);

    const user = await prisma.user.create({
      data: {
        email: `${runKey}_teacher_${suffix}_${token}@example.com`,
        nickname: `${runKey}_teacher_${suffix}_${token}`,
        provider: 'GOOGLE',
        providerId: `${runKey}_teacher_provider_${suffix}_${token}`,
      },
    });
    userIds.push(user.id);

    const lesson = await prisma.lesson.create({
      data: {
        userId: user.id,
        lessonCategoryId: categoryId,
        title: `${runKey}_lesson_${suffix}_${token}`,
        description: 'review ai summary test lesson',
        level: 'BEGINNER',
        durationSec: 5400,
        curriculum: 'curriculum',
        maxParticipants: 10,
        representativeImage: 'https://example.com/lesson.png',
        regionId,
        address: 'Seoul Mapo-gu World Cup-ro 45',
        latitude: 37.55,
        longitude: 126.91,
        detailAddress: '3F 301',
        directionsText: '5 minutes from station exit 2',
        ...(reviewAiSummary !== undefined && { reviewAiSummary }),
      },
    });
    lessonIds.push(lesson.id);

    return { lesson };
  }

  async function createAcceptedEnrollment(userId: number, lessonId: number) {
    const schedule = await prisma.lessonSchedule.create({
      data: {
        lessonId,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      },
    });
    scheduleIds.push(schedule.id);

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        scheduleId: schedule.id,
        status: 'ACCEPTED',
        originPrice: 30000,
        discountAmount: 0,
        finalPrice: 30000,
        quantity: 1,
      },
    });
    enrollmentIds.push(enrollment.id);

    return { enrollment, schedule };
  }

  it('refreshAllLessonReviewSummaries: 5+ reviews exist => stores generated summary in lesson.reviewAiSummary', async () => {
    const { lesson } = await createLessonOwnerAndLesson('1');

    uniqueSeq += 1;
    const reviewerToken = uniqueSeq.toString().padStart(6, '0');
    const reviewer = await prisma.user.create({
      data: {
        email: `${runKey}_reviewer_1_${reviewerToken}@example.com`,
        nickname: `${runKey}_reviewer_1_${reviewerToken}`,
        provider: 'GOOGLE',
        providerId: `${runKey}_reviewer_provider_1_${reviewerToken}`,
      },
    });
    userIds.push(reviewer.id);

    const contents = [
      'The instructor explains clearly and answers questions quickly.',
      'Hands-on practice helped understanding and review points were useful.',
      'Class materials were organized and easy to review later.',
      'The class pace was comfortable for first-time learners.',
      'Feedback was specific and practical for improvement.',
    ];

    for (let i = 0; i < contents.length; i += 1) {
      const { enrollment } = await createAcceptedEnrollment(
        reviewer.id,
        lesson.id,
      );
      const review = await prisma.review.create({
        data: {
          userId: reviewer.id,
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          rating: 4.5 + (i % 2) * 0.1,
          content: contents[i],
        },
      });
      reviewIds.push(review.id);
    }

    const generatedSummary =
      '[Top themes]\\n1) clarity of explanation\\n2) quality of answers\\n3) practice-first format\\n\\n[Frequent Q&A]\\nQ1. Is this okay for beginners?\\nA1. Many reviews say the class is easy to follow.';

    mockGenerateContent.mockResolvedValue({
      response: { text: () => generatedSummary },
    });

    await service.refreshAllLessonReviewSummaries();

    const updatedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
      select: { reviewAiSummary: true },
    });

    expect(mockGenerateContent).toHaveBeenCalledTimes(1);
    expect(updatedLesson?.reviewAiSummary).toBe(generatedSummary);
  });

  it('refreshAllLessonReviewSummaries: less than 5 reviews => clears stale reviewAiSummary to null', async () => {
    const { lesson } = await createLessonOwnerAndLesson('2', 'old summary');

    uniqueSeq += 1;
    const reviewerToken = uniqueSeq.toString().padStart(6, '0');
    const reviewer = await prisma.user.create({
      data: {
        email: `${runKey}_reviewer_2_${reviewerToken}@example.com`,
        nickname: `${runKey}_reviewer_2_${reviewerToken}`,
        provider: 'GOOGLE',
        providerId: `${runKey}_reviewer_provider_2_${reviewerToken}`,
      },
    });
    userIds.push(reviewer.id);

    for (let i = 0; i < 4; i += 1) {
      const { enrollment } = await createAcceptedEnrollment(
        reviewer.id,
        lesson.id,
      );
      const review = await prisma.review.create({
        data: {
          userId: reviewer.id,
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          rating: 4.0 + i * 0.1,
          content: `short review ${i + 1}`,
        },
      });
      reviewIds.push(review.id);
    }

    await service.refreshAllLessonReviewSummaries();

    const updatedLesson = await prisma.lesson.findUnique({
      where: { id: lesson.id },
      select: { reviewAiSummary: true },
    });

    expect(updatedLesson?.reviewAiSummary).toBeNull();
    expect(mockGenerateContent).not.toHaveBeenCalled();
  });
});
