/*
  Warnings:

  - Added the required column `discountAmount` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `finalPrice` to the `enrollments` table without a default value. This is not possible if the table is not empty.
  - Added the required column `originPrice` to the `enrollments` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "enrollments" ADD COLUMN     "discountAmount" INTEGER NOT NULL,
ADD COLUMN     "finalPrice" INTEGER NOT NULL,
ADD COLUMN     "originPrice" INTEGER NOT NULL,
ADD COLUMN     "quantity" INTEGER NOT NULL DEFAULT 1;
