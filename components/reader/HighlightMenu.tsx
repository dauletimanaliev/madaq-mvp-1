"use client";

import { useEffect, useRef, useState } from "react";
import { addHighlight } from "@/app/books/[bookId]/read/actions";
import { highlightTypes } from "@/lib/highlights/types";
import type { Highlight, HighlightType } from "@/lib/types";

type SelectionRange = {
  startPosition: number;
  endPosition: number;
  rect: DOMRect;
};

export function HighlightMenu({
  bookId,
  chapterId,
  selection,
  onCreated,
  onFailed,
  onClose,
}: {
  bookId: string;
  chapterId: string;
  selection: SelectionRange | null;
  onCreated: (highlight: Highlight) => void;
  onFailed: (highlightId: string, message: string) => void;
  onClose: () => void;
}) {
  const [isMobile, setIsMobile] = useState(false);
  const optimisticId = useRef(0);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 640);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (!selection || selection.startPosition === selection.endPosition) {
    return null;
  }

  const selectedRange = selection;

  function create(type: HighlightType) {
    // Update local UI before the network request. The reader must not wait for
    // Supabase before it can close this menu or show the selected range.
    const tempHighlight: Highlight = {
      id: `temp-${++optimisticId.current}`,
      bookId,
      chapterId,
      startPosition: selectedRange.startPosition,
      endPosition: selectedRange.endPosition,
      type,
      legacyColor: null,
      createdAt: new Date().toISOString(),
    };

    onCreated(tempHighlight);

    void (async () => {
      try {
        await addHighlight({
          bookId,
          chapterId,
          startPosition: selectedRange.startPosition,
          endPosition: selectedRange.endPosition,
          type,
        });
      } catch {
        onFailed(tempHighlight.id, "Не удалось сохранить выделение.");
      }
    })();
  }

  const menuWidth = isMobile ? Math.min(window.innerWidth - 24, 420) : 660;
  const estimatedHeight = isMobile ? 188 : 62;
  const rawTop = selectedRange.rect.top - 48;
  const preferredTop = rawTop < 12 ? selectedRange.rect.bottom + 8 : rawTop;
  const top = Math.max(
    12,
    Math.min(preferredTop, window.innerHeight - estimatedHeight - 12)
  );
  const left = Math.max(
    12,
    Math.min(
      selectedRange.rect.left + selectedRange.rect.width / 2 - menuWidth / 2,
      (typeof window !== "undefined" ? window.innerWidth : 600) - menuWidth - 12
    )
  );

  return (
    <div
      role="dialog"
      aria-label="Тип заметки"
      className="fixed z-50 flex items-start gap-2 rounded-xl border border-reader-text/20 bg-paper/95 p-2 shadow-2xl backdrop-blur-md"
      style={{ top: `${top}px`, left: `${left}px`, width: `${menuWidth}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <div className={`grid flex-1 gap-1.5 ${isMobile ? "grid-cols-2" : "grid-cols-5"}`}>
        {highlightTypes.map(({ type, name, colorName, menuClassName }) => (
          <button
            key={type}
            type="button"
            aria-label={`${colorName}: ${name}`}
            title={`${colorName}: ${name}`}
            onClick={() => create(type)}
            className={`min-h-11 rounded-lg border border-ink/10 px-2 py-2 text-xs font-medium transition-colors active:scale-[0.98] ${menuClassName}`}
          >
            {name}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Закрыть меню выделения"
        onClick={onClose}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-ink-muted hover:bg-paper-soft hover:text-ink"
      >
        ×
      </button>
    </div>
  );
}
