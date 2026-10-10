import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/db/prisma";
import { EpubReaderShell } from "@/components/epub/EpubReaderShell";
import { getBookReaderUrl } from "@/lib/books/reader-url";

export const dynamic = "force-dynamic";

export default async function BookEpubPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const userId = await getCurrentUserId();
  const { bookId: rawBookId } = await params;
  const bookId = decodeURIComponent(rawBookId);

  const book = await prisma.book.findFirst({
    where: {
      OR: [{ id: bookId }, { id: rawBookId }],
    },
    select: {
      id: true,
      title: true,
      contentFormat: true,
      storageS3Key: true,
      epubStorageKey: true,
    },
  });

  if (!book) {
    notFound();
  }

  if (book.contentFormat !== "EPUB") {
    redirect(getBookReaderUrl(book));
  }

  const libraryEntry = await prisma.userLibrary.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId: book.id,
      },
    },
  });

  if (!libraryEntry) {
    notFound();
  }

  return <EpubReaderShell bookId={book.id} title={book.title} />;
}
