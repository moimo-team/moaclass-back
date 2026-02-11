import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentDetailDto } from './dto/payments.dto';
import { TransactionStatus } from '@prisma/client';
@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentPreview(
    scheduleId: number,
    quantity: number,
    userId: number,
  ) {
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: scheduleId },
      include: {
        lesson: {
          include: {
            lessonCategory: true,
          },
        },
      },
    });

    if (!schedule) {
      throw new Error('Schedule not found');
    }

    const price =
      schedule.lesson.discountedPrice > 0
        ? schedule.lesson.discountedPrice
        : schedule.lesson.price;

    const subtotal = price * quantity;

    const availableCoupons = await this.prisma.userCoupon.findMany({
      where: {
        userId,
        isUsed: false,
        coupon: {
          validFrom: { lte: new Date() },
          validUntil: { gte: new Date() },
        },
      },
      include: { coupon: true },
    });

    const coupons = availableCoupons.map((uc) => ({
      id: uc.coupon.id,
      name: uc.coupon.description ?? uc.coupon.code,
      discountType: uc.coupon.discountType,
      discountValue: uc.coupon.discountValue,
      valid_until: uc.coupon.validUntil,
    }));

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const userPoints = user?.point ?? 0;
    const canPay = userPoints >= subtotal;

    return {
      originalPrice: price,
      quantity,
      subtotal,
      availableCoupons: coupons,
      userPoints,
      canPay,

      lessons: {
        category: {
          id: schedule.lesson.lessonCategory.id,
          name: schedule.lesson.lessonCategory.name,
        },
        representativeImage: schedule.lesson.representativeImage,
        title: schedule.lesson.title,
        schedule: {
          startAt: schedule.startAt,
          endAt: schedule.endAt,
        },
        address: schedule.lesson.address,
      },
    };
  }
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

    const subtotal = schedule.lesson.price * quantity;
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
  async getPaymentDetail(
    transactionId: number,
    userId: number,
  ): Promise<PaymentDetailDto> {
    const transaction = await this.prisma.pointTransaction.findFirst({
      where: { id: transactionId, userId },
      include: {
        lesson: { include: { teacher: true } },
        coupon: true,
      },
    });

    if (!transaction) {
      throw new NotFoundException('결제 내역을 찾을 수 없습니다.');
    }

    const amount = transaction.amount; // 최종 결제 금액
    let originPrice = amount;
    let discountedAmount = 0;

    if (transaction.coupon) {
      if (transaction.coupon.discountType === 'FIXED') {
        originPrice = amount + transaction.coupon.discountValue;
        discountedAmount = transaction.coupon.discountValue;
      } else if (transaction.coupon.discountType === 'PERCENT') {
        originPrice = Math.floor(
          amount / (1 - transaction.coupon.discountValue / 100),
        );
        discountedAmount = originPrice - amount;
      }
    }

    const detail: PaymentDetailDto = {
      orderId: transaction.id,
      lessonName: transaction.lesson?.title,
      teacherName: transaction.lesson?.teacher.nickname,
      originPrice,
      discountedAmount,
      amount,
      paymentDate: transaction.createdAt,
      status: transaction.status,
    };

    // 환불 상태일 경우 추가 정보 포함
    if (transaction.status === TransactionStatus.CANCELLED) {
      detail.reason = transaction.reason ?? '';
      detail.detailReason = transaction.detailReason ?? '';
      detail.refundAmount = transaction.amount;
      detail.refundDate = transaction.updatedAt;
    }

    return detail;
  }
}
