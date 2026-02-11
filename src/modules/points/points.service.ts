import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TransactionStatus, PointType } from '@prisma/client';
@Injectable()
export class PointsService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyPoints(userId: number) {
    // 유저 포인트 잔액 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { point: true },
    });

    if (!user) {
      throw new Error('존재하지 않는 유저입니다.');
    }

    // 포인트 내역 조회
    const transactions = await this.prisma.pointTransaction.findMany({
      where: { userId },
      include: { lesson: true, coupon: true },
      orderBy: { createdAt: 'desc' },
    });

    const history = transactions.map((t) => ({
      transactionId: t.id,
      lessonName: t.lesson?.title,
      type: t.type,
      status: t.status,
      amount: t.amount,
      coupon: t.coupon
        ? {
            code: t.coupon.code,
            discountType: t.coupon.discountType,
            discountValue: t.coupon.discountValue,
          }
        : null,
      createdAt: t.createdAt,
    }));

    return {
      userPoints: user.point,
      history,
    };
  }

  async chargePoints(userId: number, amount: number) {
    if (amount <= 0) {
      throw new BadRequestException('충전 금액은 0보다 커야 합니다.');
    }

    // 유저 포인트 증가
    const updatedUser = await this.prisma.user.update({
      where: { id: userId },
      data: { point: { increment: amount } },
    });

    // 포인트 트랜잭션 기록
    const transaction = await this.prisma.pointTransaction.create({
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
        createdAt: transaction.createdAt,
      },
      userPoints: updatedUser.point,
    };
  }
}
