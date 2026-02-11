/*
  Warnings:

  - You are about to drop the column `duration_min` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `likeCount` on the `lessons` table. All the data in the column will be lost.
  - You are about to drop the column `teacher_id` on the `lessons` table. All the data in the column will be lost.
  - Added the required column `duration_sec` to the `lessons` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `lessons` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "lessons" DROP CONSTRAINT "lessons_teacher_id_fkey";

-- AlterTable
ALTER TABLE "lessons" DROP COLUMN "duration_min",
DROP COLUMN "likeCount",
DROP COLUMN "teacher_id",
ADD COLUMN     "duration_sec" INTEGER NOT NULL,
ADD COLUMN     "like_count" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "user_id" INTEGER NOT NULL;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
