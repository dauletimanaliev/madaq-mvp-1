"use client";

import React, { useState, useEffect } from "react";
import type { Book } from "@/lib/types";
import { BookCard } from "./BookCard";

export function BookListWithSearch({
  initialBooks,
}: {
  initialBooks: Book[];
}) {
  const [query, setQuery] = useState("");
  // Results for the last query that finished loading. The visible list and
  // the spinner are derived from it, so no state is reset inside effects.
  const [searchState, setSearchState] = useState<{
    query: string;
    books: Book[];
  } | null>(null);

  const trimmed = query.trim();
  const isSearching = trimmed !== "" && searchState?.query !== trimmed;
  const books = trimmed ? (searchState?.books ?? initialBooks) : initialBooks;

  useEffect(() => {
    if (!trimmed) return;

    const handler = setTimeout(async () => {
      try {
        const res = await fetch(`/api/books/search?q=${encodeURIComponent(trimmed)}`);
        if (!res.ok) throw new Error(`Search failed with status ${res.status}`);
        const data = await res.json();
        setSearchState({ query: trimmed, books: data.books || [] });
      } catch (err) {
        console.error("Search failed:", err);
        // Keep the previous list but stop the spinner.
        setSearchState((prev) => ({
          query: trimmed,
          books: prev?.books ?? initialBooks,
        }));
      }
    }, 200);

    return () => clearTimeout(handler);
  }, [trimmed, initialBooks]);

  return (
    <div className="mt-8 flex flex-col gap-6">
      {/* Search Input Bar (pg_trgm powered) */}
      <div className="relative w-full">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-ink-muted">
          {isSearching ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-border border-t-accent" />
          ) : (
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          )}
        </div>

        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по названию или автору (например: Илон Маск, Күміс кітап)…"
          className="w-full rounded-lg border border-border bg-paper-soft py-2.5 pr-10 pl-10 text-sm text-ink placeholder:text-ink-muted transition-colors focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
        />

        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute inset-y-0 right-0 flex items-center pr-3 text-ink-muted hover:text-ink"
            title="Очистить"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Results / List */}
      {books.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center">
          <p className="text-base font-medium text-ink">
            {query.trim()
              ? `Ничего не найдено по запросу «${query}»`
              : "В библиотеке пока нет книг"}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {query.trim()
              ? "Попробуйте изменить запрос или поискать по автору."
              : "Нажмите кнопку «+», чтобы добавить первую книгу."}
          </p>
          {query.trim() && (
            <button
              onClick={() => setQuery("")}
              className="mt-4 text-xs font-medium text-accent hover:underline"
            >
              Сбросить поиск
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-4 transition-opacity duration-200">
          {books.map((book) => (
            <BookCard key={book.id} book={book} />
          ))}
        </div>
      )}
    </div>
  );
}
