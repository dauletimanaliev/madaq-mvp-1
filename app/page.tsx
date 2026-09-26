import { getBooks } from "@/server/books/queries";
import { BookCard } from "@/components/library/BookCard";
import { AddBookFabModal } from "@/components/library/AddBookFabModal";

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

        {books.length === 0 ? (
          <div className="mt-12 rounded-2xl border border-dashed border-border p-12 text-center">
            <p className="text-base font-medium text-ink">В библиотеке пока нет книг</p>
            <p className="mt-1 text-sm text-ink-muted">
              Нажмите кнопку «+» в правом углу экрана, чтобы загрузить PDF.
            </p>
          </div>
        ) : (
          <div className="mt-10 flex flex-col gap-4">
            {books.map((book) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>

      {/* Flutter-style Floating Action Button in the right corner */}
      <AddBookFabModal />
    </div>
  );
}
