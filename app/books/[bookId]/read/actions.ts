"use server";

import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { upsertProgress } from "@/server/progress/queries";
import { createBookmark } from "@/server/bookmarks/queries";
import {
  createHighlight,
  deleteHighlight,
  updateHighlightType,
} from "@/server/highlights/queries";
import type { Bookmark, Highlight, HighlightType } from "@/lib/types";

export async function saveProgress(input: {
  bookId: string;
  chapterId: string;
  position: number;
  progressPercent: number;
}) {
  const userId = await getCurrentUserId();
  try {
    await upsertProgress(userId, input);
  } catch (error) {
    console.error("Unable to save reading progress.", error);
    return false;
  }

  return true;
}

export async function addBookmark(
  input: Omit<Bookmark, "id" | "createdAt">
) {
  const userId = await getCurrentUserId();
  try {
    return await createBookmark(userId, input);
  } catch (error) {
    console.error("Unable to save bookmark.", error);
    return null;
  }
}

export async function addHighlight(
  input: Omit<Highlight, "id" | "createdAt" | "type" | "legacyColor"> & {
    type: NonNullable<Highlight["type"]>;
  }
): Promise<
  | { ok: true; highlight: Highlight }
  | { ok: false; message: string }
> {
  const userId = await getCurrentUserId();
  try {
    return { ok: true, highlight: await createHighlight(userId, input) };
  } catch (error) {
    console.error("Unable to save highlight.", error);
    return {
      ok: false,
      message: "Не удалось сохранить выделение. Попробуйте ещё раз.",
    };
  }
}

export async function updateHighlightColor(
  highlightId: string,
  type: HighlightType
): Promise<
  | { ok: true; highlight: Highlight }
  | { ok: false; message: string }
> {
  const userId = await getCurrentUserId();
  try {
    const updated = await updateHighlightType(userId, highlightId, type);
    if (!updated) {
      return { ok: false, message: "Заметка не найдена." };
    }
    return { ok: true, highlight: updated };
  } catch (error) {
    console.error("Unable to update highlight color.", error);
    return {
      ok: false,
      message: "Не удалось изменить цвет выделения.",
    };
  }
}

export async function removeHighlight(highlightId: string) {
  const userId = await getCurrentUserId();
  return deleteHighlight(userId, highlightId);
}
