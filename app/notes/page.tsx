import Link from "next/link";
import { NoteItem } from "@/components/notes/NoteItem";
import { NotesOnboarding } from "@/components/notes/NotesOnboarding";
import { highlightTypes, isHighlightType } from "@/lib/highlights/types";
import { DEMO_USER_ID } from "@/lib/mock-data";
import { listUserHighlights } from "@/server/highlights/queries";

export default async function NotesPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type: typeParam } = await searchParams;
  const selectedType = isHighlightType(typeParam) ? typeParam : undefined;
  const notes = await listUserHighlights(DEMO_USER_ID, selectedType);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink-muted">Сохранённые фрагменты</p>
          <h1 className="mt-2 font-serif text-4xl leading-tight">Мои заметки</h1>
        </div>
        <Link href="/notes/about" className="text-sm font-medium text-accent hover:underline">
          Как это работает?
        </Link>
      </div>

      <nav aria-label="Фильтр заметок" className="mt-8 flex flex-wrap gap-2">
        <Link
          href="/notes"
          className={`rounded-full border px-3 py-1.5 text-sm ${
            !selectedType ? "border-accent bg-accent-soft text-ink" : "border-border text-ink-muted"
          }`}
        >
          Все
        </Link>
        {highlightTypes.map((item) => (
          <Link
            key={item.type}
            href={`/notes?type=${item.type}`}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              selectedType === item.type
                ? "border-accent bg-accent-soft text-ink"
                : "border-border text-ink-muted"
            }`}
          >
            {item.name}
          </Link>
        ))}
      </nav>

      {notes.length === 0 ? (
        <p className="mt-10 text-ink-muted">
          Пока пусто. Выделите фрагмент во время чтения и выберите, зачем хотите
          его сохранить.
        </p>
      ) : (
        <div className="mt-8 flex flex-col gap-3">
          {notes.map((note) => (
            <NoteItem key={note.id} note={note} />
          ))}
        </div>
      )}
      <NotesOnboarding />
    </div>
  );
}
