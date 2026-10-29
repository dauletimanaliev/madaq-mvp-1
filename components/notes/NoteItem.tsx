import Link from "next/link";
import { removeHighlight } from "@/app/notes/actions";
import { highlightTypeByName } from "@/lib/highlights/types";
import type { HighlightNote } from "@/server/highlights/queries";

export function NoteItem({ note }: { note: HighlightNote }) {
  const type = note.type ? highlightTypeByName[note.type] : null;

  // Navigation target logic
  let readerHref: string;
  let linkText = "Открыть в книге";

  if (note.cfi) {
    readerHref = `/books/${note.bookId}/epub?cfi=${encodeURIComponent(note.cfi)}`;
  } else if (note.sectionHref) {
    // Unanchored highlight with sectionHref: allow reader to jump directly to section
    readerHref = `/books/${note.bookId}/epub?section=${encodeURIComponent(note.sectionHref)}`;
    linkText = "Открыть главу";
  } else if (note.pageNumber) {
    readerHref = `/books/${note.bookId}/pdf?page=${note.pageNumber}`;
  } else {
    readerHref = `/books/${note.bookId}/read?chapter=${note.chapterNumber ?? 1}`;
  }

  return (
    <article className="rounded-sm border border-border bg-paper-soft px-5 py-4">
      <p className="font-serif text-lg leading-relaxed">{note.selectedText}</p>
      {note.note && (
        <p className="mt-2 text-sm italic text-ink-muted bg-paper p-2 rounded border border-border/50">
          {note.note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-ink-muted">
        <span className="font-medium text-ink">
          {type
            ? `${type.name} — ${type.colorName.toLowerCase()}`
            : "Без категории"}
        </span>
        <span>{note.bookTitle}</span>
        <span>
          {note.pageNumber
            ? `Страница ${note.pageNumber}`
            : note.sectionHref
              ? `Секция ${note.sectionHref}`
              : (note.chapterTitle ?? `Глава ${note.chapterNumber ?? 1}`)}
        </span>
      </div>
      <div className="mt-4 flex items-center gap-4 text-sm">
        <Link
          href={readerHref}
          className="font-medium text-accent hover:underline"
        >
          {linkText}
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
