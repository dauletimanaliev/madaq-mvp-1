import React from "react";
import Link from "next/link";

interface EpubTopBarProps {
  title: string;
  bookId: string;
  currentLabel?: string | null;
  onToggleToc: () => void;
  onPrev: () => void;
  onNext: () => void;
}

export function EpubTopBar({
  title,
  bookId,
  currentLabel,
  onToggleToc,
  onPrev,
  onNext,
}: EpubTopBarProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-paper-soft px-3 sm:px-5 select-none z-20">
      {/* Left: Table of contents button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onToggleToc}
          className="flex items-center gap-2 rounded-md px-2.5 py-1.5 text-xs sm:text-sm font-medium text-ink hover:bg-border/60 active:scale-95 transition-all"
          title="Открыть оглавление"
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
              d="M4 6h16M4 12h16M4 18h7"
            />
          </svg>
          <span className="hidden sm:inline">Оглавление</span>
        </button>
      </div>

      {/* Center: Title & Current Section */}
      <div className="flex flex-col items-center justify-center max-w-[45%] sm:max-w-[55%] px-2 text-center truncate">
        <h1 className="w-full truncate font-serif text-sm sm:text-base font-medium text-ink">
          {title}
        </h1>
        {currentLabel && (
          <span className="w-full truncate text-[11px] text-ink-muted">
            {currentLabel}
          </span>
        )}
      </div>

      {/* Right: Prev, Next & Close (Back to book) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onPrev}
            className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 active:scale-95 transition-all"
            title="Предыдущая страница (←)"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded-md p-1.5 text-ink-muted hover:text-ink hover:bg-border/60 active:scale-95 transition-all"
            title="Следующая страница (→)"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="h-4 w-px bg-border mx-0.5" />

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
