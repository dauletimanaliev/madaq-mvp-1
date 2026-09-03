-- CreateEnum
CREATE TYPE "HighlightColor" AS ENUM ('yellow', 'green', 'blue', 'pink');

-- CreateTable
CREATE TABLE "highlights" (
    "id" TEXT NOT NULL,
    "start_position" INTEGER NOT NULL,
    "end_position" INTEGER NOT NULL,
    "color" "HighlightColor" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "book_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,

    CONSTRAINT "highlights_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "highlights_user_id_chapter_id_idx" ON "highlights"("user_id", "chapter_id");

-- CreateIndex
CREATE INDEX "highlights_book_id_idx" ON "highlights"("book_id");

-- CreateIndex
CREATE UNIQUE INDEX "highlights_user_id_chapter_id_start_position_end_position_key" ON "highlights"("user_id", "chapter_id", "start_position", "end_position");

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "highlights" ADD CONSTRAINT "highlights_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
