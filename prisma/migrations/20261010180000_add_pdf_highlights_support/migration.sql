-- DropForeignKey
ALTER TABLE "highlights" DROP CONSTRAINT IF EXISTS "highlights_chapter_id_fkey";

-- AlterTable
ALTER TABLE "highlights" ADD COLUMN IF NOT EXISTS "page_number" INTEGER,
ADD COLUMN IF NOT EXISTS "rects" JSONB,
ADD COLUMN IF NOT EXISTS "selected_text" TEXT,
ALTER COLUMN "start_position" DROP NOT NULL,
ALTER COLUMN "start_position" SET DEFAULT 0,
ALTER COLUMN "end_position" DROP NOT NULL,
ALTER COLUMN "end_position" SET DEFAULT 0,
ALTER COLUMN "chapter_id" DROP NOT NULL;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "highlights_user_id_book_id_page_number_idx" ON "highlights"("user_id", "book_id", "page_number");

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE SET NULL ON UPDATE CASCADE;
