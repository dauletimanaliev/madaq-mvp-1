"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  canonicalOffsetsToDomRange,
  domRangeToCanonicalOffsets,
  getCanonicalTextNodePositions,
} from "@/lib/highlights/positions";
import type { Highlight } from "@/lib/types";

const COLUMN_GAP = 32;

type Paragraph = {
  start: number;
  text: string;
};

function clampPosition(position: number, contentLength: number) {
  return Math.max(0, Math.min(position, contentLength));
}

function getParagraphs(content: string): Paragraph[] {
  let start = 0;

  return content.split("\n\n").map((text) => {
    const paragraph = { start, text };
    start += text.length + 2;
    return paragraph;
  });
}


const highlightNames = {
  protein: "madaq-highlight-protein",
  carbohydrate: "madaq-highlight-carbohydrate",
  fat: "madaq-highlight-fat",
  vitamin: "madaq-highlight-vitamin",
  fiber: "madaq-highlight-fiber",
};
const legacyPinkHighlightName = "madaq-highlight-legacy-pink";
const highlightStyleId = "madaq-highlight-styles";

// Turbopack/PostCSS does not currently parse CSS Custom Highlight selectors.
// Install these browser-only rules after feature detection so unsupported
// browsers simply render the reader without highlights instead of failing a build.
function ensureHighlightStyles() {
  if (document.getElementById(highlightStyleId)) return;

  const styles = document.createElement("style");
  styles.id = highlightStyleId;
  styles.textContent = `
    ::highlight(madaq-highlight-protein) { background-color: rgb(252 165 165 / 0.48); }
    ::highlight(madaq-highlight-carbohydrate) { background-color: rgb(253 186 116 / 0.48); }
    ::highlight(madaq-highlight-fat) { background-color: rgb(253 230 138 / 0.52); }
    ::highlight(madaq-highlight-vitamin) { background-color: rgb(167 243 208 / 0.46); }
    ::highlight(madaq-highlight-fiber) { background-color: rgb(186 230 253 / 0.48); }
    ::highlight(madaq-highlight-legacy-pink) { background-color: rgb(251 207 232 / 0.5); }
  `;
  document.head.append(styles);
}

type HighlightRegistry = {
  set(name: string, highlight: unknown): void;
  delete(name: string): void;
};

export function ReaderContent({
  content,
  initialPosition,
  highlights,
  onPositionChange,
  onPaginationChange,
  onSelectionChange,
  onNextChapter,
  onPreviousChapter,
}: {
  content: string;
  initialPosition: number;
  highlights: Highlight[];
  onPositionChange: (position: number) => void;
  onPaginationChange: (state: {
    hasPreviousPage: boolean;
    hasNextPage: boolean;
  }) => void;
  onSelectionChange: (selection: {
    startPosition: number;
    endPosition: number;
    rect: DOMRect;
    bottomRect?: DOMRect;
    existingHighlight?: Highlight | null;
  } | null) => void;
  onNextChapter?: () => void;
  onPreviousChapter?: () => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [pageWidth, setPageWidth] = useState(1);
  const [position, setPosition] = useState(() =>
    clampPosition(initialPosition, content.length)
  );
  const [fontSize, setFontSize] = useState(18);
  const paragraphs = useMemo(() => getParagraphs(content), [content]);

  const updatePagination = useCallback(() => {
    const viewport = viewportRef.current;
    const flow = flowRef.current;
    if (!viewport || !flow || viewport.clientWidth === 0) return;

    if (pageWidth !== viewport.clientWidth) {
      setPageWidth(viewport.clientWidth);
      return;
    }

    const step = viewport.clientWidth + COLUMN_GAP;
    const nextPageCount = Math.max(
      1,
      Math.round((flow.scrollWidth + COLUMN_GAP) / step)
    );

    // Maintain proportional page based on current reading position
    const ratio = content.length > 0 ? position / content.length : 0;
    const targetPage = Math.min(
      nextPageCount - 1,
      Math.round(ratio * (nextPageCount - 1))
    );

    viewport.scrollLeft = targetPage * step;
    setPageIndex(targetPage);
    setPageCount(nextPageCount);
  }, [content.length, pageWidth, position]);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const frame = requestAnimationFrame(updatePagination);
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(updatePagination);
    });

    observer.observe(viewport);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [fontSize, pageWidth, updatePagination]);

  useLayoutEffect(() => {
    const flow = flowRef.current;
    const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
    const HighlightConstructor = (
      window as Window & {
        Highlight?: new (...ranges: Range[]) => unknown;
      }
    ).Highlight;

    if (!flow || !registry || !HighlightConstructor) return;

    ensureHighlightStyles();

    for (const name of Object.values(highlightNames)) {
      registry.delete(name);
    }
    registry.delete(legacyPinkHighlightName);

    const cachedNodes = getCanonicalTextNodePositions(flow);

    for (const color of Object.keys(highlightNames) as (keyof typeof highlightNames)[]) {
      const ranges = highlights
        .filter((highlight) => highlight.type === color)
        .map((highlight) =>
          canonicalOffsetsToDomRange(
            flow,
            {
              startPosition: highlight.startPosition,
              endPosition: highlight.endPosition,
            },
            cachedNodes
          )
        );

      if (ranges.length > 0) {
        registry.set(highlightNames[color], new HighlightConstructor(...ranges));
      }
    }

    const legacyPinkRanges = highlights
      .filter((highlight) => highlight.type === null && highlight.legacyColor === "pink")
      .map((highlight) =>
        canonicalOffsetsToDomRange(
          flow,
          {
            startPosition: highlight.startPosition,
            endPosition: highlight.endPosition,
          },
          cachedNodes
        )
      );

    if (legacyPinkRanges.length > 0) {
      registry.set(
        legacyPinkHighlightName,
        new HighlightConstructor(...legacyPinkRanges)
      );
    }

    return () => {
      for (const name of Object.values(highlightNames)) {
        registry.delete(name);
      }
      registry.delete(legacyPinkHighlightName);
    };
  }, [content, highlights]);

  useEffect(() => {
    onPositionChange(position);
  }, [onPositionChange, position]);

  useEffect(() => {
    onPaginationChange({
      hasPreviousPage: pageIndex > 0,
      hasNextPage: pageIndex < pageCount - 1,
    });
  }, [onPaginationChange, pageCount, pageIndex]);

  const goToPage = useCallback(
    (nextPage: number) => {
      const viewport = viewportRef.current;
      if (!viewport) return;

      const targetPage = Math.max(0, Math.min(nextPage, pageCount - 1));
      const step = viewport.clientWidth + COLUMN_GAP;
      viewport.scrollTo({
        left: targetPage * step,
        behavior: "smooth",
      });
      setPageIndex(targetPage);

      const estimatedPosition =
        pageCount > 1
          ? Math.round((targetPage / (pageCount - 1)) * content.length)
          : 0;
      setPosition(clampPosition(estimatedPosition, content.length));
    },
    [content.length, pageCount]
  );

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const flow = flowRef.current;
    if (!selection || selection.rangeCount === 0 || !flow) {
      onSelectionChange(null);
      return;
    }

    const range = selection.getRangeAt(0);
    if (!flow.contains(range.startContainer) || !flow.contains(range.endContainer)) {
      onSelectionChange(null);
      return;
    }

    try {
      const positions = domRangeToCanonicalOffsets(range, flow);

      if (positions.startPosition !== positions.endPosition) {
        const rects = Array.from(range.getClientRects());
        // topRect = topmost rect (for positioning above on desktop)
        // bottomRect = bottommost rect (for positioning below on mobile so native menu stays free)
        const topRect = rects[0] ?? range.getBoundingClientRect();
        const bottomRect = rects[rects.length - 1] ?? range.getBoundingClientRect();
        const existingHighlight =
          highlights.find(
            (h) =>
              h.startPosition < positions.endPosition &&
              h.endPosition > positions.startPosition
          ) ?? null;

        onSelectionChange({
          ...positions,
          rect: topRect,
          bottomRect,
          existingHighlight,
        });
        return;
      }

      const caretPosition = positions.startPosition;
      const matchingHighlight = highlights.find(
        (h) => caretPosition >= h.startPosition && caretPosition < h.endPosition
      );

      if (matchingHighlight) {
        const highlightDomRange = canonicalOffsetsToDomRange(flow, {
          startPosition: matchingHighlight.startPosition,
          endPosition: matchingHighlight.endPosition,
        });
        const allRects = Array.from(highlightDomRange.getClientRects());
        const topRect = allRects[0] ?? highlightDomRange.getBoundingClientRect();
        const bottomRect = allRects[allRects.length - 1] ?? highlightDomRange.getBoundingClientRect();

        onSelectionChange({
          startPosition: matchingHighlight.startPosition,
          endPosition: matchingHighlight.endPosition,
          rect: topRect,
          bottomRect,
          existingHighlight: matchingHighlight,
        });
        return;
      }

      onSelectionChange(null);
    } catch {
      onSelectionChange(null);
    }
  }, [highlights, onSelectionChange]);

  useEffect(() => {
    const handleSelection = () => {
      requestAnimationFrame(captureSelection);
    };

    document.addEventListener("selectionchange", handleSelection);
    return () => {
      document.removeEventListener("selectionchange", handleSelection);
    };
  }, [captureSelection]);

  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      };
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    captureSelection();

    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start || e.changedTouches.length === 0) return;

    const selection = window.getSelection();
    if (selection && !selection.isCollapsed && selection.toString().trim().length > 0) return;

    const touch = e.changedTouches[0];
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    const duration = Date.now() - start.time;

    // Detect horizontal swipe gesture
    if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 1.2 && duration < 600) {
      if (dx < 0) {
        // Swipe left -> Next page or Next chapter
        if (pageIndex < pageCount - 1) {
          goToPage(pageIndex + 1);
        } else if (onNextChapter) {
          onNextChapter();
        }
      } else {
        // Swipe right -> Previous page or Previous chapter
        if (pageIndex > 0) {
          goToPage(pageIndex - 1);
        } else if (onPreviousChapter) {
          onPreviousChapter();
        }
      }
    }
  };

  useEffect(() => {
    const previous = () => goToPage(pageIndex - 1);
    const next = () => goToPage(pageIndex + 1);
    window.addEventListener("reader:previous-page", previous);
    window.addEventListener("reader:next-page", next);
    return () => {
      window.removeEventListener("reader:previous-page", previous);
      window.removeEventListener("reader:next-page", next);
    };
  }, [goToPage, pageIndex]);

  return (
    <section className="flex-1 flex flex-col min-h-0 py-1 md:py-3 select-text overflow-hidden">
      <div className="mb-2 flex items-center justify-between text-xs md:text-sm text-reader-muted shrink-0">
        <span>
          Страница {pageIndex + 1} из {pageCount}
        </span>
        <div className="flex items-center gap-1.5 md:gap-2" aria-label="Размер текста">
          <button
            type="button"
            onClick={() => setFontSize((size) => Math.max(14, size - 1))}
            className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg border border-reader-text/20 text-xs font-semibold hover:border-reader-text/40 active:scale-95 transition-colors"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setFontSize((size) => Math.min(24, size + 1))}
            className="flex h-8 w-8 md:h-9 md:w-9 items-center justify-center rounded-lg border border-reader-text/20 text-xs font-semibold hover:border-reader-text/40 active:scale-95 transition-colors"
          >
            A+
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseUp={captureSelection}
        onPointerUp={captureSelection}
        className="flex-1 h-full min-h-0 overflow-x-hidden overflow-y-hidden select-text touch-pan-y"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          ref={flowRef}
          className="font-serif text-reader-text select-text"
          style={{
            columnWidth: `${pageWidth}px`,
            columnGap: `${COLUMN_GAP}px`,
            columnFill: "auto",
            fontSize: `${fontSize}px`,
            lineHeight: 1.8,
            height: "100%",
          }}
        >
          {paragraphs.map((paragraph) => (
            <p key={paragraph.start} data-start={paragraph.start} className="mb-5 select-text">
              {paragraph.text}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
