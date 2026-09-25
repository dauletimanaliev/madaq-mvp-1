import { getBooks } from "@/server/books/queries";
import { BookCard } from "@/components/library/BookCard";
import { BookUpload } from "@/components/library/BookUpload";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const books = await getBooks();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <p className="text-sm text-ink-muted">Ваша библиотека</p>
      <h1 className="mt-2 font-serif text-4xl leading-tight">
        Что читаем сегодня
      </h1>

      <div className="mt-10 flex flex-col gap-4">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>

      {/* Upload section */}
      <div className="mt-16">
        <h2 className="font-serif text-2xl">Добавить книгу</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Загрузите PDF, TXT, MD или JSON — книга автоматически разобьётся на
          главы
        </p>
        <div className="mt-5">
          <BookUpload />
        </div>
      </div>
    </div>
  );
}
