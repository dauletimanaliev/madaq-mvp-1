import type { Book } from "@/lib/types";

/**
 * "стр. 45 из 340 · 13%" with a progress bar, for library cards and the
 * book page. Nothing is shown for a book that has not been started.
 */
export function ReadingProgressLine({ book, className = "" }: { book: Book; className?: string }) {
  const progress = book.readingProgress;
  if (!progress) return null;
  const { lastReadPage, progressPct } = progress;
  if (lastReadPage <= 1 && progressPct <= 0) return null;

  const total = book.totalPages && book.totalPages > 0 ? book.totalPages : null;
  const pct = Math.min(100, Math.max(0, Math.round(progressPct)));
  const label = total
    ? `стр. ${Math.min(lastReadPage, total)} из ${total} · ${pct}%`
    : `прочитано ${pct}%`;

  return (
    <div className={`flex max-w-xs flex-col gap-1.5 ${className}`}>
      <div className="h-1 w-full overflow-hidden rounded-full bg-black/[0.06]">
        <div className="h-full rounded-full bg-accent" style={{ width: `${Math.max(pct, 2)}%` }} />
      </div>
      <p className="text-xs tabular-nums text-ink-muted">{label}</p>
    </div>
  );
}
