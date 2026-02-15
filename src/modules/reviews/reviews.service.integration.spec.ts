import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
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
  const scheduleIds: number[] = [];
  const enrollmentIds: number[] = [];
  const pointTransactionIds: number[] = [];

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

    if (pointTransactionIds.length > 0) {
      await prisma.pointTransaction.deleteMany({
        where: { id: { in: pointTransactionIds } },
      });
      pointTransactionIds.length = 0;
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

  async function createAcceptedEnrollmentForLesson(
    lessonId: number,
    suffix: string,
  ) {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_reviewer_${suffix}@example.com`,
        nickname: `${runKey}_reviewer_${suffix}`,
        provider: 'GOOGLE',
        providerId: `${runKey}_reviewer_provider_${suffix}`,
      },
    });
    userIds.push(user.id);

    const schedule = await prisma.lessonSchedule.create({
      data: {
        lessonId,
        startAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        endAt: new Date(Date.now() + 25 * 60 * 60 * 1000),
      },
    });
    scheduleIds.push(schedule.id);

    const pointTransaction = await prisma.pointTransaction.create({
      data: {
        userId: user.id,
        lessonId,
        amount: -1000,
        type: 'USE',
        status: 'COMPLETED',
      },
    });
    pointTransactionIds.push(pointTransaction.id);

    const enrollment = await prisma.enrollment.create({
      data: {
        userId: user.id,
        scheduleId: schedule.id,
        status: 'ACCEPTED',
        pointTransactionId: pointTransaction.id,
      },
    });
    enrollmentIds.push(enrollment.id);

    return { user, schedule, enrollment };
  }

  it('이미지 없이 리뷰를 등록하면 대표이미지는 null로 저장된다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('1');
    const { user } = await createAcceptedEnrollmentForLesson(lesson.id, '1');

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
    const { lesson } = await createLessonOwnerAndLesson('2');
    const { user } = await createAcceptedEnrollmentForLesson(lesson.id, '2');

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
    const { lesson } = await createLessonOwnerAndLesson('3');
    const { user } = await createAcceptedEnrollmentForLesson(lesson.id, '3');

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

  it('create: 본인이 개설한 클래스에는 리뷰를 작성할 수 없다', async () => {
    const { user: teacher, lesson } = await createLessonOwnerAndLesson('3_1');

    await expect(
      service.create(
        teacher.id,
        { lessonId: lesson.id, rating: 4, content: '자기 리뷰 테스트' },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: 클래스 참여자가 아니면 리뷰를 작성할 수 없다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('3_2');
    const notEnrolledUser = await prisma.user.create({
      data: {
        email: `${runKey}_not_enrolled@example.com`,
        nickname: `${runKey}_not_enrolled`,
        provider: 'GOOGLE',
        providerId: `${runKey}_not_enrolled_provider`,
      },
    });
    userIds.push(notEnrolledUser.id);

    await expect(
      service.create(
        notEnrolledUser.id,
        { lessonId: lesson.id, rating: 4, content: '미참여 리뷰 테스트' },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('create: 같은 사용자는 같은 클래스에 리뷰를 1개만 작성할 수 있다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('3_3');
    const { user } = await createAcceptedEnrollmentForLesson(lesson.id, '3_3');

    await service.create(
      user.id,
      { lessonId: lesson.id, rating: 4.5, content: '첫 리뷰' },
      {},
    );

    const created = await prisma.review.findFirst({
      where: { userId: user.id, lessonId: lesson.id },
      select: { id: true },
    });
    if (created) {
      reviewIds.push(created.id);
    }

    await expect(
      service.create(
        user.id,
        { lessonId: lesson.id, rating: 5, content: '중복 리뷰' },
        {},
      ),
    ).rejects.toBeInstanceOf(ConflictException);
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
      lessonTitle: lesson.title,
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

  it('getLatestReviewsByLesson: 최신순으로 페이지네이션 조회된다', async () => {
    const { user, lesson } = await createLessonOwnerAndLesson('7');

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

    const page1 = await service.getLatestReviewsByLesson(lesson.id, {
      page: 1,
      limit: 6,
    });

    expect(page1.meta.totalCount).toBe(7);
    expect(page1.meta.page).toBe(1);
    expect(page1.meta.limit).toBe(6);
    expect(page1.data).toHaveLength(6);
    expect(page1.data[0]?.content).toBe('리뷰 7');
    expect(page1.data[5]?.content).toBe('리뷰 2');

    const page2 = await service.getLatestReviewsByLesson(lesson.id, {
      page: 2,
      limit: 6,
    });
    expect(page2.data).toHaveLength(1);
    expect(page2.data[0]?.content).toBe('리뷰 1');
  });

  it('getLatestReviewsByLesson: 클래스가 없거나 삭제 상태면 NotFoundException을 던진다', async () => {
    await expect(
      service.getLatestReviewsByLesson(99999999, { page: 1, limit: 6 }),
    ).rejects.toBeInstanceOf(NotFoundException);

    const { lesson } = await createLessonOwnerAndLesson('8');
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { status: 'DELETED' },
    });

    await expect(
      service.getLatestReviewsByLesson(lesson.id, { page: 1, limit: 6 }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('getLatestReviewsByTeacher: 특정 선생님이 받은 최신 리뷰를 페이지네이션 조회한다', async () => {
    const { user: teacherA, lesson: lessonA } =
      await createLessonOwnerAndLesson('9a');
    const { user: teacherB, lesson: lessonB } =
      await createLessonOwnerAndLesson('9b');

    for (let i = 1; i <= 7; i += 1) {
      const review = await prisma.review.create({
        data: {
          userId: teacherA.id,
          lessonId: lessonA.id,
          rating: 4.0 + i * 0.1,
          content: `A 리뷰 ${i}`,
          representativeImage:
            i % 2 === 0 ? `https://example.com/ta_${i}.png` : null,
        },
      });
      reviewIds.push(review.id);
    }

    const otherTeacherReview = await prisma.review.create({
      data: {
        userId: teacherB.id,
        lessonId: lessonB.id,
        rating: 5,
        content: 'B 리뷰 1',
        representativeImage: 'https://example.com/tb_1.png',
      },
    });
    reviewIds.push(otherTeacherReview.id);

    const page1 = await service.getLatestReviewsByTeacher(teacherA.id, {
      page: 1,
      limit: 6,
    });

    expect(page1.meta.totalCount).toBe(7);
    expect(page1.data).toHaveLength(6);
    expect(page1.data[0]?.content).toBe('A 리뷰 7');
    expect(page1.data[0]?.lessonTitle).toBe(lessonA.title);
    expect(page1.data[0]).toHaveProperty('representativeImage');
    expect(page1.data[0]).not.toHaveProperty('image2');
  });

  it('getLatestReviews: 전체 최신 리뷰를 페이지네이션 조회한다', async () => {
    const { user: teacherA, lesson: lessonA } =
      await createLessonOwnerAndLesson('10a');
    const { user: teacherB, lesson: lessonB } =
      await createLessonOwnerAndLesson('10b');

    for (let i = 1; i <= 4; i += 1) {
      const reviewA = await prisma.review.create({
        data: {
          userId: teacherA.id,
          lessonId: lessonA.id,
          rating: 4.0 + i * 0.1,
          content: `전체 A 리뷰 ${i}`,
          representativeImage: `https://example.com/all_a_${i}.png`,
        },
      });
      reviewIds.push(reviewA.id);
    }

    for (let i = 1; i <= 3; i += 1) {
      const reviewB = await prisma.review.create({
        data: {
          userId: teacherB.id,
          lessonId: lessonB.id,
          rating: 3.0 + i * 0.1,
          content: `전체 B 리뷰 ${i}`,
          representativeImage: `https://example.com/all_b_${i}.png`,
        },
      });
      reviewIds.push(reviewB.id);
    }

    const page1 = await service.getLatestReviews({
      page: 1,
      limit: 6,
    });

    expect(page1.meta.totalCount).toBe(7);
    expect(page1.data).toHaveLength(6);
    expect(page1.data[0]).toHaveProperty('lessonTitle');
    expect(page1.data[0]).toHaveProperty('representativeImage');
    expect(page1.data[0]).not.toHaveProperty('image2');
  });

  it('update: 전달된 rating/content만 수정하고 미전달 값은 유지한다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('11');
    const { user: reviewer } = await createAcceptedEnrollmentForLesson(
      lesson.id,
      '11',
    );

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
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

  it('update: 전달된 image 키만 교체하고 미전달 이미지는 유지한다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('12');
    const { user: reviewer } = await createAcceptedEnrollmentForLesson(
      lesson.id,
      '12',
    );

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
        lessonId: lesson.id,
        rating: 4,
        content: '이미지 수정 전',
        representativeImage: 'https://example.com/rep-before.png',
      },
    });
    reviewIds.push(review.id);

    await prisma.reviewImage.createMany({
      data: [
        {
          reviewId: review.id,
          sequence: 1,
          image: 'https://example.com/image2-before.png',
        },
        {
          reviewId: review.id,
          sequence: 3,
          image: 'https://example.com/image4-before.png',
        },
      ],
    });

    uploadService.uploadFile
      .mockResolvedValueOnce('https://example.com/rep-after.png')
      .mockResolvedValueOnce('https://example.com/image4-after.png');

    const makeFile = (name: string) =>
      ({
        originalname: name,
        mimetype: 'image/png',
        buffer: Buffer.from('test'),
      }) as Express.Multer.File;

    await service.update(
      reviewer.id,
      review.id,
      {},
      {
        image1: [makeFile('image1.png')],
        image4: [makeFile('image4.png')],
      },
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
    expect(updated.representativeImage).toBe(
      'https://example.com/rep-after.png',
    );
    expect(updated.images.find((image) => image.sequence === 1)?.image).toBe(
      'https://example.com/image2-before.png',
    );
    expect(updated.images.find((image) => image.sequence === 3)?.image).toBe(
      'https://example.com/image4-after.png',
    );
  });

  it('update: 본인 리뷰가 아니면 ForbiddenException을 던진다', async () => {
    const { user: owner, lesson } = await createLessonOwnerAndLesson('13');
    const { user: otherUser } = await createLessonOwnerAndLesson('14');

    const review = await prisma.review.create({
      data: {
        userId: owner.id,
        lessonId: lesson.id,
        rating: 4.5,
        content: '권한 테스트',
        representativeImage: null,
      },
    });
    reviewIds.push(review.id);

    await expect(
      service.update(
        otherUser.id,
        review.id,
        {
          rating: 5,
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('update: 리뷰 작성자가 클래스 참여자가 아니면 ForbiddenException을 던진다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('15');
    const reviewer = await prisma.user.create({
      data: {
        email: `${runKey}_reviewer_not_enrolled_15@example.com`,
        nickname: `${runKey}_reviewer_not_enrolled_15`,
        provider: 'GOOGLE',
        providerId: `${runKey}_reviewer_not_enrolled_provider_15`,
      },
    });
    userIds.push(reviewer.id);

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
        lessonId: lesson.id,
        rating: 4.5,
        content: '사전 데이터',
        representativeImage: null,
      },
    });
    reviewIds.push(review.id);

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

  it('update: 클래스가 삭제 상태면 NotFoundException을 던진다', async () => {
    const { lesson } = await createLessonOwnerAndLesson('16');
    const { user: reviewer } = await createAcceptedEnrollmentForLesson(
      lesson.id,
      '16',
    );

    const review = await prisma.review.create({
      data: {
        userId: reviewer.id,
        lessonId: lesson.id,
        rating: 4.5,
        content: '수정 대상',
        representativeImage: null,
      },
    });
    reviewIds.push(review.id);

    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { status: 'DELETED' },
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
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: 본인이 개설한 클래스의 리뷰면 ForbiddenException을 던진다', async () => {
    const { user: teacher, lesson } = await createLessonOwnerAndLesson('17');

    const review = await prisma.review.create({
      data: {
        userId: teacher.id,
        lessonId: lesson.id,
        rating: 5,
        content: '비정상 사전 데이터',
        representativeImage: null,
      },
    });
    reviewIds.push(review.id);

    await expect(
      service.update(
        teacher.id,
        review.id,
        {
          content: '수정 시도',
        },
        {},
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
