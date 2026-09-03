"use client";

import { useEffect, useState, useTransition } from "react";
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
  onClose,
}: {
  bookId: string;
  chapterId: string;
  selection: SelectionRange | null;
  onCreated: (highlight: Highlight) => void;
  onClose: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isMobile, setIsMobile] = useState(false);

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
    // 1. Оптимистичное обновление: сразу передаём выделение и закрываем меню (0 мс задержки)
    const tempHighlight: Highlight = {
      id: `temp-${Date.now()}`,
      bookId,
      chapterId,
      startPosition: selectedRange.startPosition,
      endPosition: selectedRange.endPosition,
      type,
      legacyColor: null,
      createdAt: new Date().toISOString(),
    };

    onCreated(tempHighlight);

    // 2. Фоновое сохранение в базу данных
    startTransition(async () => {
      try {
        setError(null);
        await addHighlight({
          bookId,
          chapterId,
          startPosition: selectedRange.startPosition,
          endPosition: selectedRange.endPosition,
          type,
        });
      } catch {
        setError("Не удалось сохранить выделение.");
      }
    });
  }

  const menuWidth = 320;
  const rawTop = selectedRange.rect.top - 48;
  const top = rawTop < 10 ? selectedRange.rect.bottom + 8 : rawTop;
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
      aria-label="Цвет заметки"
      className={`fixed z-50 flex items-center justify-between gap-1.5 rounded-xl border border-reader-text/20 bg-paper/95 p-2 shadow-2xl backdrop-blur-md transition-all ${
        isMobile
          ? "bottom-4 left-4 right-4 max-w-md mx-auto"
          : "max-w-xs"
      }`}
      style={isMobile ? undefined : { top: `${top}px`, left: `${left}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <div className="flex flex-1 items-center justify-around gap-1 overflow-x-auto">
        {highlightTypes.map(({ type, name, colorName, menuClassName }) => (
          <button
            key={type}
            type="button"
            aria-label={`${colorName}: ${name}`}
            title={`${colorName}: ${name}`}
            onClick={() => create(type)}
            className={`whitespace-nowrap rounded-lg border border-reader-text/20 px-2 py-1.5 text-xs font-medium text-reader-text transition-transform active:scale-95 hover:opacity-90 ${menuClassName}`}
          >
            {name}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-label="Закрыть меню выделения"
        onClick={onClose}
        className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-ink-muted hover:bg-paper-soft hover:text-ink"
      >
        ×
      </button>
      {error && <span className="sr-only" role="status">{error}</span>}
    </div>
  );
}
