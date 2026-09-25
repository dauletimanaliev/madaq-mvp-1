import { NextRequest, NextResponse } from "next/server";
import { getMeta, renderPageAsImage } from "unpdf";
import fs from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { parseBookText, normalizeContent } from "@/lib/books/parser";
import type { ParsedBook } from "@/lib/books/parser";
import { extractPdfWithFormatting } from "@/lib/books/pdf-formatter";

export const maxDuration = 60; // allow up to 60s for large PDFs

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яё-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

function parseFilenameInfo(fileName: string): { title?: string; author?: string } {
  let clean = fileName.replace(/\.[^.]+$/, "");
  // Strip common downloader prefixes
  clean = clean.replace(/^(_?oceanofpdf(\.com)?_?|\[.*?\]|\(.*?\))\s*/i, "").trim();
  // Strip trailing page/edition suffixes like -340-1 or (z-lib)
  clean = clean.replace(/[-_]\d+[-_]\d+$/, "").replace(/\s*\(.*?\)$/, "").trim();

  // Split on " - " or " _-_ "
  const parts = clean.split(/\s*[-—]\s*/);
  if (parts.length >= 2) {
    const p1 = parts[0].replace(/[_-]+/g, " ").trim();
    const p2 = parts[1].replace(/[_-]+/g, " ").trim();
    return { title: p1, author: p2 };
  }

  return { title: clean.replace(/[_-]+/g, " ").trim() };
}

export async function POST(request: NextRequest) {
  // Ensure the user is authenticated
  let userId: string;
  try {
    userId = await getCurrentUserId();
  } catch {
    return NextResponse.json(
      { error: "Не авторизован" },
      { status: 401 }
    );
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const titleOverride = formData.get("title") as string | null;
  const authorOverride = formData.get("author") as string | null;

  if (!file) {
    return NextResponse.json(
      { error: "Файл не загружен" },
      { status: 400 }
    );
  }

  // Validate file type
  const allowedTypes = [
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
  ];
  if (
    !allowedTypes.includes(file.type) &&
    !file.name.endsWith(".pdf") &&
    !file.name.endsWith(".txt") &&
    !file.name.endsWith(".md") &&
    !file.name.endsWith(".json")
  ) {
    return NextResponse.json(
      { error: "Поддерживаемые форматы: PDF, TXT, MD, JSON" },
      { status: 400 }
    );
  }

  // Max 50 MB
  if (file.size > 50 * 1024 * 1024) {
    return NextResponse.json(
      { error: "Файл слишком большой (макс. 50 МБ)" },
      { status: 400 }
    );
  }

  try {
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);
    let rawText: string;
    let pdfTitle: string | undefined;
    let pdfAuthor: string | undefined;
    let coverBuffer: ArrayBuffer | null = null;

    const ext = file.name.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf" || file.type === "application/pdf";

    if (isPdf) {
      // 1. Render cover image from page 1 using fresh Uint8Array
      try {
        coverBuffer = await renderPageAsImage(
          Uint8Array.from(fileBuffer),
          1,
          {
            width: 500,
            canvasImport: () => import("@napi-rs/canvas"),
          }
        );
      } catch (coverErr) {
        console.error("Cover rendering error (page 1):", coverErr);
      }

      // 2. Try to get title & author from PDF metadata
      try {
        const { info } = await getMeta(Uint8Array.from(fileBuffer));
        if (info?.Title) {
          pdfTitle = String(info.Title);
        }
        if (info?.Author) {
          pdfAuthor = String(info.Author);
        }
      } catch {
        // Metadata extraction is optional
      }

      // 3. Extract text with true font resolution (bold, italic, headings, chapter labels)
      rawText = await extractPdfWithFormatting(Uint8Array.from(fileBuffer));
    } else {
      rawText = fileBuffer.toString("utf-8");
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "Не удалось извлечь текст из файла. Возможно, PDF содержит только изображения (сканы).",
        },
        { status: 422 }
      );
    }

    const filenameInfo = parseFilenameInfo(file.name);
    const defaultTitle =
      titleOverride ||
      pdfTitle ||
      filenameInfo.title ||
      file.name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");

    let parsedBook: ParsedBook;

    if (ext === "json") {
      const jsonData = JSON.parse(rawText);
      if (Array.isArray(jsonData)) {
        parsedBook = {
          title: defaultTitle,
          chapters: jsonData.map(
            (
              item: { number?: number; title?: string; content?: string },
              idx: number
            ) => ({
              number: item.number ?? idx + 1,
              title: item.title || null,
              content: normalizeContent(item.content || ""),
            })
          ),
        };
      } else {
        parsedBook = {
          title: jsonData.title || defaultTitle,
          author: jsonData.author,
          description: jsonData.description,
          chapters: (jsonData.chapters || []).map(
            (
              item: { number?: number; title?: string; content?: string },
              idx: number
            ) => ({
              number: item.number ?? idx + 1,
              title: item.title || null,
              content: normalizeContent(item.content || ""),
            })
          ),
        };
      }
    } else {
      parsedBook = parseBookText(rawText, defaultTitle);
    }

    if (!parsedBook.chapters || parsedBook.chapters.length === 0) {
      return NextResponse.json(
        { error: "Не удалось разбить текст на главы." },
        { status: 422 }
      );
    }

    const title = titleOverride || parsedBook.title || defaultTitle;
    const authorName =
      authorOverride ||
      pdfAuthor ||
      parsedBook.author ||
      filenameInfo.author ||
      "Неизвестный автор";
    const bookId = `book_${slugify(title)}_${Math.random().toString(36).substring(2, 7)}`;

    // Find or create author
    let author = await prisma.author.findFirst({
      where: { name: authorName },
    });

    if (!author) {
      author = await prisma.author.create({
        data: { name: authorName },
      });
    }

    // Save cover image if generated
    let coverUrl: string | null = null;
    if (coverBuffer) {
      try {
        const coversDir = path.join(process.cwd(), "public", "covers");
        await fs.mkdir(coversDir, { recursive: true });
        const coverPath = path.join(coversDir, `${bookId}.png`);
        await fs.writeFile(coverPath, Buffer.from(coverBuffer as ArrayBuffer));
        coverUrl = `/covers/${bookId}.png`;

        // If Supabase service role key is present, upload to Supabase Storage as well
        const supabaseUrl =
          process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
        const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (serviceRoleKey) {
          try {
            const res = await fetch(
              `${supabaseUrl}/storage/v1/object/book-covers/${bookId}/cover.png`,
              {
                method: "POST",
                headers: {
                  authorization: `Bearer ${serviceRoleKey}`,
                  apikey: serviceRoleKey,
                  "content-type": "image/png",
                  "x-upsert": "true",
                },
                body: Buffer.from(coverBuffer as ArrayBuffer),
              }
            );
            if (res.ok) {
              coverUrl = `${supabaseUrl}/storage/v1/object/public/book-covers/${bookId}/cover.png`;
            }
          } catch (storageErr) {
            console.warn("Supabase cover upload fallback:", storageErr);
          }
        }
      } catch (saveErr) {
        console.error("Cover saving failed (non-critical):", saveErr);
      }
    }

    // Create book
    const book = await prisma.book.create({
      data: {
        id: bookId,
        title,
        description: parsedBook.description || null,
        coverUrl,
        language: "ru",
        authorId: author.id,
      },
    });

    // Create chapters
    await prisma.chapter.createMany({
      data: parsedBook.chapters.map((ch) => ({
        bookId: book.id,
        number: ch.number,
        title: ch.title,
        content: ch.content,
      })),
    });

    const totalChars = parsedBook.chapters.reduce(
      (sum: number, ch: { content: string }) => sum + ch.content.length,
      0
    );

    return NextResponse.json({
      bookId: book.id,
      title: book.title,
      author: author.name,
      chaptersCount: parsedBook.chapters.length,
      totalChars,
    });
  } catch (error) {
    console.error("Book upload error:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Произошла ошибка при обработке файла.",
      },
      { status: 500 }
    );
  }
}
