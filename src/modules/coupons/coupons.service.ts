import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { formatUtcDateToSeoulDateTime } from '../lessons/utils/schedule-time.util';
@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) { }

  // 1. 쿠폰 상세 조회
  async getCoupon(id: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    return {
      ...coupon,
      validFrom: formatUtcDateToSeoulDateTime(coupon.validFrom),
      validUntil: formatUtcDateToSeoulDateTime(coupon.validUntil),
      createdAt: formatUtcDateToSeoulDateTime(coupon.createdAt),
      updatedAt: formatUtcDateToSeoulDateTime(coupon.updatedAt),
    };
  }

  // 2. 전체 쿠폰 조회
  async getAllCoupons() {
    const coupons = await this.prisma.coupon.findMany();
    return coupons.map((coupon) => ({
      ...coupon,
      validFrom: formatUtcDateToSeoulDateTime(coupon.validFrom),
      validUntil: formatUtcDateToSeoulDateTime(coupon.validUntil),
      createdAt: formatUtcDateToSeoulDateTime(coupon.createdAt),
      updatedAt: formatUtcDateToSeoulDateTime(coupon.updatedAt),
    }));
  }

  // 3. 쿠폰 생성
  async createCoupon(data: {
    code: string;
    description?: string;
    discountType: 'FIXED' | 'PERCENT';
    discountValue: number;
    maxUsage: number;
    validFrom: Date;
    validUntil: Date;
  }) {
    return this.prisma.coupon.create({ data });
  }

  // ✅ NEW: 신규 사용자 환영 쿠폰 발급
  async issueWelcomeCoupon(userId: number) {
    // 환영 쿠폰 조회 (code: 'WELCOME', 또는 활성화된 환영 쿠폰)
    const welcomeCoupon = await this.prisma.coupon.findFirst({
      where: {
        code: { contains: 'WELCOME' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!welcomeCoupon) {
      // 쿠폰이 없으면 조용히 실패 (에러 발생 안 함)
      console.warn('활성화된 환영 쿠폰이 없습니다.');
      return null;
    }

    // 최대 발급 횟수 확인
    if (welcomeCoupon.currentUsage >= welcomeCoupon.maxUsage) {
      console.warn('환영 쿠폰 발급 제한에 도달했습니다.');
      return null;
    }

    // 이미 발급받았는지 확인
    const existing = await this.prisma.userCoupon.findFirst({
      where: {
        userId,
        couponId: welcomeCoupon.id,
      },
    });

    if (existing) {
      console.log('이미 환영 쿠폰을 발급받은 사용자입니다.');
      return null;
    }

    // 환영 쿠폰 발급
    return this.prisma.$transaction(async (tx) => {
      // ✅ 1. 중복 발급 방지 (트랜잭션 내 재검사)
      const existingInTx = await tx.userCoupon.findUnique({
        where: {
          userId_couponId: {
            userId,
            couponId: welcomeCoupon.id,
          },
        },
      });

      if (existingInTx) {
        return existingInTx;
      }

      // ✅ 2. 최대 발급 횟수 원자적 확인 및 증가 (Race Condition 방지)
      const updateResult = await tx.coupon.updateMany({
        where: {
          id: welcomeCoupon.id,
          currentUsage: { lt: welcomeCoupon.maxUsage },
        },
        data: {
          currentUsage: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        console.warn(`환영 쿠폰 발급 제한 도달 (ID: ${welcomeCoupon.id})`);
        return null;
      }

      // ✅ 3. 쿠폰 발급 (expiresAt: 30일)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: welcomeCoupon.id,
          expiresAt,
        },
      });

      return userCoupon;
    });
  }

  // ✅ NEW: 리뷰 작성 보상 쿠폰 발급 (이미지 리뷰)
  async issueReviewRewardCoupon(userId: number) {
    const rewardCoupon = await this.prisma.coupon.findFirst({
      where: {
        code: { contains: 'REVIEW' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!rewardCoupon) {
      console.warn('활성화된 리뷰 보상 쿠폰이 없습니다.');
      return null;
    }

    if (rewardCoupon.currentUsage >= rewardCoupon.maxUsage) {
      console.warn('리뷰 보상 쿠폰 발급 제한에 도달했습니다.');
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      // ✅ 1. 중복 발급 방지
      const existing = await tx.userCoupon.findUnique({
        where: {
          userId_couponId: {
            userId,
            couponId: rewardCoupon.id,
          },
        },
      });

      if (existing) {
        return existing;
      }

      // ✅ 2. 최대 발급 횟수 원자적 확인 및 증가 (Race Condition 방지)
      const updateResult = await tx.coupon.updateMany({
        where: {
          id: rewardCoupon.id,
          currentUsage: { lt: rewardCoupon.maxUsage },
        },
        data: {
          currentUsage: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        console.warn(`리뷰 보상 쿠폰 발급 제한 도달 (ID: ${rewardCoupon.id})`);
        return null;
      }

      // ✅ 3. 쿠폰 발급 (expiresAt: 30일)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: rewardCoupon.id,
          expiresAt,
        },
      });

      return userCoupon;
    });
  }

  // ✅ NEW: 재수강 쿠폰 발급 (수강 완료 보상)
  async issueRetakeCoupon(userId: number) {
    const retakeCoupon = await this.prisma.coupon.findFirst({
      where: {
        code: { contains: 'RETAKE' },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!retakeCoupon) {
      console.warn('활성화된 재수강 쿠폰이 없습니다.');
      return null;
    }

    if (retakeCoupon.currentUsage >= retakeCoupon.maxUsage) {
      console.warn('재수강 쿠폰 발급 제한에 도달했습니다.');
      return null;
    }

    return this.prisma.$transaction(async (tx) => {
      // ✅ 1. 중복 발급 방지 (이미 발급받은 이력이 있으면 무시)
      const existing = await tx.userCoupon.findUnique({
        where: {
          userId_couponId: {
            userId,
            couponId: retakeCoupon.id,
          },
        },
      });

      if (existing) {
        return existing;
      }

      // ✅ 2. 최대 발급 횟수 원자적 확인 및 증가 (Race Condition 방지)
      const updateResult = await tx.coupon.updateMany({
        where: {
          id: retakeCoupon.id,
          currentUsage: { lt: retakeCoupon.maxUsage },
        },
        data: {
          currentUsage: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        console.warn(`재수강 쿠폰 발급 제한 도달 (ID: ${retakeCoupon.id})`);
        return null;
      }

      // ✅ 3. 쿠폰 발급 (expiresAt: 30일)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: retakeCoupon.id,
          expiresAt,
        },
      });

      return userCoupon;
    });
  }

  async issueCoupon(userId: number, couponId: number) {
    //TODO: 발급일자 기준 쿠폰 유효기간 수정
    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new BadRequestException('존재하지 않는 쿠폰입니다.');
    }

    // ✅ 최대 사용 횟수 초과 확인
    if (coupon.currentUsage >= coupon.maxUsage) {
      throw new BadRequestException('더 이상 발급할 수 없는 쿠폰입니다.');
    }

    const existing = await this.prisma.userCoupon.findFirst({
      where: {
        userId,
        couponId,
      },
    });

    if (existing) {
      throw new BadRequestException('이미 해당 쿠폰이 발급되어 있습니다.');
    }

    // ✅ 쿠폰 발급 + currentUsage 증가 (트랜잭션)
    return this.prisma.$transaction(async (tx) => {
      // ✅ 1. 중복 발급 방지 (트랜잭션 내 재검사)
      const existingInTx = await tx.userCoupon.findUnique({
        where: {
          userId_couponId: {
            userId,
            couponId,
          },
        },
      });

      if (existingInTx) {
        throw new BadRequestException('이미 해당 쿠폰이 발급되어 있습니다.');
      }

      // ✅ 2. 최대 발급 횟수 원자적 확인 및 증가 (Race Condition 방지)
      const updateResult = await tx.coupon.updateMany({
        where: {
          id: couponId,
          currentUsage: { lt: coupon.maxUsage },
        },
        data: {
          currentUsage: { increment: 1 },
        },
      });

      if (updateResult.count === 0) {
        throw new BadRequestException('더 이상 발급할 수 없는 쿠폰입니다.');
      }

      // ✅ 3. 쿠폰 발급
      const expiresAt = coupon.validUntil;

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId,
          expiresAt,
        },
      });

      return userCoupon;
    });
  }

  // 5. 유저가 가진 쿠폰 조회
  async getUserCoupons(userId: number) {
    const now = new Date();

    const userCoupons = await this.prisma.userCoupon.findMany({
      where: { userId },
      include: { coupon: true },
    });

    return userCoupons.map((uc) => {
      let status: 'USED' | 'AVAILABLE' | 'EXPIRED';

      if (uc.isUsed) {
        status = 'USED';
      } else if (
        (uc.coupon.validUntil && uc.coupon.validUntil < now) ||
        (uc.expiresAt && uc.expiresAt < now)  // ✅ NEW: UserCoupon의 expiresAt도 확인
      ) {
        status = 'EXPIRED';
      } else {
        status = 'AVAILABLE';
      }

      return {
        id: uc.coupon.id,
        code: uc.coupon.code,
        description: uc.coupon.description,
        discountType: uc.coupon.discountType,
        discountValue: uc.coupon.discountValue,
        validFrom: formatUtcDateToSeoulDateTime(uc.coupon.validFrom),
        validUntil: formatUtcDateToSeoulDateTime(uc.expiresAt ?? uc.coupon.validUntil),
        isUsed: uc.isUsed,
        usedAt: uc.usedAt ? formatUtcDateToSeoulDateTime(uc.usedAt) : null,
        issuedAt: formatUtcDateToSeoulDateTime(uc.issuedAt),
        status,
      };
    });
  }

  // ✅ NEW: 사용 가능한(미사용 & 유효기간 내) 쿠폰 목록 조회
  async getAvailableUserCoupons(userId: number) {
    const now = new Date();
    return this.prisma.userCoupon.findMany({
      where: {
        userId,
        isUsed: false,
        NOT: {
          expiresAt: { lt: now }, // expiresAt이 현재보다 전이면 제외 (null은 포함)
        },
        coupon: {
          validFrom: { lte: now },
          NOT: {
            validUntil: { lt: now }, // validUntil이 현재보다 전이면 제외 (null은 포함)
          },
        },
      },
      include: { coupon: true },
    });
  }

  // ✅ NEW: 공통 쿠폰 유효성 검증 로직
  async validateUserCoupon(userId: number, couponId: number, tx?: any) {
    const prisma = tx || this.prisma;
    const now = new Date();

    const userCoupon = await prisma.userCoupon.findFirst({
      where: {
        userId,
        couponId,
      },
      include: { coupon: true },
    });

    if (!userCoupon) {
      throw new BadRequestException('보유하고 있지 않은 쿠폰입니다.');
    }

    if (userCoupon.isUsed || userCoupon.usedAt) {
      throw new BadRequestException('이미 사용된 쿠폰입니다.');
    }

    // 1. UserCoupon의 자체 만료 기간(expiresAt) 확인
    if (userCoupon.expiresAt && userCoupon.expiresAt < now) {
      throw new BadRequestException('만료된 쿠폰입니다.');
    }

    // 2. Coupon의 전체 유효 기간(validFrom, validUntil) 확인
    if (userCoupon.coupon.validFrom && userCoupon.coupon.validFrom > now) {
      throw new BadRequestException('아직 사용 가능 기간이 아닌 쿠폰입니다.');
    }

    if (userCoupon.coupon.validUntil && userCoupon.coupon.validUntil < now) {
      throw new BadRequestException('사용 기간이 만료된 쿠폰입니다.');
    }

    return userCoupon;
  }
}
