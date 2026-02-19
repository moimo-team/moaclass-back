import { Test, TestingModule } from '@nestjs/testing';
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
  let schedulesService: { getParticipants: jest.Mock };

  beforeEach(async () => {
    schedulesService = {
      getParticipants: jest.fn(),
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

    controller = module.get<LessonSchedulesController>(LessonSchedulesController);
  });

  describe('getParticipants', () => {
    it('passes userId, lessonId, and scheduleId to service', async () => {
      const req = { user: { id: 7 } } as any;
      const expected = [{ userId: 11, nickname: 'student', profileImage: null }];

      schedulesService.getParticipants.mockResolvedValue(expected);

      const result = await controller.getParticipants(3, 9, req);

      expect(schedulesService.getParticipants).toHaveBeenCalledWith(7, 3, 9);
      expect(result).toEqual(expected);
    });
  });
});
