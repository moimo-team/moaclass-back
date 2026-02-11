import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/enrollments.dto';
import {
  PointType,
  TransactionStatus,
  ParticipationStatus,
} from '@prisma/client';

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  // 수강 신청
  async createEnrollment(userId: number, dto: CreateEnrollmentDto) {
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: dto.scheduleId },
    });
    if (!schedule) throw new BadRequestException('존재하지 않는 스케줄입니다.');

    let finalAmount = dto.paidAmount;

    // 1. 포인트 사용
    if (dto.usePoints && dto.usePoints > 0) {
      const user = await this.prisma.user.findUnique({ where: { id: userId } });
      if (!user || user.point < dto.usePoints) {
        throw new BadRequestException('포인트 잔액이 부족합니다.');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: { point: { decrement: dto.usePoints } },
      });

      finalAmount -= dto.usePoints;
    }

    // 2. 쿠폰 사용
    if (dto.couponId) {
      const userCoupon = await this.prisma.userCoupon.findFirst({
        where: { userId, couponId: dto.couponId, isUsed: false },
        include: { coupon: true },
      });
      if (!userCoupon)
        throw new BadRequestException('사용할 수 없는 쿠폰입니다.');

      if (userCoupon.coupon.discountType === 'FIXED') {
        finalAmount -= userCoupon.coupon.discountValue;
      } else if (userCoupon.coupon.discountType === 'PERCENT') {
        finalAmount -= Math.floor(
          (finalAmount * userCoupon.coupon.discountValue) / 100,
        );
      }

      await this.prisma.userCoupon.update({
        where: { id: userCoupon.id },
        data: { isUsed: true, usedAt: new Date() },
      });
    }

    // 3. PointTransaction 생성
    const transaction = await this.prisma.pointTransaction.create({
      data: {
        userId,
        lessonId: schedule.lessonId,
        couponId: dto.couponId,
        amount: finalAmount,
        type: dto.usePoints ? PointType.USE : PointType.CHARGE,
        status: TransactionStatus.COMPLETED,
      },
    });

    // 4. Enrollment 생성
    return this.prisma.enrollment.create({
      data: {
        userId,
        scheduleId: dto.scheduleId,
        pointTransactionId: transaction.id,
        status: ParticipationStatus.ACCEPTED,
      },
    });
  }

  // 내가 신청한 클래스 목록 조회
  async getMyEnrollments(userId: number) {
    return this.prisma.enrollment.findMany({
      where: { userId },
      include: { schedule: true, transaction: true },
    });
  }

  // 수강 취소
  async cancelEnrollment(userId: number, enrollmentId: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { transaction: true },
    });
    if (!enrollment || enrollment.userId !== userId) {
      throw new BadRequestException('취소할 수 없는 신청입니다.');
    }

    // 환불 처리
    if (enrollment.transaction?.amount && enrollment.transaction.amount > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: { point: { increment: enrollment.transaction.amount } },
      });

      await this.prisma.pointTransaction.create({
        data: {
          userId,
          lessonId: enrollment.transaction.lessonId, // ✅ 외래키 직접 지정
          amount: enrollment.transaction.amount,
          type: PointType.REFUND,
          status: TransactionStatus.COMPLETED,
        },
      });
    }

    return this.prisma.enrollment.update({
      where: { id: enrollmentId },
      data: { status: ParticipationStatus.CANCELED },
    });
  }
}
