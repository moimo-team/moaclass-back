-- Add enrollment reference to reviews
ALTER TABLE "reviews"
  ADD COLUMN "enrollment_id" INTEGER;

-- Backfill using (user_id, lesson_id) -> enrollment mapping when available
UPDATE "reviews" r
SET "enrollment_id" = matched."id"
FROM (
  SELECT
    r2."id" AS review_id,
    e."id"
  FROM "reviews" r2
  JOIN "enrollments" e ON e."user_id" = r2."user_id"
  JOIN "lesson_schedules" ls ON ls."id" = e."schedule_id"
  WHERE ls."lesson_id" = r2."lesson_id"
  ORDER BY e."created_at" DESC
) AS matched
WHERE r."id" = matched.review_id
  AND r."enrollment_id" IS NULL;

-- Remove reviews that cannot be mapped to an enrollment
DELETE FROM "review_images" ri
USING "reviews" r
WHERE ri."review_id" = r."id"
  AND r."enrollment_id" IS NULL;

DELETE FROM "reviews"
WHERE "enrollment_id" IS NULL;

-- Enforce enrollment 1:1
ALTER TABLE "reviews"
  ALTER COLUMN "enrollment_id" SET NOT NULL;

CREATE UNIQUE INDEX "reviews_enrollment_id_key" ON "reviews"("enrollment_id");

ALTER TABLE "reviews"
  ADD CONSTRAINT "reviews_enrollment_id_fkey"
  FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
