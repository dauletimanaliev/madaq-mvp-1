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
  const [isPending, startTransition] = useTransition();

  return (
    <div>
      <button
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const bookmark = await addBookmark({
              bookId,
              bookTitle,
              chapterId,
              chapterNumber,
              position,
              note: null,
            });
            if (bookmark) {
              setSaved(true);
            } else {
              setError("Не удалось сохранить закладку. Попробуйте ещё раз.");
            }
          })
        }
        disabled={isPending || saved}
        className="rounded-sm border border-reader-text/20 px-4 py-2 text-sm text-reader-text transition-colors hover:border-reader-text/40 disabled:opacity-60"
      >
        {saved ? "Заложено" : "Добавить закладку"}
      </button>
      {error && <p className="mt-2 text-sm text-red-300" role="status">{error}</p>}
    </div>
  );
}
