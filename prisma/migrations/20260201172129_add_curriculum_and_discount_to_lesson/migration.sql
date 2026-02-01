-- AlterTable
ALTER TABLE "lessons" ADD COLUMN     "discount_rate" INTEGER DEFAULT 0,
ADD COLUMN     "discounted_price" INTEGER,
ALTER COLUMN "price" DROP NOT NULL;
