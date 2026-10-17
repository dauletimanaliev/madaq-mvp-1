import { HighlightType as PrismaHighlightType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Highlight, HighlightType } from "@/lib/types";

type CreateHighlightInput = Omit<
  Highlight,
  "id" | "createdAt" | "type" | "legacyColor"
> & {
  type: HighlightType;
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
  createdAt: Date;
}): Highlight {
  return {
    ...highlight,
    rects: (highlight.rects as any) ?? null,
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
  type?: HighlightType
): Promise<HighlightNote[]> {
  const highlights = await prisma.highlight.findMany({
    where: { userId, ...(type ? { type } : {}) },
    include: {
      book: { select: { title: true } },
      chapter: { select: { number: true, title: true, content: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return highlights.map((highlight) => {
    const selectedText =
      highlight.selectedText ||
      (highlight.chapter && highlight.startPosition != null && highlight.endPosition != null
        ? highlight.chapter.content.slice(
            highlight.startPosition,
            highlight.endPosition
          )
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
      type: input.type,
    },
  });

  return toHighlight(highlight);
}

export async function updateHighlightType(
  userId: string,
  highlightId: string,
  type: HighlightType
): Promise<Highlight | null> {
  const existing = await prisma.highlight.findFirst({
    where: { id: highlightId, userId },
  });

  if (!existing) return null;

  const updated = await prisma.highlight.update({
    where: { id: highlightId },
    data: { type, legacyColor: null },
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

export async function listPdfHighlights(
  userId: string,
  bookId: string,
  pageNumber: number
): Promise<Highlight[]> {
  const highlights = await prisma.highlight.findMany({
    where: { userId, bookId, pageNumber },
    orderBy: { createdAt: "asc" },
  });

  return highlights.map(toHighlight);
}

export async function createPdfHighlight(
  userId: string,
  input: {
    bookId: string;
    pageNumber: number;
    rects: any;
    selectedText: string;
    type: HighlightType;
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
