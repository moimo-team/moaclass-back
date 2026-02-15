import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ReviewsService } from './reviews.service';

describe('ReviewsService create (integration, real DB)', () => {
  let prisma: PrismaService;
  let service: ReviewsService;

  const uploadService = {
    uploadFile: jest.fn<Promise<string>, [string, Express.Multer.File]>(),
  };

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

    runKey = `review_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    prisma = new PrismaService();
    await prisma.$connect();
    service = new ReviewsService(prisma, uploadService as never);
  });

  afterEach(async () => {
    uploadService.uploadFile.mockReset();

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
    await prisma.$disconnect();
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

  it('이미지 없이 리뷰를 등록하면 대표이미지는 null로 저장된다', async () => {
    const { user, lesson } = await createLessonOwnerAndLesson('1');

    await service.create(
      user.id,
      { lessonId: lesson.id, rating: 4.5, content: '좋은 수업이었어요.' },
      {},
    );

    const review = await prisma.review.findFirst({
      where: { userId: user.id, lessonId: lesson.id },
      include: { images: true },
      orderBy: { createdAt: 'desc' },
    });

    expect(review).not.toBeNull();
    if (!review) return;
    reviewIds.push(review.id);

    expect(review.representativeImage).toBeNull();
    expect(review.images).toHaveLength(0);
  });

  it('image1~image8 규칙으로 URL과 sequence가 저장된다', async () => {
    const { user, lesson } = await createLessonOwnerAndLesson('2');

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
      user.id,
      { lessonId: lesson.id, rating: 5, content: '최고였습니다.' },
      {
        image1: [makeFile('image1.png')],
        image2: [makeFile('image2.png')],
        image8: [makeFile('image8.png')],
      },
    );

    const review = await prisma.review.findFirst({
      where: { userId: user.id, lessonId: lesson.id },
      include: {
        images: {
          orderBy: { sequence: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
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
  });

  it('삭제된 클래스 상태면 NotFoundException을 던진다', async () => {
    const { user, lesson } = await createLessonOwnerAndLesson('3');

    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { status: 'DELETED' },
    });

    await expect(
      service.create(
        user.id,
        { lessonId: lesson.id, rating: 3.5, content: '테스트' },
        {},
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('findMyLessonReviewDetail: image1~image8 형태로 조회된다', async () => {
    const { user, lesson } = await createLessonOwnerAndLesson('4');

    const review = await prisma.review.create({
      data: {
        userId: user.id,
        lessonId: lesson.id,
        rating: 4.5,
        content: '조회 테스트 리뷰',
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

    const result = await service.findMyLessonReviewDetail(
      user.id,
      lesson.id,
      review.id,
    );

    expect(result).toEqual({
      id: review.id,
      lessonId: lesson.id,
      rating: 4.5,
      content: '조회 테스트 리뷰',
      image1: 'https://example.com/review-representative.png',
      image2: 'https://example.com/review-image-2.png',
      image3: null,
      image4: null,
      image5: null,
      image6: null,
      image7: null,
      image8: 'https://example.com/review-image-8.png',
    });
    expect(result).not.toHaveProperty('createdAt');
    expect(result).not.toHaveProperty('updatedAt');
  });

  it('findMyLessonReviewDetail: 본인/클래스/리뷰가 일치하지 않으면 NotFoundException을 던진다', async () => {
    const { user: owner, lesson } = await createLessonOwnerAndLesson('5');
    const { user: otherUser } = await createLessonOwnerAndLesson('6');

    const review = await prisma.review.create({
      data: {
        userId: owner.id,
        lessonId: lesson.id,
        rating: 5,
        content: '권한 테스트 리뷰',
        representativeImage: null,
      },
    });
    reviewIds.push(review.id);

    await expect(
      service.findMyLessonReviewDetail(otherUser.id, lesson.id, review.id),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
