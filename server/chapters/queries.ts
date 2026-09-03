import { prisma } from "@/lib/db/prisma";
import type { Chapter } from "@/lib/types";

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
