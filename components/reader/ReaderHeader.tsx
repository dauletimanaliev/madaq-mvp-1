import Link from "next/link";

export function ReaderHeader({
  bookId,
  bookTitle,
  chapterTitle,
}: {
  bookId: string;
  bookTitle: string;
  chapterTitle: string;
}) {
  return (
    <div className="flex flex-col gap-3 border-b border-reader-text/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="text-sm text-reader-muted">{bookTitle}</p>
        <p className="font-serif text-lg text-reader-text break-words">{chapterTitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-reader-muted">
        <Link href="/notes/about" className="flex min-h-11 items-center hover:text-reader-text">
          Как работают заметки
        </Link>
        <Link href={`/books/${bookId}`} className="flex min-h-11 items-center hover:text-reader-text">
          Закрыть
        </Link>
      </div>
    </div>
  );
}
