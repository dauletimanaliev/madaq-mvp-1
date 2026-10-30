"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { removeBookFromLibrary } from "@/app/books/[bookId]/actions";

export function RemoveBookButton({ bookId, title }: { bookId: string; title: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = () => {
    const ok = window.confirm(
      `Удалить «${title}» из библиотеки?\n\nВместе с книгой удалятся ваши заметки, закладки и прогресс чтения. Это нельзя отменить.`
    );
    if (!ok) return;
    setError(null);
    startTransition(async () => {
      const res = await removeBookFromLibrary(bookId);
      if (res.ok) {
        router.replace("/");
        router.refresh();
      } else {
        setError(res.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="inline-flex w-fit items-center rounded-sm px-3 py-2.5 text-sm text-ink-muted transition-colors hover:text-red-700 disabled:opacity-50"
      >
        {isPending ? "Удаляем…" : "Удалить из библиотеки"}
      </button>
      {error && <p className="text-xs text-red-700">{error}</p>}
    </div>
  );
}
