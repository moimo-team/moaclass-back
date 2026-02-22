import { PrismaService } from '../../prisma/prisma.service';
import { LessonsService } from './lessons.service';

describe('LessonsService (integration, real DB)', () => {
  let prisma: PrismaService;
  let service: LessonsService;

  const uploadService = {
    uploadFile: jest.fn<Promise<string>, [string, Express.Multer.File]>(),
  };

  let uniqueSeq = 0;
  const userIds: number[] = [];
  const regionIds: number[] = [];
  const lessonCategoryIds: number[] = [];
  const lessonIds: number[] = [];
  const scheduleIds: number[] = [];
  const wishlistRows: Array<{ userId: number; lessonId: number }> = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run integration tests.');
    }

    prisma = new PrismaService();
    await prisma.$connect();

    service = new LessonsService(prisma, uploadService as never);
  });

  afterEach(async () => {
    if (wishlistRows.length > 0) {
      await prisma.wishlist.deleteMany({
        where: {
          OR: wishlistRows.map((row) => ({
            userId: row.userId,
            lessonId: row.lessonId,
          })),
        },
      });
      wishlistRows.length = 0;
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
    await prisma.$disconnect();
  });

  async function createRegionAndCategory() {
    uniqueSeq += 1;
    const token = uniqueSeq.toString().padStart(6, '0');

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
      `r_${token}`,
    );

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
      `c_${token}`,
    );

    const regionId = regionRows[0]?.id;
    const lessonCategoryId = categoryRows[0]?.id;

    if (!regionId || !lessonCategoryId) {
      throw new Error(
        'Failed to create region/category for integration tests.',
      );
    }

    regionIds.push(regionId);
    lessonCategoryIds.push(lessonCategoryId);

    return { regionId, lessonCategoryId, token };
  }

  async function createUser(prefix: string) {
    uniqueSeq += 1;
    const token = `${prefix}_${uniqueSeq}`.replace(/[^a-zA-Z0-9_]/g, '');

    const user = await prisma.user.create({
      data: {
        email: `${token}@example.com`,
        nickname: token.slice(0, 30),
        provider: 'GOOGLE',
        providerId: `${token}_provider`.slice(0, 50),
      },
    });

    userIds.push(user.id);
    return user;
  }

  async function createLesson(params: {
    teacherUserId: number;
    lessonCategoryId: number;
    regionId: number;
    suffix: string;
    reviewAiSummary?: string | null;
  }) {
    uniqueSeq += 1;

    const lesson = await prisma.lesson.create({
      data: {
        userId: params.teacherUserId,
        lessonCategoryId: params.lessonCategoryId,
        title: `lesson_${params.suffix}_${uniqueSeq}`.slice(0, 50),
        description: '테스트용 레슨 설명',
        level: 'BEGINNER',
        durationSec: 5400,
        curriculum: '커리큘럼',
        maxParticipants: 10,
        representativeImage: 'https://example.com/lesson.png',
        regionId: params.regionId,
        address: '서울특별시 마포구 월드컵로 45',
        latitude: 37.55,
        longitude: 126.91,
        detailAddress: '3층 301호',
        directionsText: '홍대입구역 2번 출구 도보 5분',
        ...(params.reviewAiSummary !== undefined && {
          reviewAiSummary: params.reviewAiSummary,
        }),
      },
    });

    lessonIds.push(lesson.id);
    return lesson;
  }

  async function createSchedule(lessonId: number) {
    uniqueSeq += 1;

    const schedule = await prisma.lessonSchedule.create({
      data: {
        lessonId,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + uniqueSeq * 60000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000 + uniqueSeq * 60000),
      },
    });

    scheduleIds.push(schedule.id);
    return schedule;
  }

  async function createWishlist(userId: number, lessonId: number) {
    await prisma.wishlist.create({
      data: {
        userId,
        lessonId,
      },
    });
    wishlistRows.push({ userId, lessonId });
  }

  it('getLessons: 비로그인(userId 없음)이면 isLiked는 false다', async () => {
    const { regionId, lessonCategoryId } = await createRegionAndCategory();
    const teacher = await createUser('teacher_no_user');
    const viewer = await createUser('viewer_no_user');

    const lesson = await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'no_user',
    });

    await createWishlist(viewer.id, lesson.id);

    const result = await service.getLessons(
      { page: 1, limit: 10, userId: teacher.id },
      undefined,
    );

    const target = result.data.find((item) => item.id === lesson.id);
    expect(target).toBeDefined();
    expect(target?.isLiked).toBe(false);
  });

  it('getLessons: 로그인 userId가 있으면 위시리스트 기준으로 isLiked를 계산한다', async () => {
    const { regionId, lessonCategoryId } = await createRegionAndCategory();
    const teacher = await createUser('teacher_with_user');
    const viewer = await createUser('viewer_with_user');

    const lesson = await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'with_user',
    });

    await createWishlist(viewer.id, lesson.id);

    const result = await service.getLessons(
      { page: 1, limit: 10, userId: teacher.id },
      viewer.id,
    );

    const target = result.data.find((item) => item.id === lesson.id);
    expect(target).toBeDefined();
    expect(target?.isLiked).toBe(true);
  });

  it('getLessons: isLike=true + 로그인 userId이면 찜한 레슨만 조회한다', async () => {
    const { regionId, lessonCategoryId } = await createRegionAndCategory();
    const teacher = await createUser('teacher_filter_like');
    const viewer = await createUser('viewer_filter_like');

    const likedLesson = await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'liked',
    });

    const notLikedLesson = await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'not_liked',
    });

    await createWishlist(viewer.id, likedLesson.id);

    const result = await service.getLessons(
      {
        page: 1,
        limit: 10,
        userId: teacher.id,
        isLike: true,
      },
      viewer.id,
    );

    const lessonIds = result.data.map((item) => item.id);

    expect(lessonIds).toContain(likedLesson.id);
    expect(lessonIds).not.toContain(notLikedLesson.id);
    expect(result.data.every((item) => item.isLiked === true)).toBe(true);
  });

  it('getLessons: isLike=true + 비로그인이면 빈 결과를 반환한다', async () => {
    const { regionId, lessonCategoryId } = await createRegionAndCategory();
    const teacher = await createUser('teacher_filter_no_user');

    await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'filter_no_user',
    });

    const result = await service.getLessons(
      {
        page: 1,
        limit: 10,
        userId: teacher.id,
        isLike: true,
      },
      undefined,
    );

    expect(result.data).toEqual([]);
    expect(result.meta.totalCount).toBe(0);
  });

  it('getLessonDetail: 로그인 userId면 isLiked=true와 reviewAiSummary를 반환한다', async () => {
    const { regionId, lessonCategoryId } = await createRegionAndCategory();
    const teacher = await createUser('teacher_detail_user');
    const viewer = await createUser('viewer_detail_user');

    const lesson = await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'detail_user',
      reviewAiSummary:
        '설명이 명확하고 실습 중심으로 진행되어 초보자도 부담 없이 따라갈 수 있다는 평가가 많습니다.',
    });

    await createSchedule(lesson.id);
    await createWishlist(viewer.id, lesson.id);

    const result = await service.getLessonDetail(lesson.id, viewer.id);

    expect(result.id).toBe(lesson.id);
    expect(result.isLiked).toBe(true);
    expect(result.reviewAiSummary).toBe(lesson.reviewAiSummary);
    expect(result.schedules.length).toBeGreaterThan(0);
  });

  it('getLessonDetail: 비로그인이면 isLiked=false이고 reviewAiSummary는 그대로 반환한다', async () => {
    const { regionId, lessonCategoryId } = await createRegionAndCategory();
    const teacher = await createUser('teacher_detail_no_user');

    const lesson = await createLesson({
      teacherUserId: teacher.id,
      lessonCategoryId,
      regionId,
      suffix: 'detail_no_user',
      reviewAiSummary:
        '질문에 빠르게 답변해주고 진행 속도가 안정적이라 만족도가 높았다는 피드백이 반복되었습니다.',
    });

    await createSchedule(lesson.id);

    const result = await service.getLessonDetail(lesson.id);

    expect(result.id).toBe(lesson.id);
    expect(result.isLiked).toBe(false);
    expect(result.reviewAiSummary).toBe(lesson.reviewAiSummary);
    expect(result.schedules.length).toBeGreaterThan(0);
  });
});
