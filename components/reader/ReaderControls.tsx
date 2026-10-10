"use client";

import { BookmarkButton } from "./BookmarkButton";

export function ReaderControls({
  canGoPrevious,
  canGoNext,
  isLastPageOfChapter,
  onPrevious,
  onNext,
  progressPercent,
  bookId,
  bookTitle,
  chapterId,
  chapterNumber,
  position,
}: {
  canGoPrevious: boolean;
  canGoNext: boolean;
  isLastPageOfChapter?: boolean;
  onPrevious: () => void;
  onNext: () => void;
  progressPercent: number;
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterNumber: number;
  position: number;
}) {
  return (
    <div className="flex items-center justify-between gap-2 border-t border-border pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-xs md:text-sm text-ink-muted bg-paper shrink-0">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="hidden md:flex min-h-10 items-center gap-1 rounded-lg px-2.5 hover:text-ink hover:bg-border/60 active:scale-95 disabled:cursor-not-allowed disabled:opacity-0 transition-all font-medium"
      >
        ← Назад
      </button>

      <div className="flex items-center gap-2.5 mx-auto md:mx-0">
        <BookmarkButton
          bookId={bookId}
          bookTitle={bookTitle}
          chapterId={chapterId}
          chapterNumber={chapterNumber}
          position={position}
        />
        <span className="font-mono text-xs text-ink-muted">{Math.round(progressPercent)}%</span>
        {isLastPageOfChapter && (
          <span className="md:hidden text-[11px] text-accent font-medium ml-1">
            Свайп влево для след. главы →
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className={`hidden md:flex min-h-10 items-center gap-1 rounded-lg px-2.5 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-0 font-medium ${
          isLastPageOfChapter
            ? "bg-accent/15 text-accent border border-accent/40 font-bold shadow-xs hover:bg-accent/25"
            : "hover:text-ink hover:bg-border/60"
        }`}
      >
        {isLastPageOfChapter ? "След. глава →" : "Дальше →"}
      </button>
    </div>
  );
}
