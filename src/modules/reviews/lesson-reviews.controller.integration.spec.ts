import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { App } from 'supertest/types';
import { LessonReviewsController } from './lesson-reviews.controller';
import { ReviewsService } from './reviews.service';
import { PrismaService } from '../../prisma/prisma.service';
import { UploadService } from '../upload/upload.service';

describe('LessonReviewsController (integration, real DB)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  let runKey: string;
  const userIds: number[] = [];
  const regionIds: number[] = [];
  const lessonCategoryIds: number[] = [];
  const lessonIds: number[] = [];
  const reviewIds: number[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run integration tests.');
    }

    runKey = `lesson_reviews_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [LessonReviewsController],
      providers: [
        ReviewsService,
        PrismaService,
        {
          provide: UploadService,
          useValue: {
            uploadFile: jest.fn(),
          },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = moduleFixture.get(PrismaService);
  });

  afterEach(async () => {
    if (reviewIds.length > 0) {
      await prisma.reviewImage.deleteMany({
        where: { reviewId: { in: reviewIds } },
      });
      await prisma.review.deleteMany({
        where: { id: { in: reviewIds } },
      });
      reviewIds.length = 0;
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
    await app.close();
  });

  async function createLessonOwnerAndLesson(suffix: string) {
    const region = await prisma.region.create({
      data: { name: `r${Math.floor(Math.random() * 9000 + 1000)}` },
    });
    regionIds.push(region.id);

    const category = await prisma.lessonCategory.create({
      data: { name: `${runKey}_category_${suffix}` },
    });
    lessonCategoryIds.push(category.id);

    const user = await prisma.user.create({
      data: {
        email: `${runKey}_user_${suffix}@example.com`,
        nickname: `${runKey}_user_${suffix}`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_${suffix}`,
      },
    });
    userIds.push(user.id);

    const lesson = await prisma.lesson.create({
      data: {
        userId: user.id,
        lessonCategoryId: category.id,
        title: `${runKey}_lesson_${suffix}`,
        description: 'review test lesson',
        level: 'BEGINNER',
        durationSec: 5400,
        curriculum: 'curriculum',
        maxParticipants: 10,
        representativeImage: 'https://example.com/lesson.png',
        regionId: region.id,
        address: '서울특별시 마포구 양화로 45',
        latitude: 37.55,
        longitude: 126.91,
        detailAddress: '3층 301호',
        directionsText: '합정역 2번 출구 도보 5분',
      },
    });
    lessonIds.push(lesson.id);

    return { user, lesson };
  }

  it('GET /lessons/:lessonId/reviews: 최신순 + 페이지네이션으로 응답한다', async () => {
    const { user, lesson } = await createLessonOwnerAndLesson('1');

    for (let i = 1; i <= 7; i += 1) {
      const review = await prisma.review.create({
        data: {
          userId: user.id,
          lessonId: lesson.id,
          rating: 4.0 + i * 0.1,
          content: `리뷰 ${i}`,
          representativeImage:
            i % 2 === 0 ? `https://example.com/r${i}.png` : null,
        },
      });
      reviewIds.push(review.id);
    }

    const response = await request(app.getHttpServer())
      .get(`/lessons/${lesson.id}/reviews`)
      .expect(200);

    const body = JSON.parse(response.text) as {
      data: Array<{ content: string }>;
      meta: {
        totalCount: number;
        page: number;
        limit: number;
      };
    };

    expect(body.meta.totalCount).toBe(7);
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(6);
    expect(body.data).toHaveLength(6);
    expect(body.data[0]?.content).toBe('리뷰 7');
    expect(body.data[5]?.content).toBe('리뷰 2');
  });

  it('GET /lessons/:lessonId/reviews: 클래스가 없으면 404를 반환한다', async () => {
    await request(app.getHttpServer())
      .get('/lessons/99999999/reviews?page=1&limit=6')
      .expect(404);
  });
});
