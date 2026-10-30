import { notFound } from "next/navigation";
import { getBookForUser } from "@/server/books/queries";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { countChaptersByBook } from "@/server/chapters/queries";
import { BookHero } from "@/components/book/BookHero";

export const dynamic = "force-dynamic";

export default async function BookPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId: rawBookId } = await params;
  const bookId = decodeURIComponent(rawBookId);
  const userId = await getCurrentUserId();
  const [book, chapterCount] = await Promise.all([
    getBookForUser(userId, bookId),
    countChaptersByBook(bookId),
  ]);
  if (!book) notFound();

  return (
    <div className="mx-auto max-w-3xl px-6 py-16">
      <BookHero book={book} chapterCount={chapterCount} />
    </div>
  );
}
