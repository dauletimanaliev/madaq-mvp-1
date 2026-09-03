"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled route error.", error);
  }, [error]);

  return (
    <div className="mx-auto flex max-w-3xl flex-1 flex-col justify-center px-6 py-16">
      <p className="text-sm text-ink-muted">Что-то пошло не так</p>
      <h1 className="mt-2 font-serif text-4xl">Не удалось загрузить эту страницу</h1>
      <p className="mt-4 max-w-lg text-ink-muted">
        Попробуйте ещё раз. Если проблема повторится, вернитесь в библиотеку.
      </p>
      <div className="mt-8 flex gap-4">
        <button
          type="button"
          onClick={reset}
          className="rounded-sm bg-accent px-4 py-2 text-sm font-medium text-paper-soft"
        >
          Повторить
        </button>
        <Link href="/" className="px-4 py-2 text-sm font-medium text-accent hover:underline">
          В библиотеку
        </Link>
      </div>
    </div>
  );
}
