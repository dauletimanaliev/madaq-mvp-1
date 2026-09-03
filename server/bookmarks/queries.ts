import { prisma } from "@/lib/db/prisma";
import type { Bookmark } from "@/lib/types";

type BookmarkRecord = {
  id: string;
  bookId: string;
  chapterId: string;
  position: number;
  note: string | null;
  createdAt: Date;
  book: { title: string };
  chapter: { number: number };
};

function toBookmark(bookmark: BookmarkRecord): Bookmark {
  return {
    id: bookmark.id,
    bookId: bookmark.bookId,
    chapterId: bookmark.chapterId,
    chapterNumber: bookmark.chapter.number,
    bookTitle: bookmark.book.title,
    position: bookmark.position,
    note: bookmark.note,
    createdAt: bookmark.createdAt.toISOString(),
  };
}

export async function listBookmarks(userId: string): Promise<Bookmark[]> {
  const bookmarks = await prisma.bookmark.findMany({
    where: { userId },
    include: {
      book: { select: { title: true } },
      chapter: { select: { number: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return bookmarks.map(toBookmark);
}

export async function createBookmark(
  userId: string,
  input: Omit<Bookmark, "id" | "createdAt">
): Promise<Bookmark> {
  const chapter = await prisma.chapter.findFirst({
      where: {
        id: input.chapterId,
        bookId: input.bookId,
      },
      select: { id: true },
    });

    if (!chapter) {
      throw new Error("Chapter does not belong to the specified book.");
    }

  const bookmark = await prisma.bookmark.create({
    data: {
      userId,
      bookId: input.bookId,
      chapterId: input.chapterId,
      position: input.position,
      note: input.note,
    },
    include: {
      book: { select: { title: true } },
      chapter: { select: { number: true } },
    },
  });

  return toBookmark(bookmark);
}

export async function deleteBookmark(
  userId: string,
  bookmarkId: string
): Promise<boolean> {
  const result = await prisma.bookmark.deleteMany({
    where: {
      id: bookmarkId,
      userId,
    },
  });

  return result.count > 0;
}
