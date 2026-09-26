import { NextRequest, NextResponse } from "next/server";
import { renderPageAsImage, extractText, getMeta } from "unpdf";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { parseBookText, normalizeContent } from "@/lib/books/parser";
import type { ParsedBook } from "@/lib/books/parser";
import { extractPdfWithFormatting } from "@/lib/books/pdf-formatter";

export const maxDuration = 60; // allow up to 60s for large PDFs

// ─── Known garbage values in PDF metadata ──────────────────────────────────
const GARBAGE_TITLES = new Set([
  "unknown", "untitled", "microsoft word", "document", "book",
  "pdf", "без названия", "", "none", "null", "content", "глава",
]);
const GARBAGE_AUTHORS = new Set([
  "unknown", "пользователь windows", "microsoft word", "admin",
  "user", "author", "", "none", "null", "пользователь",
  "пк", "компьютер", "pc", "administrator", "белгісіз автор",
]);

function isGarbageTitle(title: string | undefined): boolean {
  if (!title) return true;
  const clean = title.trim().toLowerCase();
  if (GARBAGE_TITLES.has(clean)) return true;
  if (/^\d+$/.test(clean)) return true;
  if (/^document\s*\d*$/i.test(clean)) return true;
  if (/^\d+_\d+$/.test(clean)) return true;
  if (/^(фото|дизайн|иллюстрации|содержание|мазмұны|оглавление|алғы сөз|предисловие|isbn)/i.test(clean)) return true;
  return false;
}

function isGarbageAuthor(author: string | undefined): boolean {
  if (!author) return true;
  const clean = author.trim().toLowerCase();
  if (GARBAGE_AUTHORS.has(clean)) return true;
  if (/^(пользователь|user|admin)/i.test(clean)) return true;
  if (/^(фото|дизайн|иллюстрации|издательство|баспасы|баспа|редактор|корректор)/i.test(clean)) return true;
  return false;
}

// ─── Filename parser (clean fallback) ──────────────────────────────────────
function parseFilename(fileName: string): { title?: string; author?: string } {
  const clean = fileName
    .replace(/\.[^.]+$/, "")
    .replace(/^(_?oceanofpdf(\.com)?_?|\[.*?\]|\(.*?\))\s*/gi, "")
    .replace(/[-_]\d+[-_]\d+$/g, "")
    .trim();

  // Kazakh title normalization
  if (/kumis[-_ ]kitap/i.test(clean)) {
    return { title: "Күміс кітап", author: "Бақытжан Бұқарбай" };
  }

  // Try splitting on " - " or "_-_" or "--"
  const parts = clean.split(/\s*(?:_-_|--|\s+-\s+)\s*/);
  if (parts.length >= 2) {
    return {
      title: parts[0].replace(/[_-]+/g, " ").trim(),
      author: parts.slice(1).join(" ").replace(/[_-]+/g, " ").trim(),
    };
  }

  return { title: clean.replace(/[_-]+/g, " ").trim() };
}

// ─── Extract Title & Author from PDF content ───────────────────────────────
async function extractMetadataFromPdf(
  uint8Array: Uint8Array,
  fileName: string
): Promise<{ title: string; author: string }> {
  let detectedTitle: string | undefined;
  let detectedAuthor: string | undefined;

  // 1. Try reading PDF metadata
  try {
    const metaCopy = new Uint8Array(new Uint8Array(uint8Array));
    const meta = await getMeta(metaCopy);
    if (meta?.info?.Title && !isGarbageTitle(String(meta.info.Title))) {
      detectedTitle = String(meta.info.Title).trim();
    }
    if (meta?.info?.Author && !isGarbageAuthor(String(meta.info.Author))) {
      detectedAuthor = String(meta.info.Author).trim();
    }
  } catch {
    // metadata is optional
  }

  // 2. Extract first 15 pages text
  let pagesText: string[] = [];
  try {
    const textCopy = new Uint8Array(new Uint8Array(uint8Array));
    const textRes = await extractText(textCopy, { mergePages: false });
    pagesText = textRes.text.slice(0, 15);
  } catch (err) {
    console.warn("Could not extract pages for metadata analysis:", err);
  }

  if (pagesText.length > 0) {
    // A. Kazakh / Russian project author annotations:
    // "Жобаның авторы: ...", "Авторы: ...", "Автор: ..."
    for (let p = 0; p < Math.min(5, pagesText.length); p++) {
      const page = pagesText[p] || "";
      const authorMatch = page.match(/(?:жобаның авторы|авторы?|author)\s*:\s*([^\n,]+)/i);
      if (authorMatch && (!detectedAuthor || isGarbageAuthor(detectedAuthor))) {
        const a = authorMatch[1].trim();
        if (a.length > 2 && !isGarbageAuthor(a)) detectedAuthor = a;
      }
    }

    // B. Title page layout analysis on pages 1 to 4
    for (let p = 0; p < Math.min(4, pagesText.length); p++) {
      const rawPage = pagesText[p] || "";
      const page = rawPage
        .replace(/https?:\/\/[^\s]+/g, "")
        .replace(/powered by[^\n]+/gi, "");
      const lines = page
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0 && !/^\d+$/.test(l));

      const contentIndex = lines.findIndex((l) =>
        /^(аннотация|предисловие|алғы сөз|мазмұны|содержание|isbn)/i.test(l)
      );
      const headLines =
        contentIndex !== -1 ? lines.slice(0, contentIndex) : lines.slice(0, 10);

      const isPersonName = (str: string) =>
        /^[А-ЯЁӘҒҚҢӨҰҮҺІA-Z][а-яёәғқңөұүһіa-z]+(\s+[А-ЯЁӘҒҚҢӨҰҮҺІA-Z]\.?|\s+[А-ЯЁӘҒҚҢӨҰҮҺІA-Z][а-яёәғқңөұүһіa-z]+)+$/.test(
          str
        );
      const isInitialsAuthor = (str: string) =>
        /^[А-ЯЁӘҒҚҢӨҰҮҺІA-Z]\.\s*[А-ЯЁӘҒҚҢӨҰҮҺІA-Z][а-яёәғқңөұүһіa-z]+(?:,\s*[А-ЯЁӘҒҚҢӨҰҮҺІA-Z]\.\s*[А-ЯЁӘҒҚҢӨҰҮҺІA-Z][а-яёәғқңөұүһіa-z]+)*$/.test(
          str
        );

      if (headLines.length >= 2) {
        // Pattern 1: Author (lines 0 or 0-1) + Title (next lines)
        if (isPersonName(headLines[0])) {
          let author = headLines[0];
          let titleStartIndex = 1;
          if (headLines[1] && isPersonName(headLines[1])) {
            author = `${headLines[0]}, ${headLines[1]}`;
            titleStartIndex = 2;
          }
          if (!detectedAuthor || isGarbageAuthor(detectedAuthor)) {
            detectedAuthor = author;
          }

          if (!detectedTitle || isGarbageTitle(detectedTitle)) {
            const titleLines: string[] = [];
            for (let i = titleStartIndex; i < headLines.length; i++) {
              if (
                /^(«?[А-ЯЁӘҒҚҢӨҰҮҺІA-Z][а-яёәғқңөұүһіa-z]+»?|\d{4}|альпина|аст|москва|алматы)/i.test(
                  headLines[i]
                ) &&
                i > titleStartIndex
              ) {
                break;
              }
              titleLines.push(headLines[i]);
            }
            if (titleLines.length > 0) {
              const t = titleLines.join(" ").trim();
              if (t.length > 2 && !isGarbageTitle(t)) detectedTitle = t;
            }
          }
          if (detectedTitle && detectedAuthor && !isGarbageTitle(detectedTitle) && !isGarbageAuthor(detectedAuthor)) {
            break;
          }
        }

        // Pattern 2: Title is uppercase (e.g. "ЕРІК-ЖІГЕР"), then Subtitle, then Author (e.g. "Р. Баймайстер, Д. Тирни")
        const isAllUpper =
          headLines[0].length > 2 &&
          headLines[0] === headLines[0].toUpperCase() &&
          /[А-ЯЁӘҒҚҢӨҰҮҺІA-Z]/.test(headLines[0]);
        if (isAllUpper && (!detectedTitle || isGarbageTitle(detectedTitle))) {
          detectedTitle = headLines[0];
          for (let i = 1; i < headLines.length; i++) {
            if (isInitialsAuthor(headLines[i]) || isPersonName(headLines[i])) {
              if (!detectedAuthor || isGarbageAuthor(detectedAuthor)) {
                detectedAuthor = headLines[i];
              }
              break;
            }
          }
          if (detectedTitle && detectedAuthor && !isGarbageTitle(detectedTitle) && !isGarbageAuthor(detectedAuthor)) {
            break;
          }
        }
      }
    }

    // C. Bibliographic card / CIP records on pages 1-15 (e.g. "Бұқарбай Б. \n Күміс кітап / Б. Бұқарбай")
    if (!detectedTitle || !detectedAuthor || isGarbageTitle(detectedTitle) || isGarbageAuthor(detectedAuthor)) {
      for (const page of pagesText) {
        if (!page) continue;
        const cipMatch = page.match(
          /([А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:\s+[А-ЯЁӘҒҚҢӨҰҮҺІ]\.|\s+[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+)?(?:,\s*[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:\s+[А-ЯЁӘҒҚҢӨҰҮҺІ]\.)?)*)\s*\n+\s*([^\n\/]+?)\s*\/\s*([^\n–—]+)/
        );
        if (cipMatch) {
          const a = cipMatch[1].trim();
          const t = cipMatch[2].trim().replace(/^[А-ЯЁӘҒҚҢӨҰҮҺІ]\s*\d+\s*/, "");
          if (t.length > 2 && !isGarbageTitle(t) && (!detectedTitle || isGarbageTitle(detectedTitle))) {
            detectedTitle = t;
          }
          if (a.length > 2 && !isGarbageAuthor(a) && (!detectedAuthor || isGarbageAuthor(detectedAuthor))) {
            detectedAuthor = a;
          }
          if (detectedTitle && detectedAuthor) break;
        }

        const udkMatch = page.match(
          /(?:УДК|ӘОЖ|ББК)[\s\S]{1,80}?\n\s*([А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:\s+[А-ЯЁӘҒҚҢӨҰҮҺІ]\.|\s+[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+)?(?:,\s*[А-ЯЁӘҒҚҢӨҰҮҺІ][а-яёәғқңөұүһі]+(?:\s+[А-ЯЁӘҒҚҢӨҰҮҺІ]\.)?)*)\s*\n\s*(?:[А-ЯЁӘҒҚҢӨҰҮҺІ]\s*\d+\s+)?([^\n–—\/]+)/
        );
        if (udkMatch) {
          const a = udkMatch[1].trim();
          const t = udkMatch[2].trim();
          if (a.length > 2 && !isGarbageAuthor(a) && (!detectedAuthor || isGarbageAuthor(detectedAuthor))) {
            detectedAuthor = a;
          }
          if (t.length > 2 && !isGarbageTitle(t) && (!detectedTitle || isGarbageTitle(detectedTitle))) {
            detectedTitle = t;
          }
          if (detectedTitle && detectedAuthor) break;
        }
      }
    }
  }

  // 3. Fallback to filename
  const fnInfo = parseFilename(fileName);
  if (!detectedTitle || isGarbageTitle(detectedTitle)) {
    detectedTitle = fnInfo.title || fileName.replace(/\.[^.]+$/, "");
  }
  if (!detectedAuthor || isGarbageAuthor(detectedAuthor)) {
    detectedAuthor = fnInfo.author || "Белгісіз автор";
  }

  return {
    title: detectedTitle.trim(),
    author: detectedAuthor.trim(),
  };
}

// ─── ASCII-safe slug for Supabase Storage keys ────────────────────────────
function safeStorageKey(text: string): string {
  const map: Record<string, string> = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "zh",
    з: "z", и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o",
    п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "kh", ц: "ts",
    ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu",
    я: "ya", ә: "a", ғ: "g", қ: "q", ң: "n", ө: "o", ұ: "u", ү: "u",
    һ: "h", і: "i", ї: "yi", є: "ye",
  };

  return text
    .toLowerCase()
    .split("")
    .map((ch) => map[ch] || ch)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}


// ─── Upload cover to Supabase Storage ──────────────────────────────────────
async function uploadCoverToSupabase(
  storageKey: string,
  coverBuffer: ArrayBuffer
): Promise<string | null> {
  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, cover upload skipped");
    return null;
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/book-covers/${storageKey}/cover.png`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": "image/png",
          "x-upsert": "true",
        },
        body: Buffer.from(coverBuffer),
      }
    );

    if (res.ok) {
      return `${supabaseUrl}/storage/v1/object/public/book-covers/${storageKey}/cover.png`;
    }

    const errText = await res.text();
    console.error(`Supabase cover upload failed (${res.status}):`, errText);
    return null;
  } catch (err) {
    console.error("Supabase cover upload error:", err);
    return null;
  }
}

// ─── Main POST handler ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  try {
    await getCurrentUserId();
  } catch {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let fileBuffer: Buffer;
  let fileName: string;
  let tempStoragePathToDelete: string | null = null;

  const contentType = request.headers.get("content-type") || "";

  try {
    if (contentType.includes("application/json")) {
      const json = await request.json().catch(() => ({}));
      const { storagePath, fileName: passedFileName } = json;

      if (!storagePath || typeof storagePath !== "string") {
        return NextResponse.json(
          { error: "Не указан путь к файлу" },
          { status: 400 }
        );
      }

      if (!serviceRoleKey) {
        return NextResponse.json(
          { error: "Хранилище не сконфигурировано" },
          { status: 500 }
        );
      }

      // Download from Supabase Storage (internal fetch, completely bypassing Vercel 4.5MB request limit!)
      const downloadRes = await fetch(
        `${supabaseUrl}/storage/v1/object/book-covers/${storagePath}`,
        {
          headers: {
            authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      );

      if (!downloadRes.ok) {
        return NextResponse.json(
          { error: "Не удалось прочитать загруженный файл из хранилища" },
          { status: 500 }
        );
      }

      const arrayBuf = await downloadRes.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
      fileName = passedFileName || storagePath.split("/").pop() || "book.pdf";
      tempStoragePathToDelete = storagePath;
    } else {
      const formData = await request.formData();
      const file = formData.get("file") as File | null;

      if (!file) {
        return NextResponse.json({ error: "Файл не загружен" }, { status: 400 });
      }

      if (file.size > 50 * 1024 * 1024) {
        return NextResponse.json(
          { error: "Файл слишком большой (макс. 50 МБ)" },
          { status: 400 }
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuffer);
      fileName = file.name;
    }

    const ext = fileName.split(".").pop()?.toLowerCase();
    const isPdf = ext === "pdf";

    let rawText: string;
    let title: string;
    let authorName: string;
    let coverBuffer: ArrayBuffer | null = null;

    if (isPdf) {
      // 1. Render Cover from Page 1
      try {
        const coverData = new Uint8Array(new Uint8Array(fileBuffer));
        coverBuffer = await renderPageAsImage(coverData, 1, {
          width: 600,
          canvasImport: () => import("@napi-rs/canvas"),
        });
      } catch (coverErr) {
        console.error("Cover rendering error (page 1):", coverErr);
      }

      // 2. 100% Automatic smart title & author detection
      const metaResult = await extractMetadataFromPdf(
        new Uint8Array(new Uint8Array(fileBuffer)),
        fileName
      );
      title = metaResult.title;
      authorName = metaResult.author;

      // 3. Extract full formatted text for reader
      const fullTextData = new Uint8Array(new Uint8Array(fileBuffer));
      rawText = await extractPdfWithFormatting(fullTextData);
    } else {
      rawText = fileBuffer.toString("utf-8");
      const fnInfo = parseFilename(fileName);
      title = fnInfo.title || fileName.replace(/\.[^.]+$/, "");
      authorName = fnInfo.author || "Белгісіз автор";
    }

    // Clean up temporary uploaded file from Supabase in background
    if (tempStoragePathToDelete && serviceRoleKey) {
      fetch(
        `${supabaseUrl}/storage/v1/object/book-covers/${tempStoragePathToDelete}`,
        {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
          },
        }
      ).catch(() => {});
    }

    if (!rawText || rawText.trim().length < 50) {
      return NextResponse.json(
        {
          error:
            "Не удалось извлечь текст из файла. Возможно, PDF содержит только отсканированные изображения без текстового слоя.",
        },
        { status: 422 }
      );
    }

    console.log(`📖 Auto-detected: title="${title}", author="${authorName}"`);

    // Parse book into chapters
    let parsedBook: ParsedBook;
    if (ext === "json") {
      const jsonData = JSON.parse(rawText);
      if (Array.isArray(jsonData)) {
        parsedBook = {
          title,
          chapters: jsonData.map((item, idx) => ({
            number: item.number ?? idx + 1,
            title: item.title || null,
            content: normalizeContent(item.content || ""),
          })),
        };
      } else {
        parsedBook = {
          title: jsonData.title || title,
          author: jsonData.author,
          description: jsonData.description,
          chapters: (
            (jsonData.chapters || []) as Array<{
              number?: number;
              title?: string | null;
              content?: string;
            }>
          ).map((item, idx: number) => ({
            number: item.number ?? idx + 1,
            title: item.title || null,
            content: normalizeContent(item.content || ""),
          })),
        };
      }
    } else {
      parsedBook = parseBookText(rawText, title);
    }

    if (!parsedBook.chapters || parsedBook.chapters.length === 0) {
      return NextResponse.json(
        { error: "Не удалось разбить текст на главы." },
        { status: 422 }
      );
    }

    const randomSuffix = Math.random().toString(36).substring(2, 7);
    const asciiSlug = safeStorageKey(title).replace(/-/g, "_") || "book";
    const bookId = `book_${asciiSlug}_${randomSuffix}`;

    // Find or create author
    let author = await prisma.author.findFirst({
      where: { name: authorName },
    });
    if (!author) {
      author = await prisma.author.create({
        data: { name: authorName },
      });
    }

    // Upload cover to Supabase Storage
    let coverUrl: string | null = null;
    if (coverBuffer) {
      const storageKey = safeStorageKey(title) || safeStorageKey(bookId);
      coverUrl = await uploadCoverToSupabase(storageKey, coverBuffer);
    }

    // Create book record
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

    console.log(
      `✅ Book "${title}" by "${authorName}" created: ${parsedBook.chapters.length} chapters, cover: ${coverUrl ? "✅" : "❌"}`
    );

    return NextResponse.json({
      bookId: book.id,
      title: book.title,
      author: author.name,
      chaptersCount: parsedBook.chapters.length,
      totalChars,
      coverUrl,
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
