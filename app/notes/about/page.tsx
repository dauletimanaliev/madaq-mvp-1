import Link from "next/link";
import { highlightTypes } from "@/lib/highlights/types";

export default function NotesAboutPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/notes" className="text-sm font-medium text-accent hover:underline">
        К моим заметкам
      </Link>
      <h1 className="mt-5 font-serif text-4xl leading-tight">Как работают мои заметки</h1>
      <p className="mt-4 max-w-2xl text-lg text-ink-muted">
        Сохраняй не просто текст. Сохраняй то, зачем он тебе нужен.
      </p>
      <div className="mt-10 space-y-6">
        {highlightTypes.map((item) => (
          <section key={item.type} className="flex gap-3">
            <span
              aria-hidden="true"
              className={`mt-2 h-3 w-3 shrink-0 rounded-full ${item.menuClassName}`}
            />
            <div>
              <h2 className="font-serif text-2xl">
                {item.name} — {item.colorName.toLowerCase()}
              </h2>
              <p className="mt-1 text-ink-muted">{item.description}</p>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
