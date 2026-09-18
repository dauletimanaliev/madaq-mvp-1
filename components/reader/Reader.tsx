"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Book, Chapter, Highlight } from "@/lib/types";
import { ReaderHeader } from "./ReaderHeader";
import { ReaderContent } from "./ReaderContent";
import { ReaderControls } from "./ReaderControls";
import { fetchChapterData, saveProgress } from "@/app/books/[bookId]/read/actions";
import { HighlightMenu, type SelectionRange } from "./HighlightMenu";
import type { ChapterMetric } from "@/server/chapters/queries";

export function Reader({
  book,
  initialChapter,
  chapterMetrics,
  initialPosition,
  initialHighlights,
}: {
  book: Book;
  initialChapter: Chapter;
  chapterMetrics: ChapterMetric[];
  initialPosition: number;
  initialHighlights: Highlight[];
}) {
  const [chapter, setChapter] = useState<Chapter>(initialChapter);
  const [highlights, setHighlights] = useState<Highlight[]>(initialHighlights);
  const [position, setPosition] = useState(initialPosition);
  const [contentInitialPos, setContentInitialPos] = useState(initialPosition);
  const [contentKey, setContentKey] = useState(
    () => `${initialChapter.id}:${initialPosition}`
  );
  const [isLoadingChapter, setIsLoadingChapter] = useState(false);

  const [pageState, setPageState] = useState({
    hasPreviousPage: false,
    hasNextPage: false,
  });
  const [selectedRange, setSelectedRange] = useState<SelectionRange | null>(null);
  const [highlightError, setHighlightError] = useState<string | null>(null);

  // In-memory chapter cache for instant 0ms switching
  const chapterCache = useRef<
    Map<number, { chapter: Chapter; highlights: Highlight[] }>
  >(
    new Map([
      [
        initialChapter.number,
        { chapter: initialChapter, highlights: initialHighlights },
      ],
    ])
  );

  const chapterIndex = chapterMetrics.findIndex(
    (item) => item.id === chapter.id
  );
  const previousChapter = chapterMetrics[chapterIndex - 1];
  const nextChapter = chapterMetrics[chapterIndex + 1];

  // Prefetch adjacent chapters (N-1, N+1) in the background
  const prefetchChapter = useCallback(
    async (chapterNum: number) => {
      if (chapterCache.current.has(chapterNum)) return;
      try {
        const data = await fetchChapterData(book.id, chapterNum);
        if (data) {
          chapterCache.current.set(chapterNum, data);
        }
      } catch (err) {
        console.error("Failed to prefetch chapter", chapterNum, err);
      }
    },
    [book.id]
  );

  useEffect(() => {
    const currentNum = chapter.number;
    const prevMetric = chapterMetrics.find((m) => m.number === currentNum - 1);
    const nextMetric = chapterMetrics.find((m) => m.number === currentNum + 1);

    if (prevMetric) prefetchChapter(prevMetric.number);
    if (nextMetric) prefetchChapter(nextMetric.number);
  }, [chapter.number, chapterMetrics, prefetchChapter]);

  // Reading progress calculation across entire book
  const progressPercent = useMemo(() => {
    const totalLength = chapterMetrics.reduce(
      (total, item) => total + item.contentLength,
      0
    );
    const completedLength = chapterMetrics
      .slice(0, chapterIndex >= 0 ? chapterIndex : 0)
      .reduce((total, item) => total + item.contentLength, 0);

    return totalLength === 0
      ? 0
      : ((completedLength + position) / totalLength) * 100;
  }, [chapterIndex, chapterMetrics, position]);

  // Debounced progress saving
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

  // Instant chapter switching
  const switchToChapter = useCallback(
    async (chapterNum: number, target: "start" | "end" = "start") => {
      const cached = chapterCache.current.get(chapterNum);
      if (cached) {
        const targetPos = target === "end" ? cached.chapter.content.length : 0;
        setChapter(cached.chapter);
        setHighlights(cached.highlights);
        setPosition(targetPos);
        setContentInitialPos(targetPos);
        setContentKey(`${cached.chapter.id}:${target}:${Date.now()}`);
        setSelectedRange(null);
        setHighlightError(null);

        const url = `/books/${book.id}/read?chapter=${chapterNum}${
          target === "end" ? "&at=end" : ""
        }`;
        window.history.replaceState(null, "", url);
        return;
      }

      setIsLoadingChapter(true);
      try {
        const data = await fetchChapterData(book.id, chapterNum);
        if (data) {
          chapterCache.current.set(chapterNum, data);
          const targetPos = target === "end" ? data.chapter.content.length : 0;
          setChapter(data.chapter);
          setHighlights(data.highlights);
          setPosition(targetPos);
          setContentInitialPos(targetPos);
          setContentKey(`${data.chapter.id}:${target}:${Date.now()}`);
          setSelectedRange(null);
          setHighlightError(null);

          const url = `/books/${book.id}/read?chapter=${chapterNum}${
            target === "end" ? "&at=end" : ""
          }`;
          window.history.replaceState(null, "", url);
        }
      } catch (err) {
        console.error("Failed to load chapter:", err);
      } finally {
        setIsLoadingChapter(false);
      }
    },
    [book.id]
  );

  // Handle browser back/forward buttons
  useEffect(() => {
    function handlePopState() {
      const searchParams = new URLSearchParams(window.location.search);
      const chParam = searchParams.get("chapter");
      const atParam = searchParams.get("at");
      const chNum = chParam ? Number(chParam) : 1;
      if (chNum && chNum !== chapter.number) {
        switchToChapter(chNum, atParam === "end" ? "end" : "start");
      }
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [chapter.number, switchToChapter]);

  const canGoPrevious = pageState.hasPreviousPage || Boolean(previousChapter);
  const canGoNext = pageState.hasNextPage || Boolean(nextChapter);
  const isLastPageOfChapter = !pageState.hasNextPage && Boolean(nextChapter);

  const handleNextChapter = useCallback(() => {
    if (nextChapter) {
      switchToChapter(nextChapter.number, "start");
    }
  }, [nextChapter, switchToChapter]);

  const handlePreviousChapter = useCallback(() => {
    if (previousChapter) {
      switchToChapter(previousChapter.number, "end");
    }
  }, [previousChapter, switchToChapter]);

  const goToPrevious = useCallback(() => {
    if (pageState.hasPreviousPage) {
      window.dispatchEvent(new Event("reader:previous-page"));
      return;
    }
    if (previousChapter) {
      handlePreviousChapter();
    }
  }, [handlePreviousChapter, pageState.hasPreviousPage, previousChapter]);

  const goToNext = useCallback(() => {
    if (pageState.hasNextPage) {
      window.dispatchEvent(new Event("reader:next-page"));
      return;
    }
    if (nextChapter) {
      handleNextChapter();
    }
  }, [handleNextChapter, nextChapter, pageState.hasNextPage]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        goToNext();
      } else if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        goToPrevious();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goToNext, goToPrevious]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-reader-bg text-reader-text overflow-hidden">
      {/* Top Loading Progress Line when fetching non-cached chapter */}
      {isLoadingChapter && (
        <div className="fixed top-0 inset-x-0 h-1 bg-amber-400 z-50 animate-pulse shadow-md" />
      )}

      <div className="mx-auto flex h-full max-w-2xl w-full flex-col px-3 md:px-6 pt-3 md:pt-6 pb-2 overflow-hidden">
        <ReaderHeader
          bookId={book.id}
          bookTitle={book.title}
          chapterTitle={chapter.title ?? `Глава ${chapter.number}`}
        />

        <ReaderContent
          key={contentKey}
          content={chapter.content}
          initialPosition={contentInitialPos}
          highlights={highlights}
          onPositionChange={setPosition}
          onPaginationChange={setPageState}
          onSelectionChange={setSelectedRange}
          onNextChapter={handleNextChapter}
          onPreviousChapter={handlePreviousChapter}
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
