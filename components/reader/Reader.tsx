"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Book, Chapter, Highlight } from "@/lib/types";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderContent } from "./ReaderContent";
import { ReaderControls } from "./ReaderControls";
import { BookmarkButton } from "./BookmarkButton";
import { saveProgress } from "@/app/books/[bookId]/read/actions";
import { HighlightMenu } from "./HighlightMenu";

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
  const [position, setPosition] = useState(initialPosition);
  const [pageState, setPageState] = useState({
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [highlights, setHighlights] = useState(initialHighlights);
  const [selectedRange, setSelectedRange] = useState<{
    startPosition: number;
    endPosition: number;
    rect: DOMRect;
  } | null>(null);

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
  const canGoPrevious = pageState.hasPreviousPage || Boolean(previousChapter);
  const canGoNext = pageState.hasNextPage || Boolean(nextChapter);

  function goToPrevious() {
    if (pageState.hasPreviousPage) {
      window.dispatchEvent(new Event("reader:previous-page"));
      return;
    }

    if (previousChapter) {
      router.push(`/books/${book.id}/read?chapter=${previousChapter.number}&at=end`);
    }
  }

  function goToNext() {
    if (pageState.hasNextPage) {
      window.dispatchEvent(new Event("reader:next-page"));
      return;
    }

    if (nextChapter) {
      router.push(`/books/${book.id}/read?chapter=${nextChapter.number}`);
    }
  }

  return (
    <div className="min-h-[100dvh] md:min-h-[calc(100vh-73px)] bg-reader-bg">
      <div className="mx-auto flex max-w-2xl flex-col px-4 py-4 md:px-6 md:py-10">
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
          onCreated={(highlight) => {
            setHighlights((current) => [...current, highlight]);
            setSelectedRange(null);
            window.getSelection()?.removeAllRanges();
          }}
          onClose={() => setSelectedRange(null)}
        />
        <div className="flex items-center justify-between pb-6">
          <BookmarkButton
            bookId={book.id}
            bookTitle={book.title}
            chapterId={chapter.id}
            chapterNumber={chapter.number}
            position={position}
          />
        </div>
        <ReaderControls
          canGoPrevious={canGoPrevious}
          canGoNext={canGoNext}
          onPrevious={goToPrevious}
          onNext={goToNext}
          progressPercent={progressPercent}
        />
      </div>
    </div>
  );
}
