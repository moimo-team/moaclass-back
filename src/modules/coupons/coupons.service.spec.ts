import { Test, TestingModule } from '@nestjs/testing';
import { CouponsService } from './coupons.service';
import { PrismaService } from '../../prisma/prisma.service';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('CouponsService', () => {
  let service: CouponsService;
  let prismaMock: any;

  beforeEach(async () => {
    prismaMock = {
      coupon: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      userCoupon: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CouponsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<CouponsService>(CouponsService);
  });

  describe('getCoupon', () => {
    it('쿠폰을 정상적으로 조회', async () => {
      const mockCoupon = {
        id: 1,
        code: 'SUMMER2026',
        description: '여름 프로모션',
        discountType: 'PERCENT',
        discountValue: 20,
        maxUsage: 100,
        currentUsage: 30,
        validFrom: new Date('2026-06-01'),
        validUntil: new Date('2026-08-31'),
      };

      prismaMock.coupon.findUnique.mockResolvedValue(mockCoupon);

      const result = await service.getCoupon(1);

      expect(result.id).toBe(1);
      expect(result.code).toBe('SUMMER2026');
      expect(result.discountValue).toBe(20);
    });

    it('존재하지 않는 쿠폰으로 예외 발생', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(null);

      await expect(service.getCoupon(999)).rejects.toThrow(NotFoundException);
    });
  });

  describe('createCoupon', () => {
    it('쿠폰을 정상적으로 생성', async () => {
      const couponData = {
        code: 'NEWYEAR2026',
        description: '신년 특가',
        discountType: 'FIXED' as const,
        discountValue: 5000,
        maxUsage: 200,
        validFrom: new Date('2026-01-01'),
        validUntil: new Date('2026-01-31'),
      };

      const mockCreatedCoupon = {
        id: 2,
        currentUsage: 0,
        ...couponData,
      };

      prismaMock.coupon.create.mockResolvedValue(mockCreatedCoupon);

      const result = await service.createCoupon(couponData);

      expect(result.id).toBe(2);
      expect(result.code).toBe('NEWYEAR2026');
      expect(result.maxUsage).toBe(200);
      expect(result.currentUsage).toBe(0);
    });
  });

  describe('issueCoupon', () => {
    it('쿠폰을 정상적으로 발급하고 currentUsage 증가', async () => {
      const mockCoupon = {
        id: 1,
        code: 'SUMMER2026',
        maxUsage: 100,
        currentUsage: 30,
      };

      const mockUserCoupon = {
        id: 10,
        userId: 5,
        couponId: 1,
      };

      const mockTx = {
        userCoupon: {
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn().mockResolvedValue(mockUserCoupon),
        },
        coupon: {
          update: jest
            .fn()
            .mockResolvedValue({ ...mockCoupon, currentUsage: 31 }),
        },
      };

      prismaMock.coupon.findUnique.mockResolvedValue(mockCoupon);
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      const result = await service.issueCoupon(5, 1);

      expect(result.userId).toBe(5);
      expect(result.couponId).toBe(1);
    });

    it('maxUsage 초과 시 예외 발생', async () => {
      const mockCoupon = {
        id: 1,
        code: 'LIMITED',
        maxUsage: 10,
        currentUsage: 10, // 이미 다 사용됨
      };

      prismaMock.coupon.findUnique.mockResolvedValue(mockCoupon);

      await expect(service.issueCoupon(5, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('이미 발급된 쿠폰으로 예외 발생', async () => {
      const mockCoupon = {
        id: 1,
        code: 'SUMMER2026',
        maxUsage: 100,
        currentUsage: 30,
      };

      const mockTx = {
        userCoupon: {
          findFirst: jest
            .fn()
            .mockResolvedValue({ id: 5, userId: 5, couponId: 1 }),
        },
      };

      prismaMock.coupon.findUnique.mockResolvedValue(mockCoupon);
      prismaMock.$transaction.mockImplementation((callback) =>
        callback(mockTx),
      );

      await expect(service.issueCoupon(5, 1)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('존재하지 않는 쿠폰으로 예외 발생', async () => {
      prismaMock.coupon.findUnique.mockResolvedValue(null);

      await expect(service.issueCoupon(5, 999)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('getUserCoupons', () => {
    it('유저의 쿠폰 목록을 상태와 함께 반환', async () => {
      const now = new Date();
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);
      const pastDate = new Date();
      pastDate.setDate(pastDate.getDate() - 1);

      const mockUserCoupons = [
        {
          id: 1,
          userId: 5,
          couponId: 1,
          isUsed: false,
          usedAt: null,
          issuedAt: new Date('2026-02-01'),
          coupon: {
            id: 1,
            code: 'VALID',
            description: '유효한 쿠폰',
            discountType: 'PERCENT',
            discountValue: 20,
            validFrom: new Date('2026-01-01'),
            validUntil: futureDate, // 아직 유효
          },
        },
        {
          id: 2,
          userId: 5,
          couponId: 2,
          isUsed: true,
          usedAt: new Date('2026-02-10'),
          issuedAt: new Date('2026-02-05'),
          coupon: {
            id: 2,
            code: 'USED',
            description: '사용된 쿠폰',
            discountType: 'FIXED',
            discountValue: 5000,
            validFrom: new Date('2026-01-01'),
            validUntil: futureDate,
          },
        },
        {
          id: 3,
          userId: 5,
          couponId: 3,
          isUsed: false,
          usedAt: null,
          issuedAt: new Date('2026-01-15'),
          coupon: {
            id: 3,
            code: 'EXPIRED',
            description: '만료된 쿠폰',
            discountType: 'PERCENT',
            discountValue: 10,
            validFrom: new Date('2025-12-01'),
            validUntil: pastDate, // 만료됨
          },
        },
      ];

      prismaMock.userCoupon.findMany.mockResolvedValue(mockUserCoupons);

      const result = await service.getUserCoupons(5);

      expect(result.length).toBe(3);
      expect(result[0].status).toBe('AVAILABLE');
      expect(result[1].status).toBe('USED');
      expect(result[2].status).toBe('EXPIRED');
    });
  });
});
