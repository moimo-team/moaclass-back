/*
  Warnings:

  - You are about to drop the column `meeting_status` on the `meetings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "meetings" DROP COLUMN "meeting_status",
ADD COLUMN     "meeting_deleted" BOOLEAN NOT NULL DEFAULT false;
