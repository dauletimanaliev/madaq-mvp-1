import { notFound } from "next/navigation";
import Link from "next/link";
import { getBookById } from "@/server/books/queries";
import { PdfReader } from "@/components/reader/PdfReader";

export const dynamic = "force-dynamic";

export default async function BookPdfPage({
  params,
}: {
  params: Promise<{ bookId: string }>;
}) {
  const { bookId: rawBookId } = await params;
  const bookId = decodeURIComponent(rawBookId);
  const book = await getBookById(bookId);

  if (!book) {
    notFound();
  }

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://fkkdgjmtbzzvbvdswxiz.supabase.co";

  const pdfUrl = book.storageS3Key
    ? `/api/books/${encodeURIComponent(book.id)}/pdf-stream`
    : null;

  if (!pdfUrl) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#1c1b1a] px-6 py-12 text-[#f4efe6]">
        <div className="max-w-md rounded-2xl border border-[#38342f] bg-[#242220] p-8 text-center shadow-xl">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#d97736]/10 text-[#d97736]">
            <svg
              className="h-6 w-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="mt-4 font-serif text-xl font-medium">
            Оригинальный PDF не найден
          </h2>
          <p className="mt-2 text-sm text-[#a19888]">
            Эта книга была добавлена в текстовом формате или до включения
            сохранения PDF в облаке.
          </p>
          <div className="mt-6 flex flex-col gap-2.5">
            <Link
              href={`/books/${book.id}/read`}
              className="rounded-lg bg-[#d97736] px-4 py-2.5 text-sm font-medium text-white transition hover:bg-[#c26526]"
            >
              Открыть в ридере текста
            </Link>
            <Link
              href={`/books/${book.id}`}
              className="rounded-lg border border-[#3e3a34] px-4 py-2.5 text-sm text-[#c4b9a7] transition hover:bg-[#2e2b27]"
            >
              Вернуться к книге
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return <PdfReader book={book} pdfUrl={pdfUrl} />;
}
