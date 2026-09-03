import Image from "next/image";
import Link from "next/link";
import type { Book } from "@/lib/types";

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
          className="h-36 w-24 rounded-sm object-cover"
        />
      ) : (
        <div className="h-36 w-24 rounded-sm bg-ink/10 bg-gradient-to-br from-ink/20 to-ink/5" />
      )}
      <div className="flex flex-col justify-center gap-2">
        <p className="text-sm text-ink-muted">{book.author.name}</p>
        <h2 className="font-serif text-2xl leading-snug">{book.title}</h2>
        {book.description && (
          <p className="max-w-md text-sm text-ink-muted">{book.description}</p>
        )}
        <span className="mt-2 text-sm font-medium text-accent group-hover:underline">
          Открыть
        </span>
      </div>
    </Link>
  );
}
