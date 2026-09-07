"use client";

import { useState } from "react";
import { addBookmark } from "@/app/books/[bookId]/read/actions";

export function BookmarkButton({
  bookId,
  bookTitle,
  chapterId,
  chapterNumber,
  position,
}: {
  bookId: string;
  bookTitle: string;
  chapterId: string;
  chapterNumber: number;
  position: number;
}) {
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAddBookmark = () => {
    setSaved(true);
    setError(null);

    void (async () => {
      try {
        const bookmark = await addBookmark({
          bookId,
          bookTitle,
          chapterId,
          chapterNumber,
          position,
          note: null,
        });

        if (bookmark) return;
      } catch {
        // Rollback on error
      }

      setSaved(false);
      setError("Не удалось сохранить закладку.");
    })();
  };

  return (
    <div className="relative inline-flex items-center">
      <button
        type="button"
        onClick={handleAddBookmark}
        disabled={saved}
        aria-label={saved ? "Закладка сохранена" : "Добавить закладку"}
        title={saved ? "Закладка сохранена" : "Добавить закладку"}
        className={`flex min-h-9 items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all active:scale-95 ${
          saved
            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
            : "border-reader-text/20 text-reader-muted hover:border-reader-text/40 hover:text-reader-text"
        }`}
      >
        <svg className="w-3.5 h-3.5" fill={saved ? "currentColor" : "none"} viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
        </svg>
        <span>{saved ? "Закладка" : "Закладка"}</span>
      </button>
      {error && (
        <span className="absolute bottom-full mb-1 left-0 whitespace-nowrap rounded bg-red-900/90 px-2 py-1 text-[10px] text-red-200 shadow">
          {error}
        </span>
      )}
    </div>
  );
}
