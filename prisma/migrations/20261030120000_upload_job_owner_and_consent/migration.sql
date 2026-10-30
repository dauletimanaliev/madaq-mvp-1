-- AlterTable: who uploaded the file and when they confirmed their right to upload it
ALTER TABLE "upload_jobs" ADD COLUMN IF NOT EXISTS "user_id" TEXT,
ADD COLUMN IF NOT EXISTS "rights_confirmed_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "upload_jobs_user_id_idx" ON "upload_jobs"("user_id");
