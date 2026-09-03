import { prisma } from "@/lib/db/prisma";
import type { ReadingProgress } from "@/lib/types";

export async function getProgress(
  userId: string,
  bookId: string
): Promise<ReadingProgress | null> {
  return prisma.readingProgress.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: {
      bookId: true,
      chapterId: true,
      position: true,
      progressPercent: true,
    },
  });
}

export async function upsertProgress(
  userId: string,
  progress: ReadingProgress
): Promise<ReadingProgress> {
  const chapter = await prisma.chapter.findFirst({
    where: {
      id: progress.chapterId,
      bookId: progress.bookId,
    },
    select: { id: true },
  });

  if (!chapter) {
    throw new Error("Chapter does not belong to the specified book.");
  }

  return prisma.readingProgress.upsert({
    where: {
      userId_bookId: {
        userId,
        bookId: progress.bookId,
      },
    },
    update: {
      chapterId: progress.chapterId,
      position: progress.position,
      progressPercent: progress.progressPercent,
    },
    create: {
      userId,
      bookId: progress.bookId,
      chapterId: progress.chapterId,
      position: progress.position,
      progressPercent: progress.progressPercent,
    },
    select: {
      bookId: true,
      chapterId: true,
      position: true,
      progressPercent: true,
    },
  });
}
