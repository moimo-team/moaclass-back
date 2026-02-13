/*
  Warnings:

  - The values [PARTICIPATION_CANCELLED,PAYMENT_CANCELLED,LESSON_CANCELLED] on the enum `NotificationType` will be removed. If these variants are still used in the database, this will fail.
  - The values [CANCELLED] on the enum `TransactionStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "NotificationType_new" AS ENUM ('PARTICIPATION_REQUEST', 'PARTICIPATION_ACCEPTED', 'PARTICIPATION_REJECTED', 'PARTICIPATION_CANCELED', 'MEETING_DELETED', 'COMMENT_ON_LESSON', 'REPLY_ON_COMMENT', 'PAYMENT_SUCCESS', 'PAYMENT_CANCELED', 'LESSON_CANCELED', 'REMINDER_24H', 'REMINDER_1H', 'REVIEW_REQUEST', 'NEW_CHAT');
ALTER TABLE "notifications" ALTER COLUMN "type" TYPE "NotificationType_new" USING ("type"::text::"NotificationType_new");
ALTER TYPE "NotificationType" RENAME TO "NotificationType_old";
ALTER TYPE "NotificationType_new" RENAME TO "NotificationType";
DROP TYPE "public"."NotificationType_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "TransactionStatus_new" AS ENUM ('PENDING', 'COMPLETED', 'CANCELED', 'FAILED');
ALTER TABLE "point_transactions" ALTER COLUMN "status" TYPE "TransactionStatus_new" USING ("status"::text::"TransactionStatus_new");
ALTER TYPE "TransactionStatus" RENAME TO "TransactionStatus_old";
ALTER TYPE "TransactionStatus_new" RENAME TO "TransactionStatus";
DROP TYPE "public"."TransactionStatus_old";
COMMIT;
