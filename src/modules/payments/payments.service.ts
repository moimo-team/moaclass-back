import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  // 1. 결제 정보 조회
  async getPaymentPreview(scheduleId: number, quantity: number) {
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: scheduleId },
      include: { lesson: true },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const subtotal = schedule.lesson.price * quantity;

    // 사용 가능한 쿠폰 조회
    const availableCoupons = await this.prisma.coupon.findMany({
      where: {
        validFrom: { lte: new Date() },
        validUntil: { gte: new Date() },
      },
    });

    // 유저 포인트 조회 (예시: userId = 1)
    const user = await this.prisma.user.findUnique({ where: { id: 1 } });

    return {
      originalPrice: schedule.lesson.price,
      quantity,
      subtotal,
      availableCoupons,
      userPoints: user?.point ?? 0,
    };
  }

  // 2. 최종 결제 금액 계산
  async calculateFinalPrice(
    scheduleId: number,
    quantity: number,
    couponId?: number,
  ) {
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: scheduleId },
      include: { lesson: true },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    let subtotal = schedule.lesson.price * quantity;
    let couponDiscount = 0;

    if (couponId) {
      const coupon = await this.prisma.coupon.findUnique({
        where: { id: couponId },
      });
      if (coupon) {
        if (coupon.discountType === 'PERCENT') {
          couponDiscount = Math.floor(subtotal * (coupon.discountValue / 100));
        } else if (coupon.discountType === 'FIXED') {
          couponDiscount = coupon.discountValue;
        }
      }
    }

    const finalPrice = subtotal - couponDiscount;

    // 유저 포인트 조회 (예시: userId = 1)
    const user = await this.prisma.user.findUnique({ where: { id: 1 } });
    const canPay = (user?.point ?? 0) >= finalPrice;

    return {
      subtotal,
      couponDiscount,
      finalPrice,
      userPoints: user?.point ?? 0,
      canPay,
    };
  }
}
