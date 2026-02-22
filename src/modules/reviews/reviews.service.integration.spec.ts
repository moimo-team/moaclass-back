import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService (integration, real DB)', () => {
  let prisma: PrismaService;
  let service: ReviewsService;

  const uploadService = {
    uploadFile: jest.fn<Promise<string>, [string, Express.Multer.File]>(),
  };

  const couponsService = {
    issueReviewRewardCoupon: jest.fn<Promise<void>, [number]>(),
  };

  const pointsService = {
    earnPoints: jest.fn<Promise<void>, [number, number]>(),
  };

  let uniqueSeq = 0;
  const userIds: number[] = [];
  const regionIds: number[] = [];
  const lessonCategoryIds: number[] = [];
  const lessonIds: number[] = [];
  const scheduleIds: number[] = [];
  const enrollmentIds: number[] = [];
  const reviewIds: number[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run integration tests.');
    }

    prisma = new PrismaService();
    await prisma.$connect();

    couponsService.issueReviewRewardCoupon.mockResolvedValue();
    pointsService.earnPoints.mockResolvedValue();

    service = new ReviewsService(
      prisma,
      uploadService as never,
      couponsService as never,
      pointsService as never,
    );
  });

  afterEach(async () => {
    uploadService.uploadFile.mockReset();
    couponsService.issueReviewRewardCoupon.mockReset();
    pointsService.earnPoints.mockReset();

    couponsService.issueReviewRewardCoupon.mockResolvedValue();
    pointsService.earnPoints.mockResolvedValue();

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
    await prisma.$disconnect();
  });

  async function createRegionAndCategory() {
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

  async function createTeacherAndLesson(
    suffix: string,
    lessonStatus: 'ACTIVE' | 'DELETED' = 'ACTIVE',
  ) {
    const { regionId, lessonCategoryId, token } =
      await createRegionAndCategory();
    const key = `${token}_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 30);

    const teacher = await prisma.user.create({
      data: {
        email: `t_${key}@example.com`,
        nickname: `t_${key}`.slice(0, 30),
        provider: 'GOOGLE',
        providerId: `tp_${key}`.slice(0, 50),
      },
    });
    userIds.push(teacher.id);

    const lesson = await prisma.lesson.create({
      data: {
        userId: teacher.id,
        lessonCategoryId,
        title: `lesson_${key}`.slice(0, 50),
        description: 'integration test lesson',
        level: 'BEGINNER',
        durationSec: 3600,
        curriculum: '기초 커리큘럼',
        maxParticipants: 10,
        representativeImage: 'https://example.com/lesson.png',
        regionId,
        address: '서울특별시 마포구 월드컵로 45',
        latitude: 37.55,
        longitude: 126.91,
        detailAddress: '3층 301호',
        directionsText: '홍대입구역 2번 출구에서 도보 5분',
        status: lessonStatus,
      },
    });
    lessonIds.push(lesson.id);

    return { teacher, lesson };
  }

  async function createReviewer(suffix: string) {
    const key = `${uniqueSeq}_${suffix}`
      .replace(/[^a-zA-Z0-9_]/g, '')
      .slice(0, 30);

    const reviewer = await prisma.user.create({
      data: {
        email: `r_${key}@example.com`,
        nickname: `r_${key}`.slice(0, 30),
        provider: 'GOOGLE',
        providerId: `rp_${key}`.slice(0, 50),
      },
    });
    userIds.push(reviewer.id);

    return reviewer;
  }

  async function createEnrollment(
    userId: number,
    lessonId: number,
    status: 'ACCEPTED' | 'PENDING' = 'ACCEPTED',
  ) {
    uniqueSeq += 1;

    const schedule = await prisma.lessonSchedule.create({
      data: {
        lessonId,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000 + uniqueSeq * 60000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000 + uniqueSeq * 60000),
      },
    });
    scheduleIds.push(schedule.id);

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        scheduleId: schedule.id,
        status,
        originPrice: 30000,
        discountAmount: 0,
        finalPrice: 30000,
        quantity: 1,
      },
    });
    enrollmentIds.push(enrollment.id);

    return { schedule, enrollment };
  }

  it('이미지 없이 리뷰를 등록하면 representativeImage는 null이고 포인트 보상이 호출된다', async () => {
    const { lesson } = await createTeacherAndLesson('create_no_image');
    const reviewer = await createReviewer('create_no_image');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    await service.create(
      reviewer.id,
      {
        enrollmentId: enrollment.id,
        rating: 4.5,
        content: '설명이 이해하기 쉬웠어요.',
      },
      {},
    );

    const review = await prisma.review.findUnique({
      where: { enrollmentId: enrollment.id },
      include: { images: true },
    });

    expect(review).not.toBeNull();
    if (!review) return;
    reviewIds.push(review.id);

    expect(review.representativeImage).toBeNull();
    expect(review.images).toHaveLength(0);
    expect(pointsService.earnPoints).toHaveBeenCalledWith(reviewer.id, 100);
    expect(couponsService.issueReviewRewardCoupon).not.toHaveBeenCalled();
  });

  it('image1~image8 파일은 대표이미지와 sequence 규칙으로 저장되고 쿠폰 보상이 호출된다', async () => {
    const { lesson } = await createTeacherAndLesson('create_images');
    const reviewer = await createReviewer('create_images');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    uploadService.uploadFile
      .mockResolvedValueOnce('https://example.com/review-representative.png')
      .mockResolvedValueOnce('https://example.com/review-image-2.png')
      .mockResolvedValueOnce('https://example.com/review-image-8.png');

    const makeFile = (name: string) =>
      ({
        originalname: name,
        mimetype: 'image/png',
        buffer: Buffer.from('test'),
      }) as Express.Multer.File;

    await service.create(
      reviewer.id,
      {
        enrollmentId: enrollment.id,
        rating: 5,
        content: '실습 위주라서 정말 좋았습니다.',
      },
      {
        image1: [makeFile('image1.png')],
        image2: [makeFile('image2.png')],
        image8: [makeFile('image8.png')],
      },
    );

    const review = await prisma.review.findUnique({
      where: { enrollmentId: enrollment.id },
      include: {
        images: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    expect(review).not.toBeNull();
    if (!review) return;
    reviewIds.push(review.id);

    expect(review.representativeImage).toBe(
      'https://example.com/review-representative.png',
    );
    expect(review.images).toHaveLength(2);
    expect(review.images[0]?.sequence).toBe(1);
    expect(review.images[0]?.image).toBe(
      'https://example.com/review-image-2.png',
    );
    expect(review.images[1]?.sequence).toBe(7);
    expect(review.images[1]?.image).toBe(
      'https://example.com/review-image-8.png',
    );

    expect(couponsService.issueReviewRewardCoupon).toHaveBeenCalledWith(
      reviewer.id,
    );
    expect(pointsService.earnPoints).not.toHaveBeenCalled();
  });

  it('create: 내 결제(enrollment)가 아니면 ForbiddenException을 던진다', async () => {
    const { lesson } = await createTeacherAndLesson('create_forbidden_owner');
    const reviewer = await createReviewer('create_forbidden_owner_reviewer');
    const otherUser = await createReviewer('create_forbidden_owner_other');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    await expect(
      service.create(
        otherUser.id,
        { enrollmentId: enrollment.id, rating: 4, content: '권한 테스트' },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: 같은 enrollmentId에 중복 리뷰 작성 시 ConflictException을 던진다', async () => {
    const { lesson } = await createTeacherAndLesson('create_duplicate');
    const reviewer = await createReviewer('create_duplicate');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    await service.create(
      reviewer.id,
      { enrollmentId: enrollment.id, rating: 4.5, content: '첫 리뷰' },
      {},
    );

    const first = await prisma.review.findUnique({
      where: { enrollmentId: enrollment.id },
      select: { id: true },
    });
    if (first) {
      reviewIds.push(first.id);
    }

    await expect(
      service.create(
        reviewer.id,
        { enrollmentId: enrollment.id, rating: 5, content: '중복 리뷰' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findMyEnrollmentReviewDetail: 리뷰가 없으면 hasReview=false를 반환한다', async () => {
    const { lesson } = await createTeacherAndLesson('find_no_review');
    const reviewer = await createReviewer('find_no_review');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    const result = await service.findMyEnrollmentReviewDetail(
      reviewer.id,
      enrollment.id,
    );

    expect(result).toEqual({
      hasReview: false,
      review: null,
    });
  });

  it('findMyEnrollmentReviewDetail: 리뷰가 있으면 image1~image8 형태로 반환한다', async () => {
    const { lesson } = await createTeacherAndLesson('find_with_review');
    const reviewer = await createReviewer('find_with_review');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        rating: 4.5,
        content: '질문 답변이 빠르고 친절했어요.',
        representativeImage: 'https://example.com/review-representative.png',
      },
    });
    reviewIds.push(review.id);

    await prisma.reviewImage.createMany({
      data: [
        {
          reviewId: review.id,
          image: 'https://example.com/review-image-2.png',
          sequence: 1,
        },
        {
          reviewId: review.id,
          image: 'https://example.com/review-image-8.png',
          sequence: 7,
        },
      ],
    });

    const result = await service.findMyEnrollmentReviewDetail(
      reviewer.id,
      enrollment.id,
    );

    expect(result).toEqual({
      hasReview: true,
      review: {
        id: review.id,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        rating: 4.5,
        content: '질문 답변이 빠르고 친절했어요.',
        image1: 'https://example.com/review-representative.png',
        image2: 'https://example.com/review-image-2.png',
        image3: null,
        image4: null,
        image5: null,
        image6: null,
        image7: null,
        image8: 'https://example.com/review-image-8.png',
      },
    });
  });

  it('update: content만 전달하면 rating/이미지는 유지된다', async () => {
    const { lesson } = await createTeacherAndLesson('update_partial');
    const reviewer = await createReviewer('update_partial');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        rating: 3.5,
        content: '수정 전 내용',
        representativeImage: 'https://example.com/before-rep.png',
      },
    });
    reviewIds.push(review.id);

    await prisma.reviewImage.create({
      data: {
        reviewId: review.id,
        sequence: 1,
        image: 'https://example.com/before-image2.png',
      },
    });

    await service.update(
      reviewer.id,
      review.id,
      {
        content: '수정 후 내용',
      },
      {},
    );

    const updated = await prisma.review.findUnique({
      where: { id: review.id },
      include: {
        images: {
          orderBy: { sequence: 'asc' },
        },
      },
    });

    expect(updated).not.toBeNull();
    if (!updated) return;

    expect(updated.rating).toBe(3.5);
    expect(updated.content).toBe('수정 후 내용');
    expect(updated.representativeImage).toBe(
      'https://example.com/before-rep.png',
    );
    expect(updated.images[0]?.image).toBe(
      'https://example.com/before-image2.png',
    );
  });

  it('update: enrollment 상태가 ACCEPTED가 아니면 ForbiddenException을 던진다', async () => {
    const { lesson } = await createTeacherAndLesson('update_not_accepted');
    const reviewer = await createReviewer('update_not_accepted');
    const { enrollment } = await createEnrollment(reviewer.id, lesson.id);

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
        enrollmentId: enrollment.id,
        lessonId: lesson.id,
        rating: 4,
        content: '사전 리뷰',
        representativeImage: null,
      },
    });
    reviewIds.push(review.id);

    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: { status: 'PENDING' },
    });

    await expect(
      service.update(
        reviewer.id,
        review.id,
        {
          content: '수정 시도',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('getLatestReviewsByLesson: 최신순 페이지네이션이 동작한다', async () => {
    const { lesson } = await createTeacherAndLesson('list_by_lesson');
    const reviewer = await createReviewer('list_by_lesson');

    for (let i = 1; i <= 7; i += 1) {
      const { enrollment } = await createEnrollment(reviewer.id, lesson.id);
      const review = await prisma.review.create({
        data: {
          userId: reviewer.id,
          enrollmentId: enrollment.id,
          lessonId: lesson.id,
          rating: 4,
          content: `리뷰 ${i}`,
          representativeImage: null,
        },
      });
      reviewIds.push(review.id);
    }

    const page1 = await service.getLatestReviewsByLesson(lesson.id, {
      page: 1,
      limit: 6,
    });
    const page2 = await service.getLatestReviewsByLesson(lesson.id, {
      page: 2,
      limit: 6,
    });

    expect(page1.meta.totalCount).toBe(7);
    expect(page1.data).toHaveLength(6);
    expect(page2.data).toHaveLength(1);
    expect(page1.data[0]?.content).toBe('리뷰 7');
    expect(page2.data[0]?.content).toBe('리뷰 1');
  });

  it('getLatestReviewsByLesson: 삭제된 클래스면 NotFoundException을 던진다', async () => {
    const { lesson } = await createTeacherAndLesson('list_deleted', 'DELETED');

    await expect(
      service.getLatestReviewsByLesson(lesson.id, { page: 1, limit: 6 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
