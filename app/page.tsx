import { getBooks } from "@/server/books/queries";
import { BookListWithSearch } from "@/components/library/BookListWithSearch";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const books = await getBooks();

  return (
    <div className="relative min-h-screen">
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-sm text-ink-muted">Ваша библиотека</p>
        <h1 className="mt-2 font-serif text-4xl leading-tight">
          Что читаем сегодня
        </h1>

        <BookListWithSearch initialBooks={books} />
      </div>
    </div>
  );
}
