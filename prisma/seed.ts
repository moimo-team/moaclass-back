import 'dotenv/config';
import process from 'node:process';
import { PrismaClient, DiscountType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const farFuture = new Date('2099-12-31T23:59:59Z');
    const now = new Date();

    const coupons = [
        {
            code: 'WELCOME_20PCT',
            description: '신규 가입 환영 20% 할인 쿠폰',
            discountType: DiscountType.PERCENT,
            discountValue: 20,
            maxUsage: 1000000,
            validFrom: now,
            validUntil: farFuture,
        },
        {
            code: 'REVIEW_10PCT',
            description: '이미지 리뷰 작성 보상 10% 할인 쿠폰',
            discountType: DiscountType.PERCENT,
            discountValue: 10,
            maxUsage: 1000000,
            validFrom: now,
            validUntil: farFuture,
        },
        {
            code: 'RETAKE_10PCT',
            description: '수강 완료 감사 재수강 10% 할인 쿠폰',
            discountType: DiscountType.PERCENT,
            discountValue: 10,
            maxUsage: 1000000,
            validFrom: now,
            validUntil: farFuture,
        },
    ];

    console.log('Seed data inserting...');

    for (const coupon of coupons) {
        await prisma.coupon.upsert({
            where: { code: coupon.code },
            update: {
                description: coupon.description,
                discountType: coupon.discountType,
                discountValue: coupon.discountValue,
                maxUsage: coupon.maxUsage,
                validFrom: coupon.validFrom,
                validUntil: coupon.validUntil,
            },
            create: coupon,
        });
    }

    console.log('Seed data inserted successfully!');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
