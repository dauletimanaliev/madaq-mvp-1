import Image from "next/image";
import Link from "next/link";
import type { Book } from "@/lib/types";
import { ReadingProgressLine } from "@/components/book/ReadingProgressLine";

export function BookCard({ book }: { book: Book }) {
  return (
    <Link
      href={`/books/${book.id}`}
      className="group grid grid-cols-[96px_1fr] gap-6 rounded-sm border border-border bg-paper-soft p-6 transition-colors hover:border-accent"
    >
      {book.coverUrl ? (
        <Image
          src={book.coverUrl}
          alt={`Обложка книги «${book.title}»`}
          width={96}
          height={144}
          unoptimized
          className="h-36 w-24 rounded-sm object-cover"
        />
      ) : (
        <div className="h-36 w-24 rounded-sm bg-ink/10 bg-gradient-to-br from-ink/20 to-ink/5" />
      )}
      <div className="flex min-w-0 flex-col justify-center gap-2">
        <p className="text-sm text-ink-muted">{book.author.name}</p>
        <h2 className="font-serif text-2xl leading-snug [overflow-wrap:anywhere]">{book.title}</h2>
        {book.description && (
          <p className="max-w-md text-sm text-ink-muted">{book.description}</p>
        )}
        <ReadingProgressLine book={book} />
        <div className="mt-2 flex items-center gap-2">
          <span className="text-sm font-medium text-accent group-hover:underline">
            Открыть
          </span>
          {book.contentFormat === "EPUB" && (
            <span className="rounded bg-accent/10 px-1.5 py-0.5 text-[10px] font-semibold text-accent">
              EPUB
            </span>
          )}
          {book.contentFormat === "PDF" && (
            <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              PDF
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
