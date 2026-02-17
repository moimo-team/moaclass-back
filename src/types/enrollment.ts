import { Prisma } from '@prisma/client';

export type EnrollmentWithTransactions = Prisma.EnrollmentGetPayload<{
  include: {
    schedule: { include: { lesson: true } };
    transactions: true;
  };
}>;
