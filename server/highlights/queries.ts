import crypto from "crypto";
import { Prisma, HighlightType as PrismaHighlightType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Highlight, HighlightType, PdfHighlightRect } from "@/lib/types";

type CreateHighlightInput = Omit<
  Highlight,
  "id" | "createdAt" | "type" | "legacyColor"
> & {
  type: HighlightType | null;
  chapterId: string;
  startPosition: number;
  endPosition: number;
};

export type HighlightNote = Highlight & {
  selectedText: string;
  bookTitle: string;
  chapterNumber?: number | null;
  chapterTitle?: string | null;
  pageNumber?: number | null;
};

function toHighlight(highlight: {
  id: string;
  bookId: string;
  chapterId?: string | null;
  startPosition?: number | null;
  endPosition?: number | null;
  pageNumber?: number | null;
  rects?: unknown;
  selectedText?: string | null;
  type: PrismaHighlightType | null;
  legacyColor?: string | null;
  cfi?: string | null;
  sectionHref?: string | null;
  sectionIndex?: number | null;
  textQuotePrefix?: string | null;
  textQuoteSuffix?: string | null;
  note?: string | null;
  createdAt: Date;
}): Highlight {
  return {
    ...highlight,
    rects: (highlight.rects as Prisma.JsonValue as PdfHighlightRect[] | null) ?? null,
    type: highlight.type as HighlightType | null,
    createdAt: highlight.createdAt.toISOString(),
  };
}

export async function listHighlights(
  userId: string,
  chapterId: string
): Promise<Highlight[]> {
  const highlights = await prisma.highlight.findMany({
    where: { userId, chapterId },
    orderBy: { startPosition: "asc" },
  });

  return highlights.map(toHighlight);
}

export async function listUserHighlights(
  userId: string,
  type?: HighlightType | "none"
): Promise<HighlightNote[]> {
  const whereClause: Prisma.HighlightWhereInput = { userId };
  if (type === "none") {
    whereClause.type = null;
  } else if (type) {
    whereClause.type = type;
  }

  const highlights = await prisma.highlight.findMany({
    where: whereClause,
    include: {
      book: { select: { title: true } },
      chapter: { select: { number: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Older text highlights did not store their text. Load chapter content only
  // for those, once per chapter, instead of every chapter's full text.
  const chapterIdsNeedingText = [
    ...new Set(
      highlights
        .filter((h) => !h.selectedText && h.chapterId && h.startPosition != null && h.endPosition != null)
        .map((h) => h.chapterId as string)
    ),
  ];
  const chapterContent = new Map<string, string>();
  if (chapterIdsNeedingText.length > 0) {
    const chapters = await prisma.chapter.findMany({
      where: { id: { in: chapterIdsNeedingText } },
      select: { id: true, content: true },
    });
    for (const c of chapters) chapterContent.set(c.id, c.content);
  }

  return highlights.map((highlight) => {
    const content = highlight.chapterId ? chapterContent.get(highlight.chapterId) : undefined;
    const selectedText =
      highlight.selectedText ||
      (content && highlight.startPosition != null && highlight.endPosition != null
        ? content.slice(highlight.startPosition, highlight.endPosition)
        : "");

    return {
      ...toHighlight(highlight),
      selectedText,
      bookTitle: highlight.book.title,
      chapterNumber: highlight.chapter?.number ?? null,
      chapterTitle: highlight.chapter?.title ?? null,
      pageNumber: highlight.pageNumber ?? null,
    };
  });
}

export async function createHighlight(
  userId: string,
  input: CreateHighlightInput
): Promise<Highlight> {
  // Проверка: есть ли книга в библиотеке пользователя
  const userBook = await prisma.userLibrary.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId: input.bookId,
      },
    },
  });

  if (!userBook) {
    throw new Error("Книга отсутствует в вашей библиотеке.");
  }

  const chapter = await prisma.chapter.findFirst({
    where: { id: input.chapterId, bookId: input.bookId },
    select: { content: true },
  });

  if (!chapter) {
    throw new Error("Chapter does not belong to the specified book.");
  }

  if (
    input.startPosition < 0 ||
    input.endPosition <= input.startPosition ||
    input.endPosition > chapter.content.length
  ) {
    throw new Error("Highlight range is outside the chapter content.");
  }

  // Delete any overlapping highlights for this user and chapter so that
  // creating a new selection replaces existing highlights in that range.
  await prisma.highlight.deleteMany({
    where: {
      userId,
      chapterId: input.chapterId,
      startPosition: { lt: input.endPosition },
      endPosition: { gt: input.startPosition },
    },
  });

  const highlight = await prisma.highlight.create({
    data: {
      userId,
      bookId: input.bookId,
      chapterId: input.chapterId,
      startPosition: input.startPosition,
      endPosition: input.endPosition,
      selectedText: chapter.content.slice(input.startPosition, input.endPosition),
      type: input.type,
    },
  });

  return toHighlight(highlight);
}

export async function updateHighlightType(
  userId: string,
  highlightId: string,
  type: HighlightType | null,
  note?: string | null
): Promise<Highlight | null> {
  const existing = await prisma.highlight.findFirst({
    where: { id: highlightId, userId },
  });

  if (!existing) return null;

  const data: Prisma.HighlightUpdateInput = { type, legacyColor: null };
  if (note !== undefined) {
    data.note = note;
  }

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data,
  });

  return toHighlight(updated);
}

export async function deleteHighlight(
  userId: string,
  highlightId: string
): Promise<boolean> {
  const result = await prisma.highlight.deleteMany({
    where: { id: highlightId, userId },
  });

  return result.count > 0;
}

export async function listEpubHighlights(
  userId: string,
  bookId: string
): Promise<Highlight[]> {
  const highlights = await prisma.highlight.findMany({
    where: { userId, bookId, cfi: { not: null } },
    orderBy: { createdAt: "asc" },
  });

  return highlights.map(toHighlight);
}

export async function createEpubHighlight(
  userId: string,
  input: {
    bookId: string;
    cfi: string;
    sectionHref?: string | null;
    sectionIndex?: number | null;
    selectedText: string;
    textQuotePrefix?: string | null;
    textQuoteSuffix?: string | null;
    type?: HighlightType | null;
    note?: string | null;
  }
): Promise<Highlight> {
  const tQueryStart = performance.now();
  const highlightId = "cl" + crypto.randomBytes(11).toString("hex");

  const rows = await prisma.$queryRaw<
    Array<{
      id: string;
      userId: string;
      bookId: string;
      chapterId: string | null;
      startPosition: number | null;
      endPosition: number | null;
      pageNumber: number | null;
      rects: unknown;
      selectedText: string;
      type: string | null;
      legacyColor: string | null;
      cfi: string | null;
      sectionHref: string | null;
      sectionIndex: number | null;
      textQuotePrefix: string | null;
      textQuoteSuffix: string | null;
      note: string | null;
      createdAt: Date;
    }>
  >`
    WITH verified_library AS (
      SELECT 1 FROM "public"."user_library" WHERE "user_id" = ${userId} AND "book_id" = ${input.bookId}
    )
    INSERT INTO "public"."highlights" (
      "id", "user_id", "book_id", "cfi", "section_href", "section_index",
      "selected_text", "text_quote_prefix", "text_quote_suffix",
      "type", "note", "start_position", "end_position", "created_at"
    )
    SELECT
      ${highlightId}, ${userId}, ${input.bookId}, ${input.cfi}, ${input.sectionHref ?? null}, ${input.sectionIndex ?? null},
      ${input.selectedText}, ${input.textQuotePrefix ?? null}, ${input.textQuoteSuffix ?? null},
      CAST(${input.type ?? null} AS "public"."HighlightType"), ${input.note ?? null}, 0, 0, NOW()
    FROM verified_library
    ON CONFLICT ("user_id", "book_id", "cfi")
    DO UPDATE SET
      "type" = EXCLUDED."type",
      "note" = COALESCE(EXCLUDED."note", "public"."highlights"."note"),
      "selected_text" = COALESCE(EXCLUDED."selected_text", "public"."highlights"."selected_text")
    RETURNING
      "id", "user_id" AS "userId", "book_id" AS "bookId", "chapter_id" AS "chapterId",
      "start_position" AS "startPosition", "end_position" AS "endPosition",
      "page_number" AS "pageNumber", "rects", "selected_text" AS "selectedText",
      "type"::text AS "type", "legacy_color" AS "legacyColor", "cfi",
      "section_href" AS "sectionHref", "section_index" AS "sectionIndex",
      "text_quote_prefix" AS "textQuotePrefix", "text_quote_suffix" AS "textQuoteSuffix",
      "note", "created_at" AS "createdAt";
  `;

  const tQuery = performance.now() - tQueryStart;

  if (!rows || rows.length === 0) {
    throw new Error("Книга отсутствует в вашей библиотеке.");
  }

  console.log(`📊 [createEpubHighlight (Single Atomic Query)] Time: ${tQuery.toFixed(1)}ms`);
  const row = rows[0];
  return toHighlight({
    ...row,
    type: row.type as PrismaHighlightType | null,
  });
}

export async function updateEpubHighlightCfi(
  userId: string,
  highlightId: string,
  cfi: string
): Promise<Highlight | null> {
  const existing = await prisma.highlight.findFirst({
    where: { id: highlightId, userId },
  });

  if (!existing) return null;

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: { cfi },
  });

  return toHighlight(updated);
}

export async function listPdfHighlights(
  userId: string,
  bookId: string,
  pageNumber?: number
): Promise<Highlight[]> {
  const highlights = await prisma.highlight.findMany({
    // Without a page number, return every PDF highlight of the book.
    where: { userId, bookId, pageNumber: pageNumber ?? { not: null } },
    orderBy: { createdAt: "asc" },
  });

  return highlights.map(toHighlight);
}

export async function createPdfHighlight(
  userId: string,
  input: {
    bookId: string;
    pageNumber: number;
    rects: Prisma.InputJsonValue;
    selectedText: string;
    type?: HighlightType | null;
  }
): Promise<Highlight> {
  const userBook = await prisma.userLibrary.findUnique({
    where: {
      userId_bookId: {
        userId,
        bookId: input.bookId,
      },
    },
  });

  if (!userBook) {
    throw new Error("Книга отсутствует в вашей библиотеке.");
  }

  const highlight = await prisma.highlight.create({
    data: {
      userId,
      bookId: input.bookId,
      pageNumber: input.pageNumber,
      rects: input.rects,
      selectedText: input.selectedText,
      type: input.type,
      startPosition: 0,
      endPosition: 0,
    },
  });

  return toHighlight(highlight);
}
