import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MomentoesService } from './momentoes.service';

describe('MomentoesService (integration, real DB)', () => {
  let prisma: PrismaService;
  let service: MomentoesService;
  const uploadService = {
    uploadFile: jest.fn<Promise<string>, [string, Express.Multer.File]>(),
  };

  let runKey: string;
  const userIds: number[] = [];
  const profileUserIds: number[] = [];
  const lessonIds: number[] = [];
  const lessonCategoryIds: number[] = [];
  const regionIds: number[] = [];

  beforeAll(async () => {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is required to run integration tests.');
    }

    runKey = `teacher_${Date.now()}_${Math.floor(Math.random() * 100000)}`;

    prisma = new PrismaService();
    await prisma.$connect();

    service = new MomentoesService(prisma, uploadService as never);
  });

  afterEach(async () => {
    uploadService.uploadFile.mockReset();

    if (lessonIds.length > 0) {
      await prisma.lesson.deleteMany({
        where: { id: { in: lessonIds } },
      });
      lessonIds.length = 0;
    }

    if (profileUserIds.length > 0) {
      await prisma.teacherProfile.deleteMany({
        where: { userId: { in: profileUserIds } },
      });
      profileUserIds.length = 0;
    }

    if (userIds.length > 0) {
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      userIds.length = 0;
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
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('create: 이미지가 있으면 프로필을 생성한다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u_create_1@example.com`,
        nickname: `${runKey}_u_create_1`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_create_1`,
      },
    });
    userIds.push(user.id);

    uploadService.uploadFile.mockResolvedValueOnce(
      'https://example.com/teacher-create-1.png',
    );

    const file = {
      originalname: 'teacher.png',
      mimetype: 'image/png',
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    const created = await service.create(
      {
        nickname: `${runKey}_teacher_create_1`,
        introduction: 'create intro 1',
      },
      user.id,
      file,
    );
    profileUserIds.push(user.id);

    expect(created.userId).toBe(user.id);
    expect(created.nickname).toBe(`${runKey}_teacher_create_1`);
    expect(created.introduction).toBe('create intro 1');
    expect(created.image).toBe('https://example.com/teacher-create-1.png');
  });

  it('create: 이미지가 없으면 BadRequestException을 던진다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u_create_2@example.com`,
        nickname: `${runKey}_u_create_2`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_create_2`,
      },
    });
    userIds.push(user.id);

    await expect(
      service.create(
        {
          nickname: `${runKey}_teacher_create_2`,
          introduction: 'create intro 2',
        },
        user.id,
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('create: 같은 userId로 중복 생성하면 ConflictException을 던진다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u_create_3@example.com`,
        nickname: `${runKey}_u_create_3`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_create_3`,
      },
    });
    userIds.push(user.id);

    uploadService.uploadFile.mockResolvedValue(
      'https://example.com/create.png',
    );

    const file = {
      originalname: 'teacher.png',
      mimetype: 'image/png',
      buffer: Buffer.from('test'),
    } as Express.Multer.File;

    await service.create(
      {
        nickname: `${runKey}_teacher_create_3_1`,
        introduction: 'create intro 3-1',
      },
      user.id,
      file,
    );
    profileUserIds.push(user.id);

    await expect(
      service.create(
        {
          nickname: `${runKey}_teacher_create_3_2`,
          introduction: 'create intro 3-2',
        },
        user.id,
        file,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('update: 프로필이 존재하면 닉네임/소개글을 수정한다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u_update_1@example.com`,
        nickname: `${runKey}_u_update_1`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_update_1`,
      },
    });
    userIds.push(user.id);

    await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        nickname: `${runKey}_teacher_update_1`,
        image: 'https://example.com/teacher-update-1.png',
        introduction: 'before intro',
      },
    });
    profileUserIds.push(user.id);

    await service.update(
      user.id,
      {
        nickname: `${runKey}_teacher_update_1_new`,
        introduction: 'after intro',
      },
      undefined,
    );

    const updated = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });

    expect(updated?.nickname).toBe(`${runKey}_teacher_update_1_new`);
    expect(updated?.introduction).toBe('after intro');
  });

  it('update: 프로필이 없으면 NotFoundException을 던진다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u_update_2@example.com`,
        nickname: `${runKey}_u_update_2`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_update_2`,
      },
    });
    userIds.push(user.id);

    await expect(
      service.update(
        user.id,
        {
          nickname: `${runKey}_teacher_update_2`,
          introduction: 'update intro 2',
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('update: 이미 사용 중인 닉네임으로 수정하면 ConflictException을 던진다', async () => {
    const userA = await prisma.user.create({
      data: {
        email: `${runKey}_u_update_3a@example.com`,
        nickname: `${runKey}_u_update_3a`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_update_3a`,
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `${runKey}_u_update_3b@example.com`,
        nickname: `${runKey}_u_update_3b`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_update_3b`,
      },
    });
    userIds.push(userA.id, userB.id);

    await prisma.teacherProfile.create({
      data: {
        userId: userA.id,
        nickname: `${runKey}_teacher_update_3a`,
        image: 'https://example.com/teacher-update-3a.png',
        introduction: 'intro a',
      },
    });
    await prisma.teacherProfile.create({
      data: {
        userId: userB.id,
        nickname: `${runKey}_teacher_update_3b`,
        image: 'https://example.com/teacher-update-3b.png',
        introduction: 'intro b',
      },
    });
    profileUserIds.push(userA.id, userB.id);

    await expect(
      service.update(
        userB.id,
        {
          nickname: `${runKey}_teacher_update_3a`,
          introduction: 'intro b changed',
        },
        undefined,
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('findByUserId: 프로필이 존재하면 id, 닉네임, 소개글을 반환한다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u1@example.com`,
        nickname: `${runKey}_u1`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_1`,
      },
    });
    userIds.push(user.id);

    await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        nickname: `${runKey}_teacher_1`,
        image: 'https://example.com/teacher-1.png',
        introduction: 'teacher intro 1',
      },
    });
    profileUserIds.push(user.id);

    const result = await service.findByUserId(user.id);

    expect(typeof result.id).toBe('number');
    expect(result.nickname).toBe(`${runKey}_teacher_1`);
    expect(result.introduction).toBe('teacher intro 1');
  });

  it('findByUserId: 선생님 프로필이 없으면 NotFoundException을 던진다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u2@example.com`,
        nickname: `${runKey}_u2`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_2`,
      },
    });
    userIds.push(user.id);

    await expect(service.findByUserId(user.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.findByUserId(user.id)).rejects.toThrow(
      '선생님 프로필을 찾을 수 없습니다.',
    );
  });

  it('remove: userId 기준으로 선생님 프로필을 삭제한다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u3@example.com`,
        nickname: `${runKey}_u3`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_3`,
      },
    });
    userIds.push(user.id);

    await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        nickname: `${runKey}_teacher_3`,
        image: 'https://example.com/teacher-3.png',
        introduction: 'teacher intro 3',
      },
    });
    profileUserIds.push(user.id);

    await service.remove(user.id);

    const deletedProfile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });
    expect(deletedProfile).toBeNull();
  });

  it('remove: 프로필이 없으면 NotFoundException을 던진다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u4@example.com`,
        nickname: `${runKey}_u4`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_4`,
      },
    });
    userIds.push(user.id);

    await expect(service.remove(user.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    await expect(service.remove(user.id)).rejects.toThrow(
      '삭제할 모멘토 프로필이 존재하지 않습니다.',
    );
  });
  it('remove: 클래스가 있으면 ConflictException을 던지고 프로필을 삭제하지 않는다', async () => {
    const user = await prisma.user.create({
      data: {
        email: `${runKey}_u5@example.com`,
        nickname: `${runKey}_u5`,
        provider: 'GOOGLE',
        providerId: `${runKey}_provider_5`,
      },
    });
    userIds.push(user.id);

    await prisma.teacherProfile.create({
      data: {
        userId: user.id,
        nickname: `${runKey}_teacher_5`,
        image: 'https://example.com/teacher-5.png',
        introduction: 'teacher intro 5',
      },
    });
    profileUserIds.push(user.id);

    const category = await prisma.lessonCategory.create({
      data: {
        name: `${runKey}_lesson_category_5`,
      },
    });
    lessonCategoryIds.push(category.id);

    const region = await prisma.region.create({
      data: {
        name: `${runKey}_region_5`,
      },
    });
    regionIds.push(region.id);

    const lesson = await prisma.lesson.create({
      data: {
        userId: user.id,
        lessonCategoryId: category.id,
        title: `${runKey}_lesson_5`,
        description: 'lesson desc 5',
        level: 'BEGINNER',
        durationSec: 3600,
        curriculum: 'curriculum 5',
        maxParticipants: 10,
        representativeImage: 'https://example.com/lesson-5.png',
        regionId: region.id,
        address: 'Seoul address',
        latitude: 37.5665,
        longitude: 126.978,
        detailAddress: 'detail',
        directionsText: 'directions',
        status: 'ACTIVE',
      },
    });
    lessonIds.push(lesson.id);

    await expect(service.remove(user.id)).rejects.toBeInstanceOf(
      ConflictException,
    );

    const profile = await prisma.teacherProfile.findUnique({
      where: { userId: user.id },
    });
    expect(profile).not.toBeNull();
  });
});
