/*
  Warnings:

  - You are about to drop the `teacher_profile_images` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "teacher_profile_images" DROP CONSTRAINT "teacher_profile_images_profile_id_fkey";

-- DropTable
DROP TABLE "teacher_profile_images";
