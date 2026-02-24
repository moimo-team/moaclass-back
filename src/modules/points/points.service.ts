import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PointType, TransactionStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { formatUtcDateToSeoulDateTime } from '../lessons/utils/schedule-time.util';

@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyPoints(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { point: true },
    });

    if (!user) {
      throw new NotFoundException('존재하지 않는 사용자입니다.');
    }

    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      include: {
        enrollment: { include: { schedule: { include: { lesson: true } } } },
        coupon: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const history = transactions.map((t) => {
      let signedAmount = t.amount;
      switch (t.type) {
        case PointType.USE:
        case PointType.DEDUCT:
          signedAmount = -t.amount;
          break;
        case PointType.CHARGE:
        case PointType.REFUND:
        case PointType.EARN:
        case PointType.EVENT:
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
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { point: { increment: amount } },
      });

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

  async earnPoints(
    userId: number,
    amount: number,
    type: PointType = PointType.EARN,
  ) {
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
