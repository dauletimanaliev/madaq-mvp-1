"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/db/prisma";
import { deleteBookFiles } from "@/lib/storage/delete-book-files";

/**
 * Removes a book from the user's library together with their notes,
 * bookmarks and progress for it. If nobody else has the book, the book
 * itself and its files are deleted too.
 */
export async function removeBookFromLibrary(
  bookId: string
): Promise<{ ok: true } | { ok: false; message: string }> {
  const userId = await getCurrentUserId();

  const entry = await prisma.userLibrary.findUnique({
    where: { userId_bookId: { userId, bookId } },
    select: { id: true },
  });
  if (!entry) return { ok: false, message: "Книга не найдена в вашей библиотеке." };

  const deletedBook = await prisma.$transaction(async (tx) => {
    await tx.highlight.deleteMany({ where: { userId, bookId } });
    await tx.bookmark.deleteMany({ where: { userId, bookId } });
    await tx.readingProgress.deleteMany({ where: { userId, bookId } });
    await tx.userLibrary.delete({ where: { id: entry.id } });

    const othersHaveIt = await tx.userLibrary.count({ where: { bookId } });
    if (othersHaveIt > 0) return null;

    // Last reader: remove the book and everything attached to it.
    const book = await tx.book.findUnique({
      where: { id: bookId },
      select: { authorId: true, storageS3Key: true, epubStorageKey: true, coverUrl: true },
    });
    if (!book) return null;
    await tx.highlight.deleteMany({ where: { bookId } });
    await tx.bookmark.deleteMany({ where: { bookId } });
    await tx.readingProgress.deleteMany({ where: { bookId } });
    await tx.bookPage.deleteMany({ where: { bookId } });
    await tx.chapter.deleteMany({ where: { bookId } });
    await tx.uploadJob.updateMany({ where: { bookId }, data: { bookId: null } });
    await tx.book.delete({ where: { id: bookId } });
    const authorBooks = await tx.book.count({ where: { authorId: book.authorId } });
    if (authorBooks === 0) await tx.author.delete({ where: { id: book.authorId } });
    return book;
  }, { timeout: 30000 });

  if (deletedBook) await deleteBookFiles(deletedBook);

  revalidatePath("/");
  return { ok: true };
}
