import Link from "next/link";
import type { Bookmark } from "@/lib/types";
import { removeBookmark } from "@/app/bookmarks/actions";

export function BookmarkItem({ bookmark }: { bookmark: Bookmark }) {
  return (
    <div className="group flex items-center justify-between rounded-sm border border-border bg-paper-soft px-5 py-4 transition-colors hover:border-accent">
      <Link
        href={`/books/${bookmark.bookId}/read?chapter=${bookmark.chapterNumber}`}
        className="min-w-0 flex-1"
      >
        <p className="font-serif text-lg">{bookmark.bookTitle}</p>
        <p className="text-sm text-ink-muted">Глава {bookmark.chapterNumber}</p>
        {bookmark.note && (
          <p className="mt-1 text-sm text-ink-muted italic">
            {bookmark.note}
          </p>
        )}
      </Link>
      <div className="ml-4 flex shrink-0 items-center gap-4">
        <Link
          href={`/books/${bookmark.bookId}/read?chapter=${bookmark.chapterNumber}`}
          className="text-sm font-medium text-accent group-hover:underline"
        >
          Открыть
        </Link>
        <form action={removeBookmark}>
          <input type="hidden" name="bookmarkId" value={bookmark.id} />
          <button
            type="submit"
            className="text-sm text-ink-muted hover:text-accent"
          >
            Удалить
          </button>
        </form>
      </div>
    </div>
  );
}
