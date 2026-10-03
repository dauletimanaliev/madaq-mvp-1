import Image from "next/image";
import Link from "next/link";
import type { Book } from "@/lib/types";

export function BookHero({
  book,
  chapterCount,
}: {
  book: Book;
  chapterCount: number;
}) {
  return (
    <div className="grid gap-10 sm:grid-cols-[160px_1fr]">
      {book.coverUrl ? (
        <Image
          src={book.coverUrl}
          alt={`Обложка книги «${book.title}»`}
          width={160}
          height={224}
          unoptimized
          className="h-56 w-40 rounded-sm object-cover"
          priority
        />
      ) : (
        <div className="h-56 w-40 rounded-sm bg-ink/10 bg-gradient-to-br from-ink/20 to-ink/5" />
      )}
      <div className="flex flex-col gap-4">
        <div>
          <p className="text-sm text-ink-muted">{book.author.name}</p>
          <h1 className="mt-1 font-serif text-4xl leading-tight">
            {book.title}
          </h1>
        </div>
        {book.description && (
          <p className="max-w-md text-ink-muted">{book.description}</p>
        )}
        <p className="text-sm text-ink-muted">
          {chapterCount} {chapterCount === 1 ? "глава" : "глав"}
          {book.totalPages ? ` · ${book.totalPages} стр.` : ""}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <Link
            href={`/books/${book.id}/read`}
            className="inline-flex w-fit items-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-paper-soft transition-opacity hover:opacity-90"
          >
            Читать
          </Link>
          {book.storageS3Key && (
            <Link
              href={`/books/${book.id}/pdf`}
              className="inline-flex w-fit items-center gap-1.5 rounded-sm border border-border bg-paper-soft px-4 py-2.5 text-sm font-medium text-ink transition-colors hover:border-accent hover:text-accent"
            >
              <svg
                className="h-4 w-4 text-accent"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
              PDF ридер
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
