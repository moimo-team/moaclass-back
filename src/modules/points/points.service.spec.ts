import { Test, TestingModule } from '@nestjs/testing';
import { PointsService } from './points.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('PointsService', () => {
  let service: PointsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      pointTransaction: {
        findMany: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PointsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PointsService>(PointsService);
  });

  describe('getMyPoints', () => {
    it('유저 포인트와 거래 이력을 정확히 반환', async () => {
      const mockUser = { point: 50000 };

      const mockTransactions = [
        {
          id: 1,
          userId: 1,
          type: 'CHARGE',
          amount: 100000,
          coupon: null,
          enrollment: { schedule: { lesson: { title: 'Test Lesson' } } },
          createdAt: new Date('2026-02-10'),
        },
        {
          id: 2,
          userId: 1,
          type: 'USE',
          amount: 50000,
          coupon: null,
          enrollment: { schedule: { lesson: { title: 'Test Lesson 2' } } },
          createdAt: new Date('2026-02-12'),
        },
      ];

      prismaMock.user.findUnique.mockResolvedValue(mockUser);
      prismaMock.pointTransaction.findMany.mockResolvedValue(mockTransactions);
      prismaMock.pointTransaction.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100000 } }) // EARN
        .mockResolvedValueOnce({ _sum: { amount: 50000 } }); // DEDUCT

      const result = await service.getMyPoints(1);

      expect(result.userPoints).toBe(50000);
      expect(result.history.length).toBe(2);
      expect(result.history[0].type).toBe('CHARGE');
      expect(result.history[0].amount).toBe(100000); // CHARGE는 양수
      expect(result.history[1].type).toBe('USE');
      expect(result.history[1].amount).toBe(-50000); // USE는 음수
      expect(result.teacherProfit).toBe(50000); // 100000 - 50000
    });

    it('존재하지 않는 유저로 예외 발생', async () => {
      prismaMock.user.findUnique.mockResolvedValue(null);

      await expect(service.getMyPoints(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('chargePoints', () => {
    it('포인트 충전이 정상 작동', async () => {
      const mockUser = { id: 1, point: 50000 };
      const mockTransaction = {
        id: 1,
        amount: 10000,
        type: 'CHARGE',
        status: 'COMPLETED',
        createdAt: new Date(),
      };

      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({ id: 1, point: 60000 }) },
        pointTransaction: { create: jest.fn().mockResolvedValue(mockTransaction) },
      };

      prismaMock.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      const result = await service.chargePoints(1, 10000);

      expect(result.userPoints).toBe(60000);
      expect(result.transaction.amount).toBe(10000);
      expect(result.transaction.type).toBe('CHARGE');
    });

    it('0 이하의 금액으로 예외 발생', async () => {
      await expect(service.chargePoints(1, 0)).rejects.toThrow(
        BadRequestException,
      );

      await expect(service.chargePoints(1, -1000)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});
