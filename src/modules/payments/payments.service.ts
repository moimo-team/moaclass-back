import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PaymentDetailDto } from './dto/payments.dto';

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
      description: uc.coupon.description,
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
    userId: number,
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

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
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
    enrollmentId: number,
    userId: number,
  ): Promise<PaymentDetailDto> {
    // find the enrollment with all related transactions (USE and REFUND)
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        schedule: {
          include: {
            lesson: {
              include: { teacher: { include: { teacherProfile: true } } },
            },
          },
        },
        transactions: { include: { coupon: true } },
      },
    });

    if (!enrollment || enrollment.userId !== userId) {
      throw new NotFoundException('결제 내역을 찾을 수 없습니다.');
    }

    const { schedule, originPrice, discountAmount, finalPrice, quantity } =
      enrollment;

    // find payment and refund transactions
    const useTx = (enrollment.transactions ?? []).find((t) => t.type === 'USE');
    const refundTx = (enrollment.transactions ?? []).find(
      (t) => t.type === 'REFUND',
    );

    if (!useTx) {
      throw new NotFoundException('결제 내역을 찾을 수 없습니다.');
    }
    console.log('선생이름', schedule.lesson.teacher.teacherProfile?.nickname);

    const detail: PaymentDetailDto = {
      orderId: useTx.id,
      transactionStatus: useTx.status,
      paymentDate: useTx.createdAt,
      classInfo: {
        title: schedule.lesson.title,
        teacherName:
          schedule.lesson.teacher.teacherProfile?.nickname ?? '알 수 없음',
        startAt: schedule.startAt,
        endAt: schedule.endAt,
      },
      paymentInfo: {
        originPrice,
        discountAmount,
        finalPrice,
        quantity,
        coupon:
          useTx && useTx.coupon
            ? {
                id: useTx.coupon.id,
                name: useTx.coupon.description ?? '',
                discountType: useTx.coupon.discountType,
                discountValue: useTx.coupon.discountValue,
              }
            : null,
      },
      refundInfo: refundTx
        ? {
            deductedAmount: finalPrice - refundTx.amount,
            refundAmount: refundTx.amount,
            paidAmount: finalPrice,
            refundDate: refundTx.createdAt,
            reason: refundTx.reason ?? '수강 취소 환불',
            detailReason: refundTx.detailReason ?? '',
          }
        : null,
    };

    return detail;
  }
}
