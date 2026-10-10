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
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper-soft px-3 sm:px-5 select-none z-20">
      {/* Left: Notes info */}
      <div className="flex items-center gap-2">
        <Link
          href="/notes/about"
          className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium text-ink-muted hover:text-ink hover:bg-border/60 transition-all active:scale-95"
          title="Как работают заметки"
        >
          <svg
            className="h-4 w-4 text-ink-muted"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="hidden sm:inline">О заметках</span>
        </Link>
      </div>

      {/* Center: Book Title & Chapter */}
      <div className="flex flex-col items-center justify-center max-w-[45%] sm:max-w-[55%] px-2 text-center truncate">
        <h1 className="w-full truncate font-serif text-sm sm:text-base font-medium text-ink">
          {bookTitle}
        </h1>
        <span className="w-full truncate text-[11px] text-ink-muted">
          {chapterTitle}
        </span>
      </div>

      {/* Right: Return to Book */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <Link
          href={`/books/${bookId}`}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs sm:text-sm font-medium text-ink-muted hover:text-ink hover:bg-border/60 transition-colors"
          title="Вернуться к информации о книге"
        >
          <span className="hidden md:inline">К книге</span>
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
