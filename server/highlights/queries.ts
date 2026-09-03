import { HighlightType as PrismaHighlightType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import type { Highlight, HighlightType } from "@/lib/types";

type CreateHighlightInput = Omit<
  Highlight,
  "id" | "createdAt" | "type" | "legacyColor"
> & {
  type: HighlightType;
};

export type HighlightNote = Highlight & {
  selectedText: string;
  bookTitle: string;
  chapterNumber: number;
  chapterTitle: string | null;
};

function toHighlight(highlight: {
  id: string;
  bookId: string;
  chapterId: string;
  startPosition: number;
  endPosition: number;
  type: PrismaHighlightType | null;
  legacyColor: string | null;
  createdAt: Date;
}): Highlight {
  return {
    ...highlight,
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

  return highlights.map((highlight) => ({
    ...toHighlight(highlight),
    selectedText: highlight.chapter.content.slice(
      highlight.startPosition,
      highlight.endPosition
    ),
    bookTitle: highlight.book.title,
    chapterNumber: highlight.chapter.number,
    chapterTitle: highlight.chapter.title,
  }));
}

export async function createHighlight(
  userId: string,
  input: CreateHighlightInput
): Promise<Highlight> {
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

  const overlappingHighlight = await prisma.highlight.findFirst({
      where: {
        userId,
        chapterId: input.chapterId,
        startPosition: { lt: input.endPosition },
        endPosition: { gt: input.startPosition },
      },
      select: { id: true },
    });

    if (overlappingHighlight) {
      throw new Error("Highlight range overlaps an existing highlight.");
    }

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

export async function deleteHighlight(
  userId: string,
  highlightId: string
): Promise<boolean> {
  const result = await prisma.highlight.deleteMany({
    where: { id: highlightId, userId },
  });

  return result.count > 0;
}
