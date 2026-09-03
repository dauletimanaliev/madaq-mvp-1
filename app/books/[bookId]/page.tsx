import { notFound } from "next/navigation";
import { getBookById } from "@/server/books/queries";
import { getChaptersByBook } from "@/server/chapters/queries";
import { BookHero } from "@/components/book/BookHero";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId } = await params;
  const [book, chapters] = await Promise.all([
    getBookById(bookId),
    getChaptersByBook(bookId),
  ]);
  if (!book) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <BookHero book={book} chapterCount={chapters.length} />
    </div>
  );
}
