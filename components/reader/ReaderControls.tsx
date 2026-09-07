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
    <div className="flex items-center justify-between gap-2 border-t border-reader-text/10 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] text-xs md:text-sm text-reader-muted bg-reader-bg shrink-0">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!canGoPrevious}
        className="flex min-h-10 items-center gap-1 rounded-lg px-2.5 hover:text-reader-text active:scale-95 disabled:cursor-not-allowed disabled:opacity-0 transition-all font-medium"
      >
        ← Назад
      </button>

      <div className="flex items-center gap-2.5">
        <BookmarkButton
          bookId={bookId}
          bookTitle={bookTitle}
          chapterId={chapterId}
          chapterNumber={chapterNumber}
          position={position}
        />
        <span className="font-mono text-xs text-reader-muted">{Math.round(progressPercent)}%</span>
      </div>

      <button
        type="button"
        onClick={onNext}
        disabled={!canGoNext}
        className={`flex min-h-10 items-center gap-1 rounded-lg px-2.5 transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-0 font-medium ${
          isLastPageOfChapter
            ? "bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold shadow-sm hover:bg-amber-500/30"
            : "hover:text-reader-text"
        }`}
      >
        {isLastPageOfChapter ? "След. глава →" : "Дальше →"}
      </button>
    </div>
  );
}
