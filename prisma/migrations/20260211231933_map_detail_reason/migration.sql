/*
  Warnings:

  - You are about to drop the column `detailReason` on the `point_transactions` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "point_transactions" DROP COLUMN "detailReason",
ADD COLUMN     "detail_reason" TEXT;
