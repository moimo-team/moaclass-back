import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notification/notifications.service';
// import { CouponsService } from '../coupons/coupons.service';
import { CreateEnrollmentDto } from './dto/enrollments.dto';
import {
  ParticipationStatus,
  Enrollment,
  LessonSchedule,
  PointTransaction,
  Prisma,
} from '@prisma/client';
import { EnrollmentPageOptionsDto } from './dto/enrollents-page-options.dto';
import { EnrollmentWithTransactions } from 'src/types/enrollment';

type EnrollmentWithRelations = Enrollment & {
  schedule: LessonSchedule & {
    lesson: { title: string; representativeImage: string };
  };
  // support both singular `transaction` (older schema) and plural `transactions` (new schema)
  transaction?: PointTransaction & {
    coupon?: { code: string; discountType: string; discountValue: number };
  };
  transactions?: (PointTransaction & {
    coupon?: { code: string; discountType: string; discountValue: number };
  })[];
};

@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async createEnrollment(userId: number, dto: CreateEnrollmentDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      const schedule = await tx.lessonSchedule.findUnique({
        where: { id: dto.scheduleId },
        include: { lesson: true },
      });
      if (!schedule) {
        throw new BadRequestException('존재하지 않는 스케줄입니다.');
      }

      const user = await tx.user.findUnique({ where: { id: userId } });
      if (!user) {
        throw new BadRequestException('존재하지 않는 유저입니다.');
      }

      // 🚨 최대 인원 초과 여부 확인
      if (
        schedule.lesson.maxParticipants !== null &&
        schedule.currentParticipants >= schedule.lesson.maxParticipants
      ) {
        throw new BadRequestException(
          '최대 인원을 초과하여 신청할 수 없습니다.',
        );
      }

      // ✅ 서버에서 원가(originPrice) 조회 (quantity 반영)
      const quantity = dto.quantity ?? 1;
      const price =
        schedule.lesson.discountedPrice > 0
          ? schedule.lesson.discountedPrice
          : schedule.lesson.price;
      const originPrice = price * quantity;
      let discountAmount = 0;
      let calculatedFinalPrice = originPrice;

      // ✅ 쿠폰 검증 및 할인 계산
      if (dto.couponId) {
        const coupon = await tx.coupon.findUnique({
          where: { id: dto.couponId },
        });
        if (!coupon) {
          throw new BadRequestException('존재하지 않는 쿠폰입니다.');
        }

        // ✅ 사용 가능한 userCoupon 여부 확인 (미사용 + 유효기간 내)
        const now = new Date();
        const userCoupon = await tx.userCoupon.findFirst({
          where: {
            userId,
            couponId: dto.couponId,
            usedAt: null,
            OR: [
              { expiresAt: null }, // expiresAt이 없으면 항상 유효
              { expiresAt: { gte: now } }, // expiresAt이 미래면 유효
            ],
          },
        });
        if (!userCoupon) {
          throw new BadRequestException('사용 가능한 쿠폰이 없습니다.');
        }

        if (coupon.discountType === 'FIXED') {
          discountAmount = coupon.discountValue;
          calculatedFinalPrice = originPrice - discountAmount;
        } else if (coupon.discountType === 'PERCENT') {
          discountAmount = Math.floor(
            originPrice * (coupon.discountValue / 100),
          );
          calculatedFinalPrice = originPrice - discountAmount;
        }
      }

      // 🚨 클라이언트가 보낸 finalPrice와 서버 계산값 비교
      if (dto.finalPrice !== calculatedFinalPrice) {
        throw new BadRequestException('잘못된 결제 금액 요청입니다.');
      }

      // ✅ 학생 포인트 차감
      const usePoints = calculatedFinalPrice;
      if (user.point < usePoints) {
        throw new BadRequestException({
          canPay: false,
          error: {
            code: 'INSUFFICIENT_POINTS',
            message: '보유 포인트가 부족하여 결제를 진행할 수 없습니다.',
          },
          finalPrice: calculatedFinalPrice,
          userPoints: user.point,
        });
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: { point: { decrement: usePoints } },
      });

      // ✅ 수강 등록 (결제 상세 필드 포함)
      const enrollment = await tx.enrollment.create({
        data: {
          userId,
          scheduleId: dto.scheduleId,
          status: 'ACCEPTED',
          originPrice,
          discountAmount,
          finalPrice: calculatedFinalPrice,
          quantity,
        },
      });

      // ✅ 결제 트랜잭션 생성 (Enrollment와 연결)
      const transaction = await tx.pointTransaction.create({
        data: {
          userId,
          enrollmentId: enrollment.id, // ✅ Enrollment와 연결
          amount: usePoints,
          couponId: dto.couponId ?? null,
          type: 'USE',
          status: 'COMPLETED',
        },
      });

      // ✅ userCoupon 상태 변경 (isUsed 및 usedAt 기록)
      if (dto.couponId) {
        await tx.userCoupon.updateMany({
          where: { userId, couponId: dto.couponId, usedAt: null },
          data: { usedAt: new Date(), isUsed: true },
        });
      }

      // ✅ currentParticipants 증가
      await tx.lessonSchedule.update({
        where: { id: dto.scheduleId },
        data: { currentParticipants: { increment: 1 } },
      });

      // ✅ 선생님 포인트 적립
      const teacherId = schedule.lesson.userId;
      const updatedTeacher = await tx.user.update({
        where: { id: teacherId },
        data: { point: { increment: usePoints } },
      });

      // ✅ 선생님 포인트 적립 트랜잭션 기록 (teacher가 이력을 볼 수 있도록)
      await tx.pointTransaction.create({
        data: {
          userId: teacherId,
          enrollmentId: enrollment.id,
          amount: usePoints,
          couponId: null,
          type: 'EARN',
          status: 'COMPLETED',
        },
      });

      // ✅ 성공 응답
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
        remainingPoints: updatedUser.point,
        teacherBalance: updatedTeacher.point,
      };
    });

    // ✅ 트랜잭션 성공 후 강사에게 알림 발송 (비동기)
    const schedule = await this.prisma.lessonSchedule.findUnique({
      where: { id: dto.scheduleId },
      include: { lesson: { select: { title: true, userId: true } } },
    });

    if (schedule) {
      await this.notificationsService.createNotification({
        receiverId: schedule.lesson.userId,
        senderId: userId,
        type: 'PARTICIPATION_REQUEST', // 수강 신청 알림 타입
        lessonId: schedule.lessonId,
      });
    }

    return result;
  }

  async getMyEnrollments(userId: number, dto: EnrollmentPageOptionsDto) {
    const { page = 1, limit = 10, filter } = dto;
    const skip = (page - 1) * limit;
    const now = new Date();

    const where: Prisma.EnrollmentWhereInput = { userId };

    // ✅ 필터 조건 처리
    if (filter && filter !== '전체') {
      if (filter === '수강취소') {
        where.status = 'CANCELED';
      } else if (filter === '수강예정') {
        where.status = 'ACCEPTED';
        where.schedule = { startAt: { gt: now } };
      } else if (filter === '수강완료') {
        where.status = 'ACCEPTED';
        where.schedule = { startAt: { lte: now } };
      }
    }

    // ✅ Enrollment + transactions 조회
    const [totalCount, enrollments] = await Promise.all([
      this.prisma.enrollment.count({ where }),
      this.prisma.enrollment.findMany({
        where,
        skip,
        take: limit,
        include: {
          schedule: { include: { lesson: true } },
          transactions: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // ✅ 해당 수강에 대한 review ID 조회 (한 번에)
    const enrollmentIds = enrollments.map((e) => e.id);
    const reviews = await this.prisma.review.findMany({
      where: {
        userId,
        enrollmentId: { in: enrollmentIds },
      },
      select: {
        id: true,
        enrollmentId: true,
      },
    });

    // enrollmentId별로 reviewId를 매핑 (한 명의 유저는 레슨당 하나의 리뷰만 작성 가능)
    const reviewIdMap = new Map<number, number>();
    reviews.forEach((r) => {
      reviewIdMap.set(r.enrollmentId, r.id);
    });

    // ✅ 타입 보강
    const typedEnrollments = enrollments as EnrollmentWithTransactions[];

    const mappedData = typedEnrollments.map((e) => {
      const useTx: PointTransaction | undefined = (e.transactions ?? []).find(
        (t: PointTransaction) => t.type === 'USE',
      );
      const refundTx: PointTransaction | undefined = (
        e.transactions ?? []
      ).find((t: PointTransaction) => t.type === 'REFUND');

      const review = reviewIdMap.get(e.id);

      const status = this.mapStatus(e, now);

      //       // ✅ 수강 완료 상태이면 재수강 쿠폰 발급 시도 (비동기)
      //       if (status === '수강완료') {
      //         this.couponsService.issueRetakeCoupon(userId).catch((err) => {
      //           console.error(`재수강 쿠폰 발급 실패 (userId: ${userId}):`, err);
      //         });
      //       }

      return {
        enrollmentId: e.id,
        scheduleId: e.schedule.id,
        image: e.schedule.lesson.representativeImage,
        title: e.schedule.lesson.title,
        startAt: e.schedule.startAt.toISOString(),
        endAt: e.schedule.endAt.toISOString(),
        status,
        transactionStatus: refundTx ? 'REFUNDED' : (useTx?.status ?? 'UNKNOWN'),
        transactionId: useTx?.id ?? null,
        refundTransactionId: refundTx?.id ?? null,
        reviewId: review ?? null,
      };
    });

    return {
      meta: {
        totalCount,
        page,
        limit,
        totalPages: Math.ceil(totalCount / limit),
      },
      data: mappedData,
    };
  }

  private mapStatus(enrollment: EnrollmentWithRelations, now: Date) {
    if (enrollment.status === ParticipationStatus.CANCELED) {
      return '수강취소';
    }
    if (enrollment.status === ParticipationStatus.ACCEPTED) {
      if (enrollment.schedule.startAt > now) {
        return '수강예정';
      }
      if (enrollment.schedule.startAt <= now) {
        return '수강완료';
      }
    }
    return '전체';
  }

  async cancelEnrollment(
    enrollmentId: number,
    userId: number,
    reason?: string,
    detailReason?: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const enrollment = await tx.enrollment.findUnique({
        where: { id: enrollmentId },
        include: {
          transactions: { include: { coupon: true } },
          schedule: { include: { lesson: true } },
        },
      });

      if (!enrollment || enrollment.userId !== userId) {
        throw new BadRequestException('잘못된 요청입니다.');
      }

      // ✅ 이미 취소된 enrollment 확인
      if (enrollment.status === ParticipationStatus.CANCELED) {
        throw new BadRequestException('이미 취소된 수강입니다.');
      }

      const now = new Date();
      const refundRate = calculateRefundRate(enrollment.schedule.startAt, now);

      // find the original payment transaction (USE)
      const useTx = (enrollment.transactions ?? []).find(
        (t) => t.type === 'USE',
      );

      if (refundRate === 0) {
        throw new BadRequestException('환불 불가 기간입니다.');
      }

      // ✅ 환불 금액 계산
      const refundAmount = Math.floor(enrollment.finalPrice * refundRate);

      // ✅ 환불 트랜잭션 (학생 포인트 복원)
      const refundTransaction = await tx.pointTransaction.create({
        data: {
          userId,
          enrollmentId: enrollmentId,
          amount: refundAmount,
          couponId: useTx?.couponId ?? null,
          type: 'REFUND',
          status: 'COMPLETED',
          reason: reason ?? '수강 취소 환불',
          detailReason: `환불율 ${refundRate * 100}% 적용`,
        },
      });

      // ✅ Enrollment 상태 변경
      await tx.enrollment.update({
        where: { id: enrollmentId },
        data: { status: 'CANCELED' },
      });

      // ✅ 학생 포인트 복원
      await tx.user.update({
        where: { id: userId },
        data: { point: { increment: refundAmount } },
      });

      // ✅ 쿠폰 복원
      if (useTx?.couponId) {
        await tx.userCoupon.updateMany({
          where: {
            userId,
            couponId: useTx.couponId,
            usedAt: { not: null },
          },
          data: { usedAt: null, isUsed: false },
        });
      }

      // ✅ 선생님 포인트 차감
      const teacherId = enrollment.schedule.lesson.userId;
      await tx.user.update({
        where: { id: teacherId },
        data: { point: { decrement: refundAmount } },
      });

      // ✅ 선생님 포인트 차감 트랜잭션 기록
      await tx.pointTransaction.create({
        data: {
          userId: teacherId,
          amount: refundAmount,
          type: 'DEDUCT',
          status: 'COMPLETED',
          reason: '학생 환불로 인한 포인트 차감',
          detailReason: `${detailReason}\n\n환불율 ${refundRate * 100}% 적용`,
        },
      });

      return {
        enrollmentId,
        refundTransactionId: refundTransaction.id,
        refundAmount,
        refundRate,
        restoredCouponId: useTx?.couponId ?? null,
      };
    });
  }
  async getCancelInfo(enrollmentId: number, userId: number) {
    const enrollment = await this.prisma.enrollment.findUnique({
      where: { id: enrollmentId },
      include: {
        schedule: {
          include: {
            lesson: {
              include: {
                teacher: { include: { teacherProfile: true } }, // ✅ 강사 프로필 정보 포함
              },
            },
          },
        },
        transactions: { include: { coupon: true } }, // ✅ 쿠폰 정보 포함
      },
    });

    if (!enrollment || enrollment.userId !== userId) {
      throw new BadRequestException('잘못된 요청입니다.');
    }

    const { schedule, originPrice, discountAmount, finalPrice, quantity } =
      enrollment;
    const useTx = (enrollment.transactions ?? []).find((t) => t.type === 'USE');
    const now = new Date();

    // ✅ 환불 비율 계산
    const refundRate = calculateRefundRate(schedule.startAt, now);

    // ✅ 환불 금액 계산

    const refundFinalAmount = Math.floor(finalPrice * refundRate);
    const paidAmount = finalPrice;
    const deductedAmount = paidAmount - refundFinalAmount; // 환불규정에 따른 차감금액

    return {
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
        coupon: useTx?.coupon
          ? {
              id: useTx.coupon.id,
              name: useTx.coupon.description,
              discountType: useTx.coupon.discountType,
              discountValue: useTx.coupon.discountValue,
            }
          : null,
      },
      refundInfo: {
        deductedAmount,
        refundAmount: refundFinalAmount,
        paidAmount,
      },
    };
  }
}
function calculateRefundRate(startAt: Date, now: Date): number {
  const diffDays = Math.floor(
    (startAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays >= 4) return 1.0; // 100%
  if (diffDays === 3) return 0.7; // 70%
  if (diffDays === 2) return 0.5; // 50%
  return 0.0; // 하루 전 또는 당일 → 환불 불가
}
