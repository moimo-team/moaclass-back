import { Test, TestingModule } from '@nestjs/testing';
import { Request } from 'express';
import { JwtPayload } from 'src/auth/jwt-payload.interface';
import { LessonSchedulesController } from './lesson-schedules.controller';
import { LessonSchedulesService } from './lesson-schedules.service';

jest.mock(
  'src/auth/jwt-auth.guard',
  () => ({
    JwtAuthGuard: class JwtAuthGuardMock {},
  }),
  { virtual: true },
);

describe('LessonSchedulesController', () => {
  let controller: LessonSchedulesController;
  let schedulesService: {
    getParticipants: jest.Mock<
      Promise<
        Array<{
          userId: number;
          nickname: string;
          profileImage: string | null;
        }>
      >,
      [number, number, number]
    >;
  };

  beforeEach(async () => {
    schedulesService = {
      getParticipants: jest.fn<
        Promise<
          Array<{
            userId: number;
            nickname: string;
            profileImage: string | null;
          }>
        >,
        [number, number, number]
      >(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [LessonSchedulesController],
      providers: [
        {
          provide: LessonSchedulesService,
          useValue: schedulesService,
        },
      ],
    }).compile();

    controller = module.get<LessonSchedulesController>(
      LessonSchedulesController,
    );
  });

  describe('getParticipants', () => {
    it('passes userId, lessonId, and scheduleId to service', async () => {
      const req = {
        user: { id: 7 },
      } as Request & { user: JwtPayload };
      const expected = [
        { userId: 11, nickname: 'student', profileImage: null },
      ];

      schedulesService.getParticipants.mockResolvedValue(expected);

      const result = await controller.getParticipants(3, 9, req);

      expect(schedulesService.getParticipants).toHaveBeenCalledWith(7, 3, 9);
      expect(result).toEqual(expected);
    });
  });
});
