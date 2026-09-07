"use client";

import { useEffect, useRef } from "react";
import {
  addHighlight,
  removeHighlight,
  updateHighlightColor,
} from "@/app/books/[bookId]/read/actions";
import { highlightTypes } from "@/lib/highlights/types";
import type { Highlight, HighlightType } from "@/lib/types";

export type SelectionRange = {
  startPosition: number;
  endPosition: number;
  rect: DOMRect;
  existingHighlight?: Highlight | null;
};

const colorStyles: Record<
  HighlightType,
  { bg: string; border: string; ring: string }
> = {
  protein: {
    bg: "bg-red-300 hover:bg-red-400",
    border: "border-red-400",
    ring: "ring-red-500",
  },
  carbohydrate: {
    bg: "bg-orange-300 hover:bg-orange-400",
    border: "border-orange-400",
    ring: "ring-orange-500",
  },
  fat: {
    bg: "bg-amber-300 hover:bg-amber-400",
    border: "border-amber-400",
    ring: "ring-amber-500",
  },
  vitamin: {
    bg: "bg-emerald-300 hover:bg-emerald-400",
    border: "border-emerald-400",
    ring: "ring-emerald-500",
  },
  fiber: {
    bg: "bg-sky-300 hover:bg-sky-400",
    border: "border-sky-400",
    ring: "ring-sky-500",
  },
};

export function HighlightMenu({
  bookId,
  chapterId,
  selection,
  onCreated,
  onUpdated,
  onDeleted,
  onFailed,
  onClose,
}: {
  bookId: string;
  chapterId: string;
  selection: SelectionRange | null;
  onCreated: (highlight: Highlight) => void;
  onUpdated: (highlight: Highlight) => void;
  onDeleted: (highlightId: string) => void;
  onFailed: (highlightId: string, message: string) => void;
  onClose: () => void;
}) {
  const optimisticId = useRef(0);

  if (!selection || selection.startPosition === selection.endPosition) {
    return null;
  }

  const selectedRange = selection;
  const existing = selectedRange.existingHighlight;

  function selectColor(type: HighlightType) {
    const isExactUpdate =
      existing &&
      existing.startPosition === selectedRange.startPosition &&
      existing.endPosition === selectedRange.endPosition;

    if (isExactUpdate) {
      const updatedHighlight: Highlight = {
        ...existing,
        type,
        legacyColor: null,
      };

      onUpdated(updatedHighlight);

      void (async () => {
        try {
          const result = await updateHighlightColor(existing.id, type);
          if (!result.ok) {
            onFailed(existing.id, result.message);
          }
        } catch {
          onFailed(existing.id, "Не удалось изменить цвет выделения.");
        }
      })();
    } else {
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
          const result = await addHighlight({
            bookId,
            chapterId,
            startPosition: selectedRange.startPosition,
            endPosition: selectedRange.endPosition,
            type,
          });

          if (!result.ok) {
            onFailed(tempHighlight.id, result.message);
          }
        } catch {
          onFailed(tempHighlight.id, "Не удалось сохранить выделение.");
        }
      })();
    }
  }

  function handleDelete() {
    if (!existing) return;
    const targetId = existing.id;
    onDeleted(targetId);

    void (async () => {
      try {
        await removeHighlight(targetId);
      } catch {
        onFailed(targetId, "Не удалось удалить выделение.");
      }
    })();
  }

  const numButtons = 5 + (existing ? 1 : 0) + 1;
  const menuWidth = numButtons * 40 + 16;
  const menuHeight = 52;
  const rawTop = selectedRange.rect.top - menuHeight - 12;
  const preferredTop = rawTop < 12 ? selectedRange.rect.bottom + 12 : rawTop;
  const top = Math.max(
    12,
    Math.min(
      preferredTop,
      (typeof window !== "undefined" ? window.innerHeight : 600) - menuHeight - 12
    )
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
      aria-label="Выбрать цвет выделения"
      className="fixed z-50 flex items-center gap-1.5 rounded-full border border-reader-text/25 bg-paper/95 p-1.5 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150"
      style={{ top: `${top}px`, left: `${left}px`, width: `${menuWidth}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      {highlightTypes.map(({ type, name, shortLabel, colorName }) => {
        const isActive = existing?.type === type;
        const style = colorStyles[type];
        return (
          <button
            key={type}
            type="button"
            aria-label={`${colorName}: ${name}`}
            title={`${colorName}: ${name}`}
            onClick={() => selectColor(type)}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-xs font-serif font-bold text-ink transition-all active:scale-90 select-none ${style.bg} ${style.border} ${
              isActive
                ? `ring-2 ${style.ring} ring-offset-2 ring-offset-paper scale-110 shadow-md font-extrabold`
                : "opacity-90 hover:opacity-100"
            }`}
          >
            {shortLabel}
          </button>
        );
      })}

      {existing && (
        <button
          type="button"
          aria-label="Удалить выделение"
          title="Удалить выделение"
          onClick={handleDelete}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-red-500/30 bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-90 transition-all"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}

      <button
        type="button"
        aria-label="Закрыть"
        onClick={onClose}
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold text-ink-muted hover:bg-paper-soft hover:text-ink active:scale-90 transition-colors ml-0.5"
      >
        ×
      </button>
    </div>
  );
}
