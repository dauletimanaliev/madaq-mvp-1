import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { renderPageAsImage, extractText, getMeta } from "unpdf";
import { prisma } from "@/lib/db/prisma";
import { parseBookText, normalizeContent } from "@/lib/books/parser";
import type { ParsedBook } from "@/lib/books/parser";
import { extractPdfWithFormatting } from "@/lib/books/pdf-formatter";
import { linearizePdf } from "@/lib/books/linearizer";
import { validateEpubBytes, parseEpubMetadata } from "@/lib/books/epub-parser";
import type { EpubMetadata } from "@/lib/books/epub-parser";
import { extractEpubCover } from "@/lib/books/epub-cover";

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
): Promise<{ title: string; author: string; totalPages: number }> {
  let detectedTitle: string | undefined;
  let detectedAuthor: string | undefined;
  let totalPages = 0;

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
    if (!totalPages && typeof textRes.totalPages === "number") {
      totalPages = textRes.totalPages;
    }
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
    totalPages,
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
  coverKey: string,
  coverBuffer: ArrayBuffer | Buffer,
  contentType: string = "image/png",
  fileExt: string = "png"
): Promise<string | null> {
  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, cover upload skipped");
    return null;
  }

  try {
    const cleanExt = fileExt.replace(/^\./, "");
    const filePath = coverKey.endsWith(`.${cleanExt}`) ? coverKey : `${coverKey}.${cleanExt}`;
    const buf = Buffer.isBuffer(coverBuffer)
      ? coverBuffer
      : Buffer.from(coverBuffer as ArrayBuffer);

    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/book-covers/${filePath}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": contentType,
          "x-upsert": "true",
        },
        body: new Uint8Array(buf),
      }
    );

    if (res.ok) {
      return `${supabaseUrl}/storage/v1/object/public/book-covers/${filePath}`;
    }

    const errText = await res.text();
    console.error(`Supabase cover upload failed (${res.status}):`, errText);
    return null;
  } catch (err) {
    console.error("Supabase cover upload error:", err);
    return null;
  }
}

// ─── Upload original EPUB to Supabase Storage ──────────────────────────────
async function uploadEpubToSupabase(
  fileHashSha256: string,
  epubBuffer: Buffer
): Promise<string | null> {
  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, EPUB upload skipped");
    return null;
  }

  try {
    const s3Path = `books/${fileHashSha256}.epub`;
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/book-epubs/${s3Path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": "application/epub+zip",
          "x-upsert": "true",
        },
        body: new Uint8Array(epubBuffer),
      }
    );

    if (res.ok) {
      return s3Path;
    }

    const errText = await res.text();
    console.error(`Supabase EPUB upload failed (${res.status}):`, errText);
    return null;
  } catch (err) {
    console.error("Supabase EPUB upload error:", err);
    return null;
  }
}

// ─── Upload original PDF to Supabase Storage (ТЗ §1, §2) ───────────────────
async function uploadPdfToSupabase(
  fileHashSha256: string,
  pdfBuffer: Buffer
): Promise<string | null> {
  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey) {
    console.warn("SUPABASE_SERVICE_ROLE_KEY not set, PDF upload skipped");
    return null;
  }

  try {
    const s3Path = `books/${fileHashSha256}.pdf`;
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/book-pdfs/${s3Path}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": "application/pdf",
          "x-upsert": "true",
        },
        body: new Uint8Array(pdfBuffer),
      }
    );

    if (res.ok) {
      return `book-pdfs/${s3Path}`;
    }

    const errText = await res.text();
    console.error(`Supabase PDF upload failed (${res.status}):`, errText);
    return null;
  } catch (err) {
    console.error("Supabase PDF upload error:", err);
    return null;
  }
}

// ─── Main POST handler ────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
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
    const isEpub = ext === "epub";

    // 1. Валидация магических байт для PDF и EPUB (ТЗ §1)
    if (isPdf) {
      const magicBytes = fileBuffer.subarray(0, 4).toString("ascii");
      if (!magicBytes.startsWith("%PDF")) {
        return NextResponse.json(
          { error: "Файл поврежден или не является корректным PDF (отсутствует сигнатура %PDF)" },
          { status: 400 }
        );
      }
    } else if (isEpub) {
      if (!validateEpubBytes(fileBuffer)) {
        return NextResponse.json(
          { error: "Файл поврежден или не является корректным EPUB (неверный ZIP-заголовок)" },
          { status: 400 }
        );
      }
    }

    // 2. Расчет SHA-256 хеша для дедупликации (ТЗ §1)
    const fileHashSha256 = crypto
      .createHash("sha256")
      .update(fileBuffer)
      .digest("hex");

    // 3. Дедупликация: проверяем, загружался ли уже такой файл (ТЗ §1)
    const existingBook = await prisma.book.findUnique({
      where: { fileHashSha256 },
      include: {
        author: true,
        chapters: { select: { id: true, content: true } },
      },
    });

    if (existingBook) {
      console.log(
        `⚡ [Дедупликация] Книга уже существует (SHA-256: ${fileHashSha256}) -> bookId: ${existingBook.id}`
      );

      // Удаляем временный файл из хранилища, если он был загружен
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

      const totalChars = existingBook.chapters.reduce(
        (sum, ch) => sum + ch.content.length,
        0
      );

      return NextResponse.json({
        bookId: existingBook.id,
        title: existingBook.title,
        author: existingBook.author.name,
        chaptersCount: existingBook.chapters.length,
        totalChars,
        coverUrl: existingBook.coverUrl,
        isDuplicate: true,
      });
    }

    // 4. Регистрация задания в upload_jobs (ТЗ §1, §5)
    let uploadJob: { id: string } | null = null;
    try {
      uploadJob = await prisma.uploadJob.create({
        data: {
          fileName,
          fileSize: fileBuffer.length,
          status: "PROCESSING",
          step: 1,
          stepText: "Файл валидирован, извлечение метаданных и обложки...",
        },
      });
    } catch (jobErr) {
      console.warn("UploadJob creation error:", jobErr);
    }

    // ─── EPUB Ingestion Pipeline ─────────────────────────────────────────────
    if (isEpub) {
      // Удаляем временный файл из хранилища, если он был загружен
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

      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            step: 2,
            stepText: "Извлечение метаданных и обложки из EPUB...",
          },
        }).catch(() => {});
      }

      let epubMeta: EpubMetadata;
      try {
        epubMeta = parseEpubMetadata(fileBuffer);
      } catch (parseErr) {
        console.warn("EPUB metadata parse warning:", parseErr);
        epubMeta = { opfPath: "" };
      }

      const fnInfo = parseFilename(fileName);
      const title =
        epubMeta.title && !isGarbageTitle(epubMeta.title)
          ? epubMeta.title.trim()
          : fnInfo.title || fileName.replace(/\.[^.]+$/, "");
      const authorName =
        epubMeta.author && !isGarbageAuthor(epubMeta.author)
          ? epubMeta.author.trim()
          : fnInfo.author || "Белгісіз автор";
      const description = epubMeta.description || null;
      const language = epubMeta.language || "ru";

      // Извлечение оригинальной обложки (без конвертации в PNG)
      let coverUrl: string | null = null;
      try {
        const extractedCover = extractEpubCover(fileBuffer, epubMeta.coverItem);
        if (extractedCover) {
          coverUrl = await uploadCoverToSupabase(
            fileHashSha256,
            extractedCover.buffer,
            extractedCover.mimeType,
            extractedCover.extension
          );
        }
      } catch (coverErr) {
        console.warn("EPUB cover extraction error:", coverErr);
      }

      // Сохранение оригинального EPUB в Supabase Storage
      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            step: 3,
            stepText: "Сохранение исходного EPUB в хранилище...",
          },
        }).catch(() => {});
      }

      const epubStorageKey = await uploadEpubToSupabase(fileHashSha256, fileBuffer);

      // Поиск или создание автора
      let author = await prisma.author.findFirst({
        where: { name: authorName },
      });
      if (!author) {
        author = await prisma.author.create({
          data: { name: authorName },
        });
      }

      const randomSuffix = Math.random().toString(36).substring(2, 7);
      const asciiSlug = safeStorageKey(title).replace(/-/g, "_") || "book";
      const bookId = `book_${asciiSlug}_${randomSuffix}`;

      // Создание записи Book (формат EPUB, без Chapter / BookPage)
      const book = await prisma.book.create({
        data: {
          id: bookId,
          title,
          description,
          coverUrl,
          language,
          authorId: author.id,
          fileHashSha256,
          fileSizeBytes: fileBuffer.length,
          totalPages: 0,
          contentFormat: "EPUB",
          epubStorageKey,
        },
      });

      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            status: "SUCCESS",
            step: 5,
            stepText: "EPUB книга успешно сохранена",
            bookId: book.id,
          },
        }).catch(() => {});
      }

      console.log(
        `✅ EPUB Book "${title}" by "${authorName}" created: cover: ${coverUrl ? "✅" : "❌"}, Storage: ${epubStorageKey ? "✅" : "❌"}`
      );

      return NextResponse.json({
        jobId: uploadJob?.id,
        bookId: book.id,
        title: book.title,
        author: author.name,
        chaptersCount: 0,
        totalChars: 0,
        coverUrl: book.coverUrl,
        fileHashSha256,
        totalPages: 0,
        contentFormat: "EPUB",
        epubStorageKey: book.epubStorageKey,
      });
    }

    let rawText: string;
    let title: string;
    let authorName: string;
    let coverBuffer: ArrayBuffer | null = null;
    let totalPages = 0;
    let isLinearized = false;
    let finalPdfBuffer = fileBuffer;
    let pageTexts: string[] = [];

    if (isPdf) {
      // 1. Render Cover from Page 1 (Thumbnail)
      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            step: 2,
            stepText: "Генерация обложки (Thumbnail) из первой страницы...",
          },
        }).catch(() => {});
      }

      try {
        const coverData = new Uint8Array(new Uint8Array(fileBuffer));
        coverBuffer = await renderPageAsImage(coverData, 1, {
          width: 600,
          canvasImport: () => import("@napi-rs/canvas"),
        });
      } catch (coverErr) {
        console.error("Cover rendering error (page 1):", coverErr);
      }

      // 2. 100% Automatic smart title, author & pages detection
      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            step: 3,
            stepText: "Извлечение метаданных и форматированного текста...",
          },
        }).catch(() => {});
      }

      const metaResult = await extractMetadataFromPdf(
        new Uint8Array(new Uint8Array(fileBuffer)),
        fileName
      );
      title = metaResult.title;
      authorName = metaResult.author;
      totalPages = metaResult.totalPages;

      // 3. Extract page-by-page text for in-book search index
      try {
        const textCopy = new Uint8Array(new Uint8Array(fileBuffer));
        const pagesRes = await extractText(textCopy, { mergePages: false });
        if (pagesRes.text && Array.isArray(pagesRes.text)) {
          pageTexts = pagesRes.text;
        }
      } catch (pagesErr) {
        console.warn("Could not extract page texts:", pagesErr);
      }

      // 4. Linearize PDF using qpdf --linearize (Fast Web View, ТЗ §1, §2)
      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            step: 4,
            stepText: "Линеаризация PDF (Fast Web View через qpdf)...",
          },
        }).catch(() => {});
      }

      const linResult = await linearizePdf(fileBuffer);
      finalPdfBuffer = linResult.buffer;
      isLinearized = linResult.isLinearized;

      // 5. Extract full formatted text for reader
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
      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            status: "FAILED",
            errorLog: "Не удалось извлечь текст (отсканированный PDF)",
          },
        }).catch(() => {});
      }

      return NextResponse.json(
        {
          error:
            "Не удалось извлечь текст из файла. Возможно, PDF содержит только отсканированные изображения без текстового слоя.",
        },
        { status: 422 }
      );
    }

    console.log(`📖 Auto-detected: title="${title}", author="${authorName}", pages=${totalPages}`);

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
      if (uploadJob) {
        await prisma.uploadJob.update({
          where: { id: uploadJob.id },
          data: {
            status: "FAILED",
            errorLog: "Не удалось разбить текст на главы",
          },
        }).catch(() => {});
      }

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

    // Step 5: Upload original/linearized PDF & cover to storage
    if (uploadJob) {
      await prisma.uploadJob.update({
        where: { id: uploadJob.id },
        data: {
          step: 5,
          stepText: "Сохранение исходного PDF и обложки в хранилище...",
        },
      }).catch(() => {});
    }

    // Upload cover to Supabase Storage (ТЗ §1: book-covers/${fileHashSha256}.png)
    let coverUrl: string | null = null;
    if (coverBuffer) {
      coverUrl = await uploadCoverToSupabase(fileHashSha256, coverBuffer);
    }

    // Upload linearized PDF to Supabase Storage (ТЗ §1, §2: book-pdfs/books/${fileHashSha256}.pdf)
    let storageS3Key: string | null = null;
    if (isPdf) {
      storageS3Key = await uploadPdfToSupabase(fileHashSha256, finalPdfBuffer);
    }

    // Create book record with Ingestion Pipeline fields
    const book = await prisma.book.create({
      data: {
        id: bookId,
        title,
        description: parsedBook.description || null,
        coverUrl,
        language: "ru",
        authorId: author.id,
        fileHashSha256,
        fileSizeBytes: finalPdfBuffer.length,
        totalPages: totalPages > 0 ? totalPages : parsedBook.chapters.length,
        isLinearized,
        storageS3Key,
        contentFormat: isPdf ? "PDF" : "TEXT",
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

    // Create page-by-page text index for fast in-book search (ТЗ §4)
    if (pageTexts.length > 0) {
      await prisma.bookPage.createMany({
        data: pageTexts.map((pgContent, idx) => ({
          bookId: book.id,
          pageNumber: idx + 1,
          content: pgContent.trim() || `[Страница ${idx + 1}]`,
        })),
      });
      console.log(`📑 [Индекс страниц] Сохранено ${pageTexts.length} страниц для книги «${title}»`);
    }

    const totalChars = parsedBook.chapters.reduce(
      (sum: number, ch: { content: string }) => sum + ch.content.length,
      0
    );

    // Complete upload job
    if (uploadJob) {
      await prisma.uploadJob.update({
        where: { id: uploadJob.id },
        data: {
          status: "SUCCESS",
          step: 5,
          stepText: "Книга успешно сохранена",
          bookId: book.id,
        },
      }).catch(() => {});
    }

    console.log(
      `✅ Book "${title}" by "${authorName}" created: ${parsedBook.chapters.length} chapters, pages: ${totalPages || parsedBook.chapters.length}, cover: ${coverUrl ? "✅" : "❌"}, PDF S3: ${storageS3Key ? "✅" : "❌"}`
    );

    return NextResponse.json({
      jobId: uploadJob?.id,
      bookId: book.id,
      title: book.title,
      author: author.name,
      chaptersCount: parsedBook.chapters.length,
      totalChars,
      coverUrl,
      fileHashSha256,
      totalPages: book.totalPages,
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
