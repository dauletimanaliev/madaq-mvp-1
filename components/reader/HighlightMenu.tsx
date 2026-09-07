"use client";

import { useEffect, useRef, useState } from "react";
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

  // Mobile Bottom Sheet layout
  if (isMobile) {
    return (
      <div
        role="dialog"
        aria-label="Тип заметки"
        className="fixed inset-x-0 bottom-0 z-50 animate-in slide-in-from-bottom duration-200"
        onMouseDown={(event) => event.preventDefault()}
        onTouchStart={(event) => event.stopPropagation()}
      >
        <div
          className="fixed inset-0 -z-10 bg-black/20 backdrop-blur-[2px]"
          onClick={onClose}
        />
        <div className="mx-auto max-w-lg rounded-t-2xl border-t border-reader-text/15 bg-paper/98 p-4 shadow-2xl backdrop-blur-xl pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-8 rounded-full bg-ink/20" />
              <span className="text-xs font-semibold uppercase tracking-wider text-ink-muted">
                {existing ? "Изменить цвет заметки" : "Выберите цвет заметки"}
              </span>
            </div>
            <button
              type="button"
              aria-label="Закрыть"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-full text-base font-bold text-ink-muted hover:bg-paper-soft hover:text-ink active:scale-95 transition-colors"
            >
              ×
            </button>
          </div>

          <div className="grid grid-cols-5 gap-2">
            {highlightTypes.map(({ type, name, colorName, menuClassName }) => {
              const isActive = existing?.type === type;
              return (
                <button
                  key={type}
                  type="button"
                  aria-label={`${colorName}: ${name}`}
                  title={`${colorName}: ${name}`}
                  onClick={() => selectColor(type)}
                  className={`flex flex-col items-center justify-center gap-1 min-h-[52px] rounded-xl border border-ink/10 p-2 text-center text-[11px] font-medium transition-all active:scale-95 ${menuClassName} ${
                    isActive
                      ? "ring-2 ring-ink ring-offset-1 font-bold shadow-md scale-[1.04]"
                      : ""
                  }`}
                >
                  <span className="line-clamp-1 leading-tight">{name}</span>
                  {isActive && (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-ink" />
                  )}
                </button>
              );
            })}
          </div>

          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              className="mt-3 flex w-full items-center justify-center gap-2 min-h-[44px] rounded-xl border border-red-500/20 bg-red-500/10 text-xs font-semibold text-red-500 hover:bg-red-500/20 active:scale-[0.98] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              Удалить выделение
            </button>
          )}
        </div>
      </div>
    );
  }

  // Desktop Floating Popover layout
  const menuWidth = existing ? 710 : 660;
  const estimatedHeight = 62;
  const rawTop = selectedRange.rect.top - 54;
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
      className="fixed z-50 flex items-center gap-2 rounded-xl border border-reader-text/20 bg-paper/95 p-2 shadow-2xl backdrop-blur-md"
      style={{ top: `${top}px`, left: `${left}px`, width: `${menuWidth}px` }}
      onMouseDown={(event) => event.preventDefault()}
      onTouchStart={(event) => event.stopPropagation()}
    >
      <div className="grid flex-1 grid-cols-5 gap-1.5">
        {highlightTypes.map(({ type, name, colorName, menuClassName }) => {
          const isActive = existing?.type === type;
          return (
            <button
              key={type}
              type="button"
              aria-label={`${colorName}: ${name}`}
              title={`${colorName}: ${name}`}
              onClick={() => selectColor(type)}
              className={`min-h-11 rounded-lg border border-ink/10 px-2 py-2 text-xs font-medium transition-all active:scale-[0.98] ${menuClassName} ${
                isActive ? "ring-2 ring-ink ring-offset-1 font-bold shadow-md scale-[1.02]" : ""
              }`}
            >
              {name}
            </button>
          );
        })}
      </div>
      {existing && (
        <button
          type="button"
          aria-label="Удалить выделение"
          title="Удалить выделение"
          onClick={handleDelete}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-red-500/20 bg-red-500/10 text-red-500 hover:bg-red-500/20 active:scale-95 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      )}
      <button
        type="button"
        aria-label="Закрыть меню выделения"
        onClick={onClose}
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-bold text-ink-muted hover:bg-paper-soft hover:text-ink transition-colors"
      >
        ×
      </button>
    </div>
  );
}
