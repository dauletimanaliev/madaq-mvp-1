import { notFound, redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { prisma } from "@/lib/db/prisma";
import { EpubReaderShell } from "@/components/epub/EpubReaderShell";
import { getBookReaderUrl } from "@/lib/books/reader-url";

export const dynamic = "force-dynamic";

export default async function BookEpubPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams?: Promise<{ w?: string; mobile?: string; theme?: string }>;
}) {
  const userId = await getCurrentUserId();
  const { bookId: rawBookId } = await params;
  const sp = searchParams ? await searchParams : {};
  const isMobile = process.env.NODE_ENV !== "production" && (sp.w === "390" || sp.mobile === "1");
  const initialTheme = (sp.theme === "paper" || sp.theme === "sepia" || sp.theme === "dark") ? sp.theme : undefined;
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

  return <EpubReaderShell bookId={book.id} title={book.title} isMobile={isMobile} initialTheme={initialTheme} />;
}
