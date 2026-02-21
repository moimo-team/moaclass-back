import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) { }

  // 1. 쿠폰 상세 조회
  async getCoupon(id: number) {
    const coupon = await this.prisma.coupon.findUnique({ where: { id } });
    if (!coupon) throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    return coupon;
  }

  // 2. 전체 쿠폰 조회
  async getAllCoupons() {
    return this.prisma.coupon.findMany();
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
      // ✅ NEW: expiresAt 설정 (발급 후 30일)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: welcomeCoupon.id,
          expiresAt,
        },
      });

      // currentUsage 증가
      await tx.coupon.update({
        where: { id: welcomeCoupon.id },
        data: { currentUsage: { increment: 1 } },
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
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30); // ✅ 7일에서 30일로 변경

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId: rewardCoupon.id,
          expiresAt,
        },
      });

      await tx.coupon.update({
        where: { id: rewardCoupon.id },
        data: { currentUsage: { increment: 1 } },
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
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 30);

      const userCoupon = await tx.userCoupon.upsert({
        where: {
          userId_couponId: {
            userId,
            couponId: retakeCoupon.id,
          },
        },
        create: {
          userId,
          couponId: retakeCoupon.id,
          expiresAt,
        },
        update: {
          isUsed: false,
          usedAt: null,
          issuedAt: new Date(),
          expiresAt,
        },
      });

      await tx.coupon.update({
        where: { id: retakeCoupon.id },
        data: { currentUsage: { increment: 1 } },
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

    // ✅ 쿠폰 발급 + currentUsage 증가
    return this.prisma.$transaction(async (tx) => {
      // ✅ NEW: expiresAt 설정 (쿠폰의 validUntil 기준)
      const expiresAt = coupon.validUntil;

      const userCoupon = await tx.userCoupon.create({
        data: {
          userId,
          couponId,
          expiresAt,
        },
      });

      await tx.coupon.update({
        where: { id: couponId },
        data: { currentUsage: { increment: 1 } },
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
        validFrom: uc.coupon.validFrom,
        validUntil: uc.coupon.validUntil,
        isUsed: uc.isUsed,
        usedAt: uc.usedAt,
        issuedAt: uc.issuedAt,
        status,
      };
    });
  }
}
