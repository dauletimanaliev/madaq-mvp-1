"use client";

import { useState, useTransition } from "react";
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
  const [, startTransition] = useTransition();

  const handleAddBookmark = () => {
    // 1. Мгновенная реакция UI (0 мс)
    setSaved(true);
    setError(null);

    // 2. Асинхронное сохранение на сервере
    startTransition(async () => {
      const bookmark = await addBookmark({
        bookId,
        bookTitle,
        chapterId,
        chapterNumber,
        position,
        note: null,
      });

      if (!bookmark) {
        setSaved(false);
        setError("Не удалось сохранить закладку. Попробуйте ещё раз.");
      }
    });
  };

  return (
    <div>
      <button
        onClick={handleAddBookmark}
        disabled={saved}
        className="rounded-lg border border-reader-text/20 px-4 py-2 text-sm text-reader-text transition-all active:scale-95 hover:border-reader-text/40 disabled:opacity-60"
      >
        {saved ? "✓ Заложено" : "Добавить закладку"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400" role="status">{error}</p>}
    </div>
  );
}
