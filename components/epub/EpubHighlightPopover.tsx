"use client";

import React, { useState } from "react";
import {
  EPUB_HIGHLIGHT_PALETTE,
  type ReaderTheme,
} from "@/lib/epub/highlight-styles";
import type { Highlight, HighlightType } from "@/lib/types";

export interface PopoverPosition {
  x: number; // viewport clientX
  y: number; // viewport clientY (top of selection)
  placement?: "top" | "bottom";
}

interface EpubHighlightPopoverProps {
  position: PopoverPosition | null;
  theme: ReaderTheme;
  existingHighlight?: Highlight | null;
  onSelectCategory: (type: HighlightType | null, note?: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function EpubHighlightPopover({
  position,
  theme,
  existingHighlight,
  onSelectCategory,
  onDelete,
  onClose,
}: EpubHighlightPopoverProps) {
  const [showNoteInput, setShowNoteInput] = useState(Boolean(existingHighlight?.note));
  const [noteText, setNoteText] = useState(existingHighlight?.note || "");

  if (!position) return null;

  // Calculate coordinates with safe padding from screen edges
  const popoverWidth = 320;
  const left = Math.max(12, Math.min(window.innerWidth - popoverWidth - 12, position.x - popoverWidth / 2));
  const top = position.placement === "bottom" ? position.y + 12 : Math.max(10, position.y - 68);

  const themeClasses = {
    paper: "bg-[#FDFBF7] text-[#1F1E1D] border-[#E5E0D8] shadow-lg shadow-black/10",
    sepia: "bg-[#F4EBD9] text-[#382C1E] border-[#DED3BE] shadow-lg shadow-black/10",
    dark: "bg-[#252523] text-[#ECE7DE] border-[#3E3E3A] shadow-xl shadow-black/40",
  }[theme];

  const categories: (HighlightType | "none")[] = [
    "protein",
    "carbohydrate",
    "fat",
    "vitamin",
    "fiber",
    "none",
  ];

  return (
    <div
      role="dialog"
      aria-label="Меню выделения"
      className={`fixed z-50 rounded-xl border p-2 text-sm transition-all duration-150 select-none ${themeClasses}`}
      style={{
        left: `${left}px`,
        top: `${top}px`,
        width: `${popoverWidth}px`,
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      onTouchEnd={(e) => e.stopPropagation()}
    >
      <div className="flex items-center justify-between gap-1.5 px-1 pb-1">
        <div className="flex items-center gap-1.5">
          {categories.map((catKey) => {
            const conf = EPUB_HIGHLIGHT_PALETTE[catKey];
            const typeVal = catKey === "none" ? null : (catKey as HighlightType);
            const isSelected = existingHighlight
              ? existingHighlight.type === typeVal
              : false;

            return (
              <button
                key={catKey}
                type="button"
                data-testid={`highlight-btn-${catKey}`}
                aria-label={`${conf.name} (${conf.colorName})`}
                title={`${conf.name} (${conf.colorName}): ${conf.description}`}
                onClick={() => onSelectCategory(typeVal, noteText)}
                className={`group relative flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-transform active:scale-90 ${conf.dotClass} ${
                  isSelected ? "ring-2 ring-offset-2 ring-offset-transparent scale-110" : ""
                }`}
              >
                <span
                  className={
                    catKey === "fat"
                      ? "text-stone-900 font-extrabold"
                      : catKey === "none"
                        ? "text-stone-800 font-extrabold"
                        : "text-white"
                  }
                >
                  {conf.shortLabel}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-1 pl-1">
          <button
            type="button"
            title={showNoteInput ? "Скрыть заметку" : "Добавить заметку"}
            aria-label="Заметка"
            onClick={() => setShowNoteInput(!showNoteInput)}
            className={`rounded p-1.5 text-xs transition-colors hover:bg-black/10 dark:hover:bg-white/10 ${
              noteText ? "text-accent font-semibold" : "opacity-70"
            }`}
          >
            ✏️
          </button>

          {existingHighlight && onDelete && (
            <button
              type="button"
              title="Удалить выделение"
              aria-label="Удалить"
              onClick={onDelete}
              className="rounded p-1.5 text-xs text-red-500 hover:bg-red-500/10 transition-colors"
            >
              🗑️
            </button>
          )}

          <button
            type="button"
            title="Закрыть"
            aria-label="Закрыть"
            onClick={onClose}
            className="rounded p-1.5 text-xs opacity-60 hover:opacity-100 hover:bg-black/10 dark:hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>
      </div>

      {showNoteInput && (
        <div className="mt-2 border-t border-current/10 pt-2 px-1">
          <textarea
            rows={2}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="Ваша мысль или заметка к цитате…"
            className="w-full resize-none rounded border border-current/20 bg-transparent p-1.5 text-xs outline-none focus:border-current/50 placeholder:opacity-50"
          />
          {existingHighlight && (
            <div className="mt-1 flex justify-end">
              <button
                type="button"
                onClick={() => onSelectCategory(existingHighlight.type, noteText)}
                className="rounded bg-accent px-2 py-0.5 text-xs text-white hover:opacity-90"
              >
                Сохранить
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
