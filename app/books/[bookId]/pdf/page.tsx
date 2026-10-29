import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getBookById } from "@/server/books/queries";
import { PdfReader } from "@/components/reader/PdfReader";
import { preconnect } from "react-dom";
import { createSignedPdfUrl, getStorageOrigin } from "@/lib/storage/signed-pdf-url";

export const dynamic = "force-dynamic";

export default async function BookPdfPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { bookId: rawBookId } = await params;
  const { page: rawPage } = await searchParams;
  const bookId = decodeURIComponent(rawBookId);
  const book = await getBookById(bookId);
  const initialPage = rawPage ? parseInt(rawPage, 10) : undefined;

  if (!book) {
    notFound();
  }

  if (book.contentFormat === "EPUB" && !book.storageS3Key) {
    redirect(`/books/${book.id}/epub`);
  }

  const pdfUrl = book.storageS3Key
    ? `/api/books/${encodeURIComponent(book.id)}/pdf-stream`
    : null;

  if (!pdfUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-paper px-6 py-12 text-ink">
        <div className="max-w-md rounded-2xl border border-border bg-paper-soft p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-4 font-serif text-xl font-medium text-ink">
            Оригинальный PDF не найден
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            Эта книга была добавлена в текстовом формате или до включения
            сохранения PDF в облаке.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href={`/books/${book.id}/read`}
              className="rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-paper-soft transition hover:opacity-90"
            >
              Открыть в ридере текста
            </Link>
            <Link
              href={`/books/${book.id}`}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-ink transition hover:bg-border/60"
            >
              Вернуться к книге
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Open the connection to storage while the page's JS is still loading.
  preconnect(getStorageOrigin(), { crossOrigin: "anonymous" });

  // Sign on the server so the browser can start downloading right away,
  // instead of making an extra request after the page loads.
  const signedUrl = await createSignedPdfUrl(book.storageS3Key!);

  return (
    <PdfReader
      key={book.id}
      book={book}
      pdfUrl={signedUrl ?? pdfUrl}
      fallbackUrl={pdfUrl}
      initialPage={initialPage}
    />
  );
}
