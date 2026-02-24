import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ParticipationStatus } from '@prisma/client';
import { LessonSchedulesService } from './lesson-schedules.service';
import { PrismaService } from '../../prisma/prisma.service';

type LessonRecord = {
  userId: number;
  durationSec: number;
  maxParticipants: number;
};

type PrismaMock = {
  lesson: {
    findUnique: jest.Mock<Promise<LessonRecord | null>, [unknown]>;
  };
  lessonSchedule: {
    findFirst: jest.Mock<Promise<{ id: number } | null>, [unknown]>;
    findMany: jest.Mock<Promise<Array<Record<string, unknown>>>, [unknown]>;
  };
  enrollment: {
    findMany: jest.Mock<Promise<Array<Record<string, unknown>>>, [unknown]>;
  };
};

describe('LessonSchedulesService', () => {
  let service: LessonSchedulesService;
  let prismaMock: PrismaMock;

  beforeEach(async () => {
    prismaMock = {
      lesson: {
        findUnique: jest.fn<Promise<LessonRecord | null>, [unknown]>(),
      },
      lessonSchedule: {
        findFirst: jest.fn<Promise<{ id: number } | null>, [unknown]>(),
        findMany: jest.fn<Promise<Array<Record<string, unknown>>>, [unknown]>(),
      },
      enrollment: {
        findMany: jest.fn<Promise<Array<Record<string, unknown>>>, [unknown]>(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LessonSchedulesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<LessonSchedulesService>(LessonSchedulesService);
  });

  describe('getParticipants', () => {
    it('returns accepted participants for schedule in the given lesson', async () => {
      prismaMock.lesson.findUnique.mockResolvedValue({
        userId: 10,
        durationSec: 5400,
        maxParticipants: 8,
      });
      prismaMock.lessonSchedule.findFirst.mockResolvedValue({ id: 5 });
      prismaMock.enrollment.findMany.mockResolvedValue([
        {
          quantity: 2,
          user: {
            id: 21,
            nickname: 'studentA',
            image: 'https://cdn.example.com/users/21.jpg',
          },
        },
      ]);

      const result = await service.getParticipants(10, 3, 5);

      expect(prismaMock.lessonSchedule.findFirst).toHaveBeenCalledWith({
        where: { id: 5, lessonId: 3 },
        select: { id: true },
      });
      expect(prismaMock.enrollment.findMany).toHaveBeenCalledWith({
        where: { scheduleId: 5, status: ParticipationStatus.ACCEPTED },
        include: {
          user: {
            select: {
              id: true,
              nickname: true,
              image: true,
            },
          },
        },
      });
      expect(result).toEqual([
        {
          userId: 21,
          nickname: 'studentA',
          profileImage: 'https://cdn.example.com/users/21.jpg',
          quantity: 2,
        },
      ]);
    });

    it('throws ForbiddenException when requester is not lesson owner', async () => {
      prismaMock.lesson.findUnique.mockResolvedValue({
        userId: 99,
        durationSec: 5400,
        maxParticipants: 8,
      });

      await expect(service.getParticipants(10, 3, 5)).rejects.toThrow(
        ForbiddenException,
      );
      expect(prismaMock.lessonSchedule.findFirst).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when schedule does not belong to lesson', async () => {
      prismaMock.lesson.findUnique.mockResolvedValue({
        userId: 10,
        durationSec: 5400,
        maxParticipants: 8,
      });
      prismaMock.lessonSchedule.findFirst.mockResolvedValue(null);

      await expect(service.getParticipants(10, 3, 999)).rejects.toThrow(
        NotFoundException,
      );
      expect(prismaMock.enrollment.findMany).not.toHaveBeenCalled();
    });
  });

  describe('getSchedules', () => {
    it('maps startAt and endAt to Seoul time strings', async () => {
      prismaMock.lesson.findUnique.mockResolvedValue({
        userId: 10,
        durationSec: 5400,
        maxParticipants: 8,
      });
      prismaMock.lessonSchedule.findMany.mockResolvedValue([
        {
          id: 1,
          lessonId: 3,
          startAt: new Date('2026-02-20T01:00:00.000Z'),
          endAt: new Date('2026-02-20T03:00:00.000Z'),
          currentParticipants: 0,
          status: 'RECRUITING',
          createdAt: new Date('2026-02-01T00:00:00.000Z'),
        },
      ]);

      const result = await service.getSchedules(10, 3);

      expect(result[0].startAt).toBe('2026-02-20T10:00:00');
      expect(result[0].endAt).toBe('2026-02-20T12:00:00');
      expect(result[0].maxParticipants).toBe(8);
    });
  });
});
