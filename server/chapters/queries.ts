import { prisma } from "@/lib/db/prisma";
import type { Chapter } from "@/lib/types";

export type ChapterMetric = {
  id: string;
  number: number;
  title: string | null;
  contentLength: number;
};

/**
 * Returns lightweight metadata for all chapters in a book.
 * Does NOT load chapter content — only id, number, title, and content length.
 */
export async function getChapterMetrics(
  bookId: string
): Promise<ChapterMetric[]> {
  const chapters = await prisma.chapter.findMany({
    where: { bookId },
    select: { id: true, number: true, title: true, content: true },
    orderBy: { number: "asc" },
  });

  return chapters.map((ch) => ({
    id: ch.id,
    number: ch.number,
    title: ch.title,
    contentLength: ch.content.length,
  }));
}

export async function getChaptersByBook(bookId: string): Promise<Chapter[]> {
  return prisma.chapter.findMany({
    where: { bookId },
    orderBy: { number: "asc" },
  });
}

export async function getChapterByNumber(
  bookId: string,
  number: number
): Promise<Chapter | null> {
  return prisma.chapter.findUnique({
    where: { bookId_number: { bookId, number } },
  });
}
