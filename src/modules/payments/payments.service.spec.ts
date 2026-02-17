import { Test, TestingModule } from '@nestjs/testing';
import { PaymentsService } from './payments.service';
import { PrismaService } from '../../prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('PaymentsService', () => {
  let service: PaymentsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      lessonSchedule: {
        findUnique: jest.fn(),
      },
      userCoupon: {
        findMany: jest.fn(),
      },
      user: {
        findUnique: jest.fn(),
      },
      coupon: {
        findUnique: jest.fn(),
      },
      enrollment: {
        findUnique: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<PaymentsService>(PaymentsService);
  });

  describe('getPaymentPreview', () => {
    it('정상적인 결제 미리보기 반환 (할인 가격 적용)', async () => {
      const mockSchedule = {
        id: 1,
        lesson: {
          id: 1,
          price: 10000,
          discountedPrice: 8000, // 20% 할인
          lessonCategory: {
            id: 1,
            name: 'Test Category',
          },
          representativeImage: 'image.jpg',
          title: 'Test Lesson',
          address: 'Seoul',
        },
        startAt: new Date('2026-03-01'),
        endAt: new Date('2026-03-01T11:00:00'),
      };

      prismaMock.lessonSchedule.findUnique.mockResolvedValue(mockSchedule);
      prismaMock.userCoupon.findMany.mockResolvedValue([]);
      prismaMock.user.findUnique.mockResolvedValue({ point: 20000 });

      const result = await service.getPaymentPreview(1, 2, 1);

      expect(result.originalPrice).toBe(8000); // 할인 적용 가격
      expect(result.quantity).toBe(2);
      expect(result.subtotal).toBe(16000);
      expect(result.canPay).toBe(true);
      expect(result.userPoints).toBe(20000);
    });

    it('쿠폰이 없을 때도 정상 작동', async () => {
      const mockSchedule = {
        id: 1,
        lesson: {
          id: 1,
          price: 10000,
          discountedPrice: 0,
          lessonCategory: { id: 1, name: 'Test' },
          representativeImage: 'image.jpg',
          title: 'Test',
          address: 'Seoul',
        },
        startAt: new Date('2026-03-01'),
        endAt: new Date('2026-03-01T11:00:00'),
      };

      prismaMock.lessonSchedule.findUnique.mockResolvedValue(mockSchedule);
      prismaMock.userCoupon.findMany.mockResolvedValue([]);
      prismaMock.user.findUnique.mockResolvedValue({ point: 5000 });

      const result = await service.getPaymentPreview(1, 1, 1);

      expect(result.subtotal).toBe(10000);
      expect(result.canPay).toBe(false); // 포인트 부족
      expect(result.userPoints).toBe(5000);
    });

    it('존재하지 않는 스케줄로 예외 발생', async () => {
      prismaMock.lessonSchedule.findUnique.mockResolvedValue(null);

      await expect(service.getPaymentPreview(999, 1, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('calculateFinalPrice', () => {
    it('쿠폰 할인 (정액)을 정확히 계산', async () => {
      const mockSchedule = {
        id: 1,
        lesson: {
          id: 1,
          price: 10000,
          discountedPrice: 0,
        },
      };

      const mockCoupon = {
        id: 1,
        discountType: 'FIXED',
        discountValue: 2000,
      };

      prismaMock.lessonSchedule.findUnique.mockResolvedValue(mockSchedule);
      prismaMock.coupon.findUnique.mockResolvedValue(mockCoupon);
      prismaMock.user.findUnique.mockResolvedValue({ point: 20000 });

      const result = await service.calculateFinalPrice(1, 1, 2, 1);

      expect(result.subtotal).toBe(20000); // 10000 * 2
      expect(result.couponDiscount).toBe(2000);
      expect(result.finalPrice).toBe(18000);
      expect(result.canPay).toBe(true);
    });

    it('쿠폰 할인 (퍼센트)을 정확히 계산', async () => {
      const mockSchedule = {
        id: 1,
        lesson: {
          id: 1,
          price: 10000,
          discountedPrice: 0,
        },
      };

      const mockCoupon = {
        id: 1,
        discountType: 'PERCENT',
        discountValue: 20, // 20%
      };

      prismaMock.lessonSchedule.findUnique.mockResolvedValue(mockSchedule);
      prismaMock.coupon.findUnique.mockResolvedValue(mockCoupon);
      prismaMock.user.findUnique.mockResolvedValue({ point: 20000 });

      const result = await service.calculateFinalPrice(1, 1, 2, 1);

      expect(result.subtotal).toBe(20000);
      expect(result.couponDiscount).toBe(4000); // 20% of 20000
      expect(result.finalPrice).toBe(16000);
    });
  });
});
