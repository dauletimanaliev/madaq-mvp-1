import { notFound } from "next/navigation";
import { getBookById } from "@/server/books/queries";
import { getChaptersByBook } from "@/server/chapters/queries";
import { BookHero } from "@/components/book/BookHero";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const book = await getBookById(bookId);
  if (!book) notFound();

  const chapters = await getChaptersByBook(bookId);

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <BookHero book={book} chapterCount={chapters.length} />
    </div>
  );
}
