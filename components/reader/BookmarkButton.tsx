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
    // Update the button before the network roundtrip to Vercel and Supabase.
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
        // Network failures are handled by the same rollback below.
      }

      setSaved(false);
      setError("Не удалось сохранить закладку. Попробуйте ещё раз.");
    })();
  };

  return (
    <div>
      <button
        onClick={handleAddBookmark}
        disabled={saved}
        className="min-h-11 rounded-lg border border-reader-text/20 px-4 py-2 text-sm text-reader-text transition-all active:scale-95 hover:border-reader-text/40 disabled:opacity-60"
      >
        {saved ? "✓ Заложено" : "Добавить закладку"}
      </button>
      {error && <p className="mt-2 text-sm text-red-400" role="status">{error}</p>}
    </div>
  );
}
