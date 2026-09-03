"use client";

import { useState, useTransition } from "react";
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
  const [isPending, startTransition] = useTransition();

  if (!selection || selection.startPosition === selection.endPosition) {
    return null;
  }

  const selectedRange = selection;
  const top = Math.max(8, selectedRange.rect.top - 44);
  const left = Math.max(
    8,
    selectedRange.rect.left + selectedRange.rect.width / 2 - 72
  );

  function create(type: HighlightType) {
    startTransition(async () => {
      try {
        setError(null);
        const highlight = await addHighlight({
          bookId,
          chapterId,
          startPosition: selectedRange.startPosition,
          endPosition: selectedRange.endPosition,
          type,
        });
        onCreated(highlight);
      } catch {
        setError("Не удалось сохранить выделение.");
      }
    });
  }

  return (
    <div
      role="dialog"
      aria-label="Цвет выделения"
      className="fixed z-20 flex items-center gap-1 rounded-md border border-reader-text/15 bg-reader-bg px-2 py-1 shadow-lg"
      style={{ top, left }}
      onMouseDown={(event) => event.preventDefault()}
    >
      {highlightTypes.map(({ type, name, colorName, menuClassName }) => (
        <button
          key={type}
          type="button"
          aria-label={`${colorName}: ${name}`}
          title={`${colorName}: ${name}`}
          disabled={isPending}
          onClick={() => create(type)}
          className={`rounded border border-reader-text/20 px-1.5 py-1 text-xs text-reader-text ${menuClassName} disabled:opacity-60`}
        >
          {name}
        </button>
      ))}
      <button
        type="button"
        aria-label="Закрыть меню выделения"
        onClick={onClose}
        className="ml-1 text-sm text-reader-muted"
      >
        ×
      </button>
      {error && <span className="sr-only" role="status">{error}</span>}
    </div>
  );
}
