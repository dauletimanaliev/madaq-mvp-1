"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Book, Chapter, Highlight } from "@/lib/types";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderContent } from "./ReaderContent";
import { ReaderControls } from "./ReaderControls";
import { saveProgress } from "@/app/books/[bookId]/read/actions";
import { HighlightMenu, type SelectionRange } from "./HighlightMenu";

export function Reader({
  book,
  chapter,
  chapterMetrics,
  initialPosition,
  initialHighlights,
}: {
  book: Book;
  chapter: Chapter;
  chapterMetrics: { id: string; number: number; contentLength: number }[];
  initialPosition: number;
  initialHighlights: Highlight[];
}) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [position, setPosition] = useState(initialPosition);
  const [pageState, setPageState] = useState({
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [highlights, setHighlights] = useState(initialHighlights);
  const [selectedRange, setSelectedRange] = useState<SelectionRange | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);

  const chapterIndex = chapterMetrics.findIndex((item) => item.id === chapter.id);
  const progressPercent = useMemo(() => {
    const totalLength = chapterMetrics.reduce(
      (total, item) => total + item.contentLength,
      0
    );
    const completedLength = chapterMetrics
      .slice(0, chapterIndex)
      .reduce((total, item) => total + item.contentLength, 0);

    return totalLength === 0
      ? 0
      : ((completedLength + position) / totalLength) * 100;
  }, [chapterIndex, chapterMetrics, position]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void saveProgress({
        bookId: book.id,
        chapterId: chapter.id,
        position,
        progressPercent,
      });
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [book.id, chapter.id, position, progressPercent]);

  const previousChapter = chapterMetrics[chapterIndex - 1];
  const nextChapter = chapterMetrics[chapterIndex + 1];

  useEffect(() => {
    if (previousChapter) {
      router.prefetch(`/books/${book.id}/read?chapter=${previousChapter.number}&at=end`);
    }
    if (nextChapter) {
      router.prefetch(`/books/${book.id}/read?chapter=${nextChapter.number}`);
    }
  }, [book.id, nextChapter, previousChapter, router]);

  const canGoPrevious = pageState.hasPreviousPage || Boolean(previousChapter);
  const canGoNext = pageState.hasNextPage || Boolean(nextChapter);
  const isLastPageOfChapter = !pageState.hasNextPage && Boolean(nextChapter);

  function goToPrevious() {
    if (pageState.hasPreviousPage) {
      window.dispatchEvent(new Event("reader:previous-page"));
      return;
    }

    if (previousChapter) {
      startTransition(() => {
        router.push(`/books/${book.id}/read?chapter=${previousChapter.number}&at=end`);
      });
    }
  }

  function goToNext() {
    if (pageState.hasNextPage) {
      window.dispatchEvent(new Event("reader:next-page"));
      return;
    }

    if (nextChapter) {
      startTransition(() => {
        router.push(`/books/${book.id}/read?chapter=${nextChapter.number}`);
      });
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-reader-bg text-reader-text overflow-hidden">
      {/* Top Loading Progress Line when changing chapters */}
      {isNavigating && (
        <div className="fixed top-0 inset-x-0 h-1 bg-amber-400 z-50 animate-pulse shadow-md" />
      )}

      <div className="mx-auto flex h-full max-w-2xl w-full flex-col px-3 md:px-6 pt-3 md:pt-6 pb-2 overflow-hidden">
        <ReaderHeader
          bookId={book.id}
          bookTitle={book.title}
          chapterTitle={chapter.title ?? `Глава ${chapter.number}`}
        />

        <ReaderContent
          content={chapter.content}
          initialPosition={initialPosition}
          highlights={highlights}
          onPositionChange={setPosition}
          onPaginationChange={setPageState}
          onSelectionChange={setSelectedRange}
        />

        <HighlightMenu
          bookId={book.id}
          chapterId={chapter.id}
          selection={selectedRange}
          onCreated={(newHighlight) => {
            setHighlights((current) => [
              ...current.filter(
                (item) =>
                  item.endPosition <= newHighlight.startPosition ||
                  item.startPosition >= newHighlight.endPosition
              ),
              newHighlight,
            ]);
            setHighlightError(null);
            setSelectedRange(null);
            window.getSelection()?.removeAllRanges();
          }}
          onUpdated={(updatedHighlight) => {
            setHighlights((current) =>
              current.map((item) =>
                item.id === updatedHighlight.id ? updatedHighlight : item
              )
            );
            setHighlightError(null);
            setSelectedRange(null);
            window.getSelection()?.removeAllRanges();
          }}
          onDeleted={(highlightId) => {
            setHighlights((current) =>
              current.filter((item) => item.id !== highlightId)
            );
            setHighlightError(null);
            setSelectedRange(null);
            window.getSelection()?.removeAllRanges();
          }}
          onFailed={(highlightId, message) => {
            setHighlights((current) =>
              current.filter((item) => item.id !== highlightId)
            );
            setHighlightError(message);
          }}
          onClose={() => setSelectedRange(null)}
        />

        {highlightError && (
          <p role="status" className="mt-1 text-xs text-red-300">
            {highlightError}
          </p>
        )}

        <ReaderControls
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          isLastPageOfChapter={isLastPageOfChapter}
          onPrevious={goToPrevious}
          onNext={goToNext}
          progressPercent={progressPercent}
          bookId={book.id}
          bookTitle={book.title}
          chapterId={chapter.id}
          chapterNumber={chapter.number}
          position={position}
        />
      </div>
    </div>
  );
}
