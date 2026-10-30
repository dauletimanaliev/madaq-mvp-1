import Link from "next/link";
import { getLibraryBooks } from "@/server/books/queries";
import { getOptionalUserId } from "@/lib/auth/get-current-user";
import { BookListWithSearch } from "@/components/library/BookListWithSearch";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const userId = await getOptionalUserId();
  const books = userId ? await getLibraryBooks(userId) : [];

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-ink-muted">Ваша библиотека</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">
          Что читаем сегодня
        </h1>

        {userId ? (
          <BookListWithSearch initialBooks={books} />
        ) : (
          <div className="mt-8 rounded-xl border border-border bg-paper-soft px-6 py-10 text-center">
            <p className="text-base font-medium text-ink">
              Войдите, чтобы открыть свою библиотеку
            </p>
            <p className="mt-1 text-sm text-ink-muted">
              Загружайте свои PDF и EPUB, читайте и делайте заметки. Ваши книги видите только вы.
            </p>
            <Link
              href="/login"
              className="mt-5 inline-block rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-paper-soft transition hover:opacity-90"
            >
              Войти
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
