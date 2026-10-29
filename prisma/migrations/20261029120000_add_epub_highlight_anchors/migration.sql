-- AlterTable: EPUB highlight anchors
ALTER TABLE "highlights" ADD COLUMN IF NOT EXISTS "cfi" TEXT,
ADD COLUMN IF NOT EXISTS "section_href" TEXT,
ADD COLUMN IF NOT EXISTS "section_index" INTEGER,
ADD COLUMN IF NOT EXISTS "text_quote_prefix" TEXT,
ADD COLUMN IF NOT EXISTS "text_quote_suffix" TEXT,
ADD COLUMN IF NOT EXISTS "note" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "highlights_user_id_book_id_cfi_key" ON "highlights"("user_id", "book_id", "cfi");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "highlights_user_id_book_id_section_index_idx" ON "highlights"("user_id", "book_id", "section_index");
