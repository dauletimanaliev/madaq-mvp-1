"use client";

import Link from "next/link";

export function ReaderHeader({
  bookId,
  bookTitle,
  chapterTitle,
}: {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-reader-text/10 pb-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-xs text-reader-muted truncate">{bookTitle}</p>
        <p className="font-serif text-base md:text-lg font-medium text-reader-text break-words">{chapterTitle}</p>
      </div>
      <div className="flex items-center justify-between sm:justify-end gap-x-4 text-xs md:text-sm text-reader-muted">
        <Link href="/notes/about" className="flex min-h-9 items-center hover:text-reader-text">
          Как работают заметки
        </Link>
        <Link href={`/books/${bookId}`} className="flex min-h-9 items-center hover:text-reader-text">
          Закрыть
        </Link>
      </div>
    </div>
  );
}
