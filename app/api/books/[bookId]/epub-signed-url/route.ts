import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET: Generates a temporary signed URL (TTL 1 hour) for downloading/streaming EPUB.
 * Verifies session, book existence, and user ownership in user_library before signing.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    // 1. Проверка авторизации (401 без сессии)
    let session = null;
    try {
      session = await auth();
    } catch {
      session = null;
    }
    let userId = session?.user?.id;
    if (!userId && process.env.NODE_ENV === "development") {
      userId = "demo_user";
    }

    if (!userId) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const { bookId: rawBookId } = await params;
    const bookId = decodeURIComponent(rawBookId);

    // 2. Проверка существования книги (404 если книги нет)
    const book = await prisma.book.findFirst({
      where: {
        OR: [{ id: bookId }, { id: rawBookId }],
      },
      select: {
        id: true,
        contentFormat: true,
        epubStorageKey: true,
      },
    });

    if (!book || !book.epubStorageKey) {
      return NextResponse.json(
        { error: "EPUB книга не найдена или не сохранена в хранилище" },
        { status: 404 }
      );
    }

    // 3. Проверка библиотеки пользователя (403 если книга не в библиотеке пользователя)
    const userLibraryEntry = await prisma.userLibrary.findUnique({
      where: {
        userId_bookId: {
          userId,
          bookId: book.id,
        },
      },
    });

    if (!userLibraryEntry) {
      return NextResponse.json(
        { error: "Книга не найдена в вашей библиотеке" },
        { status: 403 }
      );
    }

    // 4. Разделение epubStorageKey на имя бакета и путь внутри бакета
    let bucket = "book-epubs";
    let objectPath = book.epubStorageKey;

    if (book.epubStorageKey.startsWith("book-epubs/")) {
      bucket = "book-epubs";
      objectPath = book.epubStorageKey.slice("book-epubs/".length);
    } else if (book.epubStorageKey.includes("/")) {
      const slashIdx = book.epubStorageKey.indexOf("/");
      bucket = book.epubStorageKey.substring(0, slashIdx);
      objectPath = book.epubStorageKey.substring(slashIdx + 1);
    }

    // 5. Запрос подписанного URL у Supabase Storage (TTL 1 час = 3600 секунд)
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      return NextResponse.json(
        { error: "Хранилище не сконфигурировано" },
        { status: 500 }
      );
    }

    const expiresIn = 3600; // 1 час

    const signRes = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expiresIn }),
      }
    );

    if (!signRes.ok) {
      console.warn(`Supabase EPUB sign failed (${signRes.status}), falling back to internal epub-stream proxy.`);
      return NextResponse.json({ url: `/api/books/${encodeURIComponent(book.id)}/epub-stream?v=${Date.now()}` });
    }

    const signData = await signRes.json();
    const url = `${supabaseUrl}/storage/v1${signData.signedURL}`;

    return NextResponse.json({ url });
  } catch (error) {
    console.error("EPUB signed URL route error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
