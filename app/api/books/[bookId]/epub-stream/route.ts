import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { getBookById } from "@/server/books/queries";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

/**
 * EPUB streaming proxy/server.
 * Streams EPUB files either from local storage or cloud bucket.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
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
    const book = await getBookById(bookId);

    if (!book || !book.epubStorageKey) {
      return NextResponse.json(
        { error: "EPUB файл не найден" },
        { status: 404 }
      );
    }

    const userLibraryEntry = await prisma.userLibrary.findUnique({
      where: { userId_bookId: { userId, bookId: book.id } },
    });
    if (!userLibraryEntry) {
      return NextResponse.json(
        { error: "Книга не найдена в вашей библиотеке" },
        { status: 403 }
      );
    }

    // 1. Check local storage folder first
    const localStoragePath = path.join(
      process.cwd(),
      "storage",
      "epubs",
      `${book.id}.epub`
    );
    if (fs.existsSync(localStoragePath)) {
      const fileBuffer = fs.readFileSync(localStoragePath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Length": String(fileBuffer.length),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // 2. Check public directory
    const publicPath = path.join(
      process.cwd(),
      "public",
      "epubs",
      `${book.id}.epub`
    );
    if (fs.existsSync(publicPath)) {
      const fileBuffer = fs.readFileSync(publicPath);
      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/epub+zip",
          "Content-Length": String(fileBuffer.length),
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    // 3. Fallback to Supabase Storage fetch
    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    let bucket = "book-epubs";
    let objectPath = book.epubStorageKey;
    if (book.epubStorageKey.startsWith("book-epubs/")) {
      objectPath = book.epubStorageKey.slice("book-epubs/".length);
    } else if (book.epubStorageKey.includes("/")) {
      const slashIdx = book.epubStorageKey.indexOf("/");
      bucket = book.epubStorageKey.substring(0, slashIdx);
      objectPath = book.epubStorageKey.substring(slashIdx + 1);
    }

    const s3Url = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${objectPath}`;
    const upstreamRes = await fetch(s3Url, {
      headers: serviceRoleKey
        ? {
            authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          }
        : {},
    });

    if (!upstreamRes.ok) {
      return NextResponse.json(
        { error: "Не удалось получить файл из хранилища" },
        { status: upstreamRes.status }
      );
    }

    const arrayBuffer = await upstreamRes.arrayBuffer();
    return new NextResponse(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/epub+zip",
        "Content-Length": String(arrayBuffer.byteLength),
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    console.error("EPUB stream error:", error);
    return NextResponse.json(
      { error: "Внутренняя ошибка сервера" },
      { status: 500 }
    );
  }
}
