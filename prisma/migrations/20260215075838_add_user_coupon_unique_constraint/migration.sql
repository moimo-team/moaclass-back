/*
  Warnings:

  - A unique constraint covering the columns `[user_id,coupon_id]` on the table `user_coupons` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "user_coupons" ADD COLUMN     "expires_at" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "user_coupons_user_id_coupon_id_key" ON "user_coupons"("user_id", "coupon_id");
