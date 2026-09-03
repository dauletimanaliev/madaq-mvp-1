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
    <div className="flex items-center justify-between border-b border-reader-text/10 pb-4">
      <div>
        <p className="text-sm text-reader-muted">{bookTitle}</p>
        <p className="font-serif text-lg text-reader-text">{chapterTitle}</p>
      </div>
      <div className="flex items-center gap-4 text-sm text-reader-muted">
        <Link href="/notes/about" className="hover:text-reader-text">
          Как работают заметки
        </Link>
        <Link href={`/books/${bookId}`} className="hover:text-reader-text">
          Закрыть
        </Link>
      </div>
    </div>
  );
}
