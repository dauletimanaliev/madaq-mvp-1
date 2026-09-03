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
        </p>
        <Link
          href={`/books/${book.id}/read`}
          className="mt-2 inline-flex w-fit items-center rounded-sm bg-accent px-5 py-2.5 text-sm font-medium text-paper-soft transition-opacity hover:opacity-90"
        >
          Читать
        </Link>
      </div>
    </div>
  );
}
