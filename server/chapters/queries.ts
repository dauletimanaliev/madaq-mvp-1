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
  const decoded = decodeURIComponent(bookId);
  const chapters = await prisma.chapter.findMany({
    where: {
      OR: [{ bookId }, { bookId: decoded }],
    },
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
  const decoded = decodeURIComponent(bookId);
  return prisma.chapter.findMany({
    where: {
      OR: [{ bookId }, { bookId: decoded }],
    },
    orderBy: { number: "asc" },
  });
}

export async function getChapterByNumber(
  bookId: string,
  number: number
): Promise<Chapter | null> {
  const decoded = decodeURIComponent(bookId);
  return prisma.chapter.findFirst({
    where: {
      OR: [
        { bookId, number },
        { bookId: decoded, number },
      ],
    },
  });
}
