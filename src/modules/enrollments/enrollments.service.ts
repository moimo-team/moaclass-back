import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateEnrollmentDto } from './dto/enrollments.dto';
import {
  PointType,
  TransactionStatus,
  ParticipationStatus,
  Enrollment,
  LessonSchedule,
  PointTransaction,
} from '@prisma/client';
import { PageOptionsDto } from '../common/dto/page-options.dto';

type EnrollmentWithRelations = Enrollment & {
  schedule: LessonSchedule & {
    lesson: { title: string; representativeImage: string };
  };
  transaction: PointTransaction & {
    coupon?: { code: string; discountType: string; discountValue: number };
  };
};

@Injectable()
export class EnrollmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async createEnrollment(userId: number, dto: CreateEnrollmentDto) {
    return this.prisma.$transaction(async (tx) => {
      const schedule = await tx.lessonSchedule.findUnique({
        where: { id: dto.scheduleId },
        include: { lesson: true },
      });
      if (!schedule)
        throw new BadRequestException('존재하지 않는 스케줄입니다.');

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) throw new BadRequestException('존재하지 않는 유저입니다.');

      const finalPrice = dto.finalPrice;
      const userPoints = user.point;

      if (userPoints < finalPrice) {
        throw new BadRequestException({
          canPay: false,
          error: {
            code: 'INSUFFICIENT_POINTS',
            message: '보유 포인트가 부족하여 결제를 진행할 수 없습니다.',
          },
          finalPrice,
          userPoints,
        });
      }

      // 학생 포인트 차감
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { point: { decrement: finalPrice } },
      });

      // 결제 트랜잭션 생성
      const transaction = await tx.pointTransaction.create({
        data: {
          userId,
          lessonId: schedule.lessonId,
          amount: finalPrice,
          couponId: dto.couponId ?? null,
          type: 'USE',
          status: 'COMPLETED',
        },
      });

      // 수강 등록
      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          scheduleId: dto.scheduleId,
          status: 'ACCEPTED',
          pointTransactionId: transaction.id,
        },
      });

      // 선생님 포인트 적립
      const teacherId = schedule.lesson.userId;
      await tx.user.update({
        where: { id: teacherId },
        data: { point: { increment: finalPrice } },
      });

      // 성공 응답
      return {
        enrollmentId: enrollment.id,
        status: enrollment.status,
        transaction: {
          id: transaction.id,
          amount: transaction.amount,
          couponId: transaction.couponId,
          type: transaction.type,
          status: transaction.status,
        },
        userPoints: updatedUser.point,
      };
    });
  }

  async getMyEnrollments(userId: number, dto: PageOptionsDto) {
    const { page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;
    const now = new Date();

    const [totalCount, enrollments] = await Promise.all([
      this.prisma.enrollment.count({ where: { userId } }),
      this.prisma.enrollment.findMany({
        where: { userId },
        skip,
        take: limit,
        include: {
          schedule: { include: { lesson: true } },
          transaction: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const mappedData = enrollments.map((e: EnrollmentWithRelations) => ({
      enrollmentId: e.id,
      scheduleId: e.schedule.id,
      pointTransactionId: e.pointTransactionId,
      image: e.schedule.lesson.representativeImage,
      className: e.schedule.lesson.title,
      date: e.schedule.startAt.toISOString(),
      status: this.mapStatus(e, now), // 예약완료 / 예약취소 / 참석완료
      transactionStatus: e.transaction.status,
    }));

    return {
      page,
      limit,
      totalCount,
      data: mappedData,
    };
  }

  private mapStatus(enrollment: EnrollmentWithRelations, now: Date): string {
    if (enrollment.status === ParticipationStatus.CANCELED) {
      return '예약취소';
    }
    if (enrollment.status === ParticipationStatus.ACCEPTED) {
      if (enrollment.schedule.startAt > now) {
        return '예약완료';
      }
      if (enrollment.schedule.startAt <= now) {
        return '참석완료';
      }
    }
    return '예약대기';
  }

  async cancelEnrollment(userId: number, enrollmentId: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: { transaction: true },
    });
    if (!enrollment || enrollment.userId !== userId) {
      throw new BadRequestException('취소할 수 없는 신청입니다.');
    }

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
