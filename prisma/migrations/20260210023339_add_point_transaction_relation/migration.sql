/*
  Warnings:

  - You are about to drop the column `discount_type` on the `coupons` table. All the data in the column will be lost.
  - You are about to drop the column `payment_id` on the `enrollments` table. All the data in the column will be lost.
  - You are about to drop the column `likes` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `payment_id` on the `point_transactions` table. All the data in the column will be lost.
  - You are about to drop the `payments` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `discountType` to the `coupons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `point_transactions` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `lesson_id` to the `point_transactions` table without a default value. This is not possible if the table is not empty.
  - Added the required column `status` to the `point_transactions` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `type` on the `point_transactions` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "PointType" AS ENUM ('CHARGE', 'USE', 'REFUND');

-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('FIXED', 'PERCENT');

-- DropForeignKey
ALTER TABLE "enrollments" DROP CONSTRAINT "enrollments_payment_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_lesson_id_fkey";

-- DropForeignKey
ALTER TABLE "payments" DROP CONSTRAINT "payments_user_id_fkey";

-- DropForeignKey
ALTER TABLE "point_transactions" DROP CONSTRAINT "point_transactions_payment_id_fkey";

-- DropIndex
DROP INDEX "enrollments_payment_id_key";

-- AlterTable
ALTER TABLE "coupons" DROP COLUMN "discount_type",
ADD COLUMN     "discountType" "DiscountType" NOT NULL;

-- AlterTable
ALTER TABLE "enrollments" DROP COLUMN "payment_id",
ADD COLUMN     "point_transactions" INTEGER NOT NULL,
ALTER COLUMN "status" DROP DEFAULT;

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "likes",
ADD COLUMN     "likeCount" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "point_transactions" DROP COLUMN "payment_id",
ADD COLUMN     "lesson_id" INTEGER NOT NULL,
ADD COLUMN     "status" "TransactionStatus" NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
DROP COLUMN "type",
ADD COLUMN     "type" "PointType" NOT NULL;

-- DropTable
DROP TABLE "payments";

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_point_transactions_fkey" FOREIGN KEY ("point_transactions") REFERENCES "point_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
