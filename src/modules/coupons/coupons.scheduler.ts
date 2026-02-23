import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { CouponsService } from './coupons.service';
import { ParticipationStatus } from '@prisma/client';

@Injectable()
export class CouponsScheduler {
    private readonly logger = new Logger(CouponsScheduler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly couponsService: CouponsService,
    ) { }

    /**
     * 매일 자정(서울 시간)에 전일 수강이 종료된 학생들에게 재수강 쿠폰을 발급합니다.
     */
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT, {
        timeZone: 'Asia/Seoul',
    })
    async handleMidnightRetakeCouponJob() {
        this.logger.log('Started daily retake coupon issuance job');

        const now = new Date();
        const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        // 1. 전일 수업이 종료된 Enrollment 조회 (ACCEPTED 상태)
        const completedEnrollments = await this.prisma.enrollment.findMany({
            where: {
                status: ParticipationStatus.ACCEPTED,
                schedule: {
                    endAt: {
                        lt: now,
                        gte: twentyFourHoursAgo,
                    },
                },
            },
            select: {
                userId: true,
            },
        });

        if (completedEnrollments.length === 0) {
            this.logger.log('No students completed classes yesterday.');
            return;
        }

        // 2. 중복 유저 제거 (여러 수업을 들었을 수 있음)
        const uniqueUserIds = [...new Set(completedEnrollments.map((e) => e.userId))];
        this.logger.log(`Found ${uniqueUserIds.length} unique users to process.`);

        // 3. 각 유저에게 재수강 쿠폰 발급 시도
        let issuedCount = 0;
        for (const userId of uniqueUserIds) {
            try {
                const result = await this.couponsService.issueRetakeCoupon(userId);
                if (result) {
                    issuedCount++;
                }
            } catch (error) {
                this.logger.error(`Failed to issue retake coupon for userId ${userId}:`, error);
            }
        }

        this.logger.log(`Finished daily retake coupon issuance job. Issued: ${issuedCount}`);
    }
}
