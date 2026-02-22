import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionStatus, PointType } from '@prisma/client';
import { formatUtcDateToSeoulDateTime } from '../lessons/utils/schedule-time.util';
@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) { }

  async getMyPoints(userId: number) {
    // 유저 포인트 잔액 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { point: true },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 유저입니다.');
    }

    // 포인트 내역 조회 (enrollment -> schedule -> lesson, coupon)
    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      include: {
        enrollment: { include: { schedule: { include: { lesson: true } } } },
        coupon: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const history = transactions.map((t) => {
      // ✅ 타입별 금액 처리
      let signedAmount = t.amount;
      switch (t.type) {
        case PointType.USE: // 학생 결제 → 음수
        case PointType.DEDUCT: // 선생님 차감 → 음수
          signedAmount = -t.amount;
          break;
        case PointType.CHARGE: // 학생 충전 → 양수
        case PointType.REFUND: // 학생 환불 → 양수
        case PointType.EARN: // 선생님 적립 → 양수
          signedAmount = t.amount;
          break;
      }

      return {
        transactionId: t.id,
        lessonName: t.enrollment?.schedule?.lesson?.title ?? null,
        type: t.type,
        status: t.status,
        amount: signedAmount,
        coupon: t.coupon
          ? {
            code: t.coupon.code,
            discountType: t.coupon.discountType,
            discountValue: t.coupon.discountValue,
          }
          : null,
        createdAt: formatUtcDateToSeoulDateTime(t.createdAt),
      };
    });

    // teacherProfit: teacher net earnings = sum(EARN) - sum(DEDUCT)
    const earnAgg = await this.prisma.pointTransaction.aggregate({
      where: { userId, type: PointType.EARN },
      _sum: { amount: true },
    });
    const deductAgg = await this.prisma.pointTransaction.aggregate({
      where: { userId, type: PointType.DEDUCT },
      _sum: { amount: true },
    });

    const teacherProfit =
      (earnAgg._sum.amount ?? 0) - (deductAgg._sum.amount ?? 0);

    return {
      userPoints: user.point,
      teacherProfit,
      history,
    };
  }

  async chargePoints(userId: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('충전 금액은 0보다 커야 합니다.');
    }

    return this.prisma.$transaction(async (tx) => {
      // 유저 포인트 증가
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { point: { increment: amount } },
      });

      // 포인트 트랜잭션 기록
      const transaction = await tx.pointTransaction.create({
        data: {
          userId,
          amount,
          type: PointType.CHARGE,
          status: TransactionStatus.COMPLETED,
        },
      });

      return {
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          type: transaction.type,
          status: transaction.status,
          createdAt: formatUtcDateToSeoulDateTime(transaction.createdAt),
        },
        userPoints: updatedUser.point,
      };
    });
  }

  // ✅ NEW: 포인트 적립 (리뷰 보상 등)
  async earnPoints(userId: number, amount: number, type: PointType = PointType.EARN) {
    if (amount <= 0) return;

    return this.prisma.$transaction(async (tx) => {
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { point: { increment: amount } },
      });

      const transaction = await tx.pointTransaction.create({
        data: {
          userId,
          amount,
          type,
          status: TransactionStatus.COMPLETED,
        },
      });

      return {
        transaction,
        userPoints: updatedUser.point,
      };
    });
  }
}
