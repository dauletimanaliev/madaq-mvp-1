import { NextRequest, NextResponse } from "next/server";
import { extractText, getMeta } from "unpdf";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { parseBookText, normalizeContent } from "@/lib/books/parser";
import type { ParsedBook } from "@/lib/books/parser";

export const maxDuration = 60; // allow up to 60s for large PDFs

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яё-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
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
    let rawText: string;
    let pdfTitle: string | undefined;

    const ext = file.name.split(".").pop()?.toLowerCase();

    if (ext === "pdf" || file.type === "application/pdf") {
      // unpdf: serverless-friendly PDF text extraction
      const pdfData = new Uint8Array(arrayBuffer);

      const { text } = await extractText(pdfData, { mergePages: true });
      rawText = typeof text === "string" ? text : (text as string[]).join("\n");

      // Try to get title from PDF metadata
      try {
        const { info } = await getMeta(pdfData);
        if (info?.Title) {
          pdfTitle = String(info.Title);
        }
      } catch {
        // Metadata extraction is optional
      }
    } else {
      rawText = Buffer.from(arrayBuffer).toString("utf-8");
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

    // Parse into chapters
    const defaultTitle =
      titleOverride ||
      pdfTitle ||
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
      authorOverride || parsedBook.author || "Неизвестный автор";
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

    // Create book
    const book = await prisma.book.create({
      data: {
        id: bookId,
        title,
        description: parsedBook.description || null,
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
