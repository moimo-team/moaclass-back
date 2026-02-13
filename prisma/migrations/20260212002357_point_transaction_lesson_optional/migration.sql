-- DropForeignKey
ALTER TABLE "point_transactions" DROP CONSTRAINT "point_transactions_lesson_id_fkey";

-- AlterTable
ALTER TABLE "point_transactions" ALTER COLUMN "lesson_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_lesson_id_fkey" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
