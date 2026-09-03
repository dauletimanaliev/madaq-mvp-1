import { notFound } from "next/navigation";
import { getBookById } from "@/server/books/queries";
import { getChaptersByBook, getChapterByNumber } from "@/server/chapters/queries";
import { getProgress } from "@/server/progress/queries";
import { listHighlights } from "@/server/highlights/queries";
import { DEMO_USER_ID } from "@/lib/mock-data";
import { Reader } from "@/components/reader/Reader";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: Promise<{ bookId: string }>;
  searchParams: Promise<{ chapter?: string; at?: string }>;
}) {
  const { bookId } = await params;
  const { chapter: chapterParam, at } = await searchParams;

  const [book, chapters, savedProgress] = await Promise.all([
    getBookById(bookId),
    getChaptersByBook(bookId),
    getProgress(DEMO_USER_ID, bookId),
  ]);

  if (!book || chapters.length === 0) notFound();

  const savedChapter = chapters.find(
    (candidate) => candidate.id === savedProgress?.chapterId
  );
  const parsedNumber = Number(chapterParam ?? savedChapter?.number ?? 1);
  const chapterNumber = Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : 1;
  const chapter = (await getChapterByNumber(bookId, chapterNumber)) ?? chapters[0];
  if (!chapter) notFound();

  const highlights = await listHighlights(DEMO_USER_ID, chapter.id);

  const initialPosition =
    at === "end"
      ? chapter.content.length
      : chapterParam === undefined && savedProgress?.chapterId === chapter.id
        ? savedProgress.position
        : 0;

  return (
    <Reader
      key={`${chapter.id}:${initialPosition}`}
      book={book}
      chapter={chapter}
      chapterMetrics={chapters.map((item) => ({
        id: item.id,
        number: item.number,
        contentLength: item.content.length,
      }))}
      initialPosition={initialPosition}
      initialHighlights={highlights}
    />
  );
}
