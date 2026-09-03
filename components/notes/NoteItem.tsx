import Link from "next/link";
import { removeHighlight } from "@/app/notes/actions";
import { highlightTypeByName } from "@/lib/highlights/types";
import type { HighlightNote } from "@/server/highlights/queries";

export function NoteItem({ note }: { note: HighlightNote }) {
  const type = note.type ? highlightTypeByName[note.type] : null;

  return (
    <article className="rounded-sm border border-border bg-paper-soft px-5 py-4">
      <p className="font-serif text-lg leading-relaxed">{note.selectedText}</p>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="font-medium text-ink">
          {type
            ? `${type.name} — ${type.colorName.toLowerCase()}`
            : "Не классифицировано — старое розовое выделение"}
        </span>
        <span>{note.bookTitle}</span>
        <span>{note.chapterTitle ?? `Глава ${note.chapterNumber}`}</span>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <Link
          href={`/books/${note.bookId}/read?chapter=${note.chapterNumber}`}
          className="font-medium text-accent hover:underline"
        >
          Открыть в книге
        </Link>
        <form action={removeHighlight}>
          <input type="hidden" name="highlightId" value={note.id} />
          <button type="submit" className="text-ink-muted hover:text-accent">
            Удалить
          </button>
        </form>
      </div>
    </article>
  );
}
