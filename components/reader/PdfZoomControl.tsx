"use client";

import { useEffect, useRef, useState } from "react";

const STEP = 0.25;

/**
 * "Аа" button with a size popover for the PDF reader, matching the EPUB
 * reader. A PDF page is an image of the original, so this scales the whole
 * page; 100% means "fit the screen width".
 */
export function PdfZoomControl({
  zoom,
  min,
  max,
  onChange,
}: {
  zoom: number;
  min: number;
  max: number;
  onChange: (zoom: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  // Close on a tap outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const step = (dir: 1 | -1) => {
    const next = Math.round((zoom + dir * STEP) / STEP) * STEP;
    onChange(Math.min(max, Math.max(min, next)));
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex h-9 min-w-9 items-center justify-center rounded-md px-1.5 font-serif text-sm font-bold transition-colors ${
          open ? "bg-accent text-paper-soft" : "text-ink-muted hover:bg-neutral-100 hover:text-ink"
        }`}
        title="Размер текста"
        aria-label="Размер текста"
        aria-expanded={open}
      >
        Аа
      </button>

      {open && (
        <div className="absolute right-0 top-full z-40 mt-2 w-60 rounded-xl border border-neutral-200 bg-white p-3.5 text-ink shadow-xl">
          <div className="mb-2.5 text-[11px] font-medium uppercase tracking-wider text-ink-muted">
            Размер текста
          </div>
          <div className="flex items-center justify-between rounded-lg border border-neutral-200 p-1">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={zoom <= min}
              className="flex h-9 w-11 items-center justify-center rounded text-xs font-bold hover:bg-neutral-100 active:scale-90 disabled:opacity-30"
              title="Уменьшить"
              aria-label="Уменьшить"
            >
              А−
            </button>
            <span className="font-mono text-xs font-medium tabular-nums">{Math.round(zoom * 100)}%</span>
            <button
              type="button"
              onClick={() => step(1)}
              disabled={zoom >= max}
              className="flex h-9 w-11 items-center justify-center rounded text-sm font-bold hover:bg-neutral-100 active:scale-90 disabled:opacity-30"
              title="Увеличить"
              aria-label="Увеличить"
            >
              А+
            </button>
          </div>
          <button
            type="button"
            onClick={() => onChange(1)}
            disabled={zoom === 1}
            className="mt-2.5 w-full rounded-md py-1.5 text-xs text-ink-muted hover:bg-neutral-100 hover:text-ink disabled:opacity-40"
          >
            По ширине экрана
          </button>
          <p className="mt-2 text-[11px] leading-snug text-ink-muted">
            PDF показывается как оригинал, поэтому увеличивается вся страница. Если она станет шире
            экрана, её можно двигать в стороны.
          </p>
        </div>
      )}
    </div>
  );
}
