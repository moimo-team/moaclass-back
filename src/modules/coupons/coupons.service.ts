import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CouponsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async issueCoupon(userId: number, couponId: number) {
    //TODO: 발급일자 기준 쿠폰 유효기간 수정
    const existing = await this.prisma.userCoupon.findFirst({
      where: {
        userId,
        couponId,
      },
    });

    if (existing) {
      throw new BadRequestException('이미 해당 쿠폰이 발급되어 있습니다.');
    }

    return this.prisma.userCoupon.create({
      data: {
        userId,
        couponId,
      },
    });
  }

  // 5. 유저가 가진 쿠폰 조회
  async getUserCoupons(userId: number) {
    console.log(userId);

    const userCoupons = await this.prisma.userCoupon.findMany({
      where: { userId },
      include: { coupon: true },
    });

    return userCoupons.map((uc) => ({
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
    }));
  }
}
