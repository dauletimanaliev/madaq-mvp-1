import { notFound } from "next/navigation";
import { getBookById } from "@/server/books/queries";
import { getChapterMetrics, getChapterByNumber } from "@/server/chapters/queries";
import { getProgress } from "@/server/progress/queries";
import { listHighlights } from "@/server/highlights/queries";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { Reader } from "@/components/reader/Reader";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ chapter?: string; at?: string }>;
}) {
  const { bookId: rawBookId } = await params;
  const bookId = decodeURIComponent(rawBookId);
  const { chapter: chapterParam, at } = await searchParams;

  const userId = await getCurrentUserId();

  const [book, chapterMetrics, savedProgress] = await Promise.all([
    getBookById(bookId),
    getChapterMetrics(bookId),
    getProgress(userId, bookId),
  ]);

  if (!book || chapterMetrics.length === 0) notFound();

  const savedChapter = chapterMetrics.find(
    (candidate) => candidate.id === savedProgress?.chapterId
  );
  const parsedNumber = Number(chapterParam ?? savedChapter?.number ?? 1);
  const chapterNumber =
    Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1;
  const chapter =
    (await getChapterByNumber(bookId, chapterNumber)) ??
    (await getChapterByNumber(bookId, chapterMetrics[0].number));
  if (!chapter) notFound();

  const highlights = await listHighlights(userId, chapter.id);

  const initialPosition =
    at === "end"
      ? chapter.content.length
      : chapterParam === undefined && savedProgress?.chapterId === chapter.id
        ? savedProgress.position
        : 0;

  return (
    <Reader
      key={book.id}
      book={book}
      initialChapter={chapter}
      chapterMetrics={chapterMetrics}
      initialPosition={initialPosition}
      initialHighlights={highlights}
    />
  );
}
