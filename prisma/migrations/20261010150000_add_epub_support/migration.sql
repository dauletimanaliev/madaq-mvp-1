-- CreateEnum
CREATE TYPE "ContentFormat" AS ENUM ('TEXT', 'PDF', 'EPUB');

-- AlterTable
ALTER TABLE "books" ADD COLUMN "content_format" "ContentFormat" NOT NULL DEFAULT 'TEXT';
ALTER TABLE "books" ADD COLUMN "epub_storage_key" TEXT;
