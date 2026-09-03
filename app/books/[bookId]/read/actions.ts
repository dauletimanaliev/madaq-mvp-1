"use server";

import { DEMO_USER_ID } from "@/lib/mock-data";
import { upsertProgress } from "@/server/progress/queries";
import { createBookmark } from "@/server/bookmarks/queries";
import { createHighlight, deleteHighlight } from "@/server/highlights/queries";
import type { Bookmark, Highlight } from "@/lib/types";

export async function saveProgress(input: {
  bookId: string;
  chapterId: string;
  position: number;
  progressPercent: number;
}) {
  try {
    await upsertProgress(DEMO_USER_ID, input);
  } catch (error) {
    console.error("Unable to save reading progress.", error);
    return false;
  }

  return true;
}

export async function addBookmark(
  input: Omit<Bookmark, "id" | "createdAt">
) {
  try {
    return await createBookmark(DEMO_USER_ID, input);
  } catch (error) {
    console.error("Unable to save bookmark.", error);
    return null;
  }
}

export async function addHighlight(
  input: Omit<Highlight, "id" | "createdAt" | "type" | "legacyColor"> & {
    type: NonNullable<Highlight["type"]>;
  }
) {
  return createHighlight(DEMO_USER_ID, input);
}

export async function removeHighlight(highlightId: string) {
  return deleteHighlight(DEMO_USER_ID, highlightId);
}
