/*
  Warnings:

  - Added the required column `curriculum` to the `lessons` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "curriculum" TEXT NOT NULL;
