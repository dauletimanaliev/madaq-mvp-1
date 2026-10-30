import Link from "next/link";
import { removeHighlight } from "@/app/notes/actions";
import { highlightTypeByName, uncategorizedHighlight } from "@/lib/highlights/types";
import type { HighlightNote } from "@/server/highlights/queries";

export function NoteItem({ note }: { note: HighlightNote }) {
  const type = note.type ? highlightTypeByName[note.type] : null;
  const style = (type ?? uncategorizedHighlight).noteStyle;

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
    <article className={`rounded-sm border border-l-4 border-border bg-white px-5 py-4 ${style.stripe}`}>
      {/* The fragment keeps its highlight colour; dark text on a light marker stays easy to read. */}
      <p className="font-serif text-lg leading-[1.9] text-ink">
        <mark className={`rounded-sm px-1 py-0.5 text-ink [box-decoration-break:clone] [-webkit-box-decoration-break:clone] ${style.mark}`}>
          {note.selectedText}
        </mark>
      </p>
      {note.note && (
        <p className="mt-3 rounded border border-border/60 bg-paper-soft p-2.5 text-sm italic text-ink-muted">
          {note.note}
        </p>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-ink-muted">
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${style.label}`}>
          <span className={`h-2 w-2 rounded-full ${style.dot}`} aria-hidden="true" />
          {type ? type.name : uncategorizedHighlight.name}
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
