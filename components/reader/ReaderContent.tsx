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

function getCaretRange(x: number, y: number): Range | null {
  if ("caretPositionFromPoint" in document) {
    const position = document.caretPositionFromPoint(x, y);
    if (position) {
      const range = document.createRange();
      range.setStart(position.offsetNode, position.offset);
      range.collapse(true);
      return range;
    }
  }

  return document.caretRangeFromPoint?.(x, y) ?? null;
}

const highlightNames = {
  protein: "madaq-highlight-protein",
  carbohydrate: "madaq-highlight-carbohydrate",
  fat: "madaq-highlight-fat",
  vitamin: "madaq-highlight-vitamin",
  fiber: "madaq-highlight-fiber",
};
const legacyPinkHighlightName = "madaq-highlight-legacy-pink";

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
  } | null) => void;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
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
    const marker = markerRef.current;
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
    const markerPage = marker
      ? Math.min(nextPageCount - 1, Math.floor(marker.offsetLeft / step))
      : 0;

    viewport.scrollLeft = markerPage * step;
    setPageIndex(markerPage);
    setPageCount(nextPageCount);
  }, [pageWidth]);

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
  }, [fontSize, position, pageWidth, updatePagination]);

  useLayoutEffect(() => {
    const flow = flowRef.current;
    const registry = (CSS as unknown as { highlights?: HighlightRegistry }).highlights;
    const HighlightConstructor = (
      window as Window & {
        Highlight?: new (...ranges: Range[]) => unknown;
      }
    ).Highlight;

    if (!flow || !registry || !HighlightConstructor) return;

    for (const name of Object.values(highlightNames)) {
      registry.delete(name);
    }
    registry.delete(legacyPinkHighlightName);

    for (const color of Object.keys(highlightNames) as (keyof typeof highlightNames)[]) {
      const ranges = highlights
        .filter((highlight) => highlight.type === color)
        .map((highlight) =>
          canonicalOffsetsToDomRange(flow, {
            startPosition: highlight.startPosition,
            endPosition: highlight.endPosition,
          })
        );

      if (ranges.length > 0) {
        registry.set(highlightNames[color], new HighlightConstructor(...ranges));
      }
    }

    const legacyPinkRanges = highlights
      .filter((highlight) => highlight.type === null && highlight.legacyColor === "pink")
      .map((highlight) =>
        canonicalOffsetsToDomRange(flow, {
          startPosition: highlight.startPosition,
          endPosition: highlight.endPosition,
        })
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
      viewport.scrollLeft = targetPage * (viewport.clientWidth + COLUMN_GAP);
      setPageIndex(targetPage);

      requestAnimationFrame(() => {
        const bounds = viewport.getBoundingClientRect();
        const range = getCaretRange(bounds.left + 12, bounds.top + 12);
        const flow = flowRef.current;
        let nextPosition: number | null = null;

        if (range && flow) {
          try {
            nextPosition = domRangeToCanonicalOffsets(range, flow).startPosition;
          } catch {
            nextPosition = null;
          }
        }

        if (nextPosition !== null) {
          setPosition(clampPosition(nextPosition, content.length));
        }
      });
    },
    [content.length, pageCount]
  );

  const captureSelection = useCallback(() => {
    const selection = window.getSelection();
    const flow = flowRef.current;
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed || !flow) {
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
      if (positions.startPosition === positions.endPosition) {
        onSelectionChange(null);
        return;
      }

      const rect = range.getClientRects()[0] ?? range.getBoundingClientRect();
      onSelectionChange({ ...positions, rect });
    } catch {
      onSelectionChange(null);
    }
  }, [onSelectionChange]);

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

  const markerParagraph = paragraphs.find(
    (paragraph) =>
      position >= paragraph.start &&
      position <= paragraph.start + paragraph.text.length
  ) ?? paragraphs.at(-1);
  const markerOffset = markerParagraph
    ? Math.min(
        clampPosition(position - markerParagraph.start, markerParagraph.text.length),
        Math.max(0, markerParagraph.text.length - 1)
      )
    : 0;

  return (
    <section className="py-6">
      <div className="mb-3 flex items-center justify-between text-sm text-reader-muted">
        <span>
          Страница {pageIndex + 1} из {pageCount}
        </span>
        <div className="flex items-center gap-2" aria-label="Размер текста">
          <button
            type="button"
            onClick={() => setFontSize((size) => Math.max(16, size - 1))}
            className="rounded border border-reader-text/20 px-2 py-1 hover:border-reader-text/40"
          >
            A−
          </button>
          <button
            type="button"
            onClick={() => setFontSize((size) => Math.min(24, size + 1))}
            className="rounded border border-reader-text/20 px-2 py-1 hover:border-reader-text/40"
          >
            A+
          </button>
        </div>
      </div>
      <div
        ref={viewportRef}
        className="h-[calc(100vh-22rem)] min-h-80 overflow-x-auto overflow-y-hidden"
        style={{ scrollbarWidth: "none" }}
      >
        <div
          ref={flowRef}
          onMouseUp={captureSelection}
          className="font-serif text-reader-text"
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
            <p key={paragraph.start} data-start={paragraph.start} className="mb-5">
              {paragraph === markerParagraph
                ? paragraph.text.slice(0, markerOffset)
                : paragraph.text}
              {paragraph === markerParagraph && (
                <span ref={markerRef} aria-hidden="true" className="inline-block w-0" />
              )}
              {paragraph === markerParagraph && paragraph.text.slice(markerOffset)}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}
