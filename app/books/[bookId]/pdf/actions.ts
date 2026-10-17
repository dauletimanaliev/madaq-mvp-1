"use server";

import { getCurrentUserId } from "@/lib/auth/get-current-user";
import {
  createPdfHighlight,
  listPdfHighlights,
  deleteHighlight,
  updateHighlightType,
} from "@/server/highlights/queries";
import type { Highlight, HighlightType, PdfHighlightRect } from "@/lib/types";

export async function fetchPdfPageHighlights(
  bookId: string,
  pageNumber: number
): Promise<Highlight[]> {
  try {
    const userId = await getCurrentUserId();
    return await listPdfHighlights(userId, bookId, pageNumber);
  } catch (error) {
    console.error("Failed to fetch PDF highlights:", error);
    return [];
  }
}

export async function savePdfHighlight(input: {
  bookId: string;
  pageNumber: number;
  rects: PdfHighlightRect[];
  selectedText: string;
  type: HighlightType;
}): Promise<{ ok: true; highlight: Highlight } | { ok: false; message: string }> {
  try {
    const userId = await getCurrentUserId();
    const highlight = await createPdfHighlight(userId, input);
    return { ok: true, highlight };
  } catch (error: any) {
    console.error("Unable to save PDF highlight:", error);
    return {
      ok: false,
      message: error?.message || "Не удалось сохранить выделение.",
    };
  }
}

export async function updatePdfHighlightCategory(
  highlightId: string,
  type: HighlightType
): Promise<{ ok: true; highlight: Highlight } | { ok: false; message: string }> {
  try {
    const userId = await getCurrentUserId();
    const updated = await updateHighlightType(userId, highlightId, type);
    if (!updated) {
      return { ok: false, message: "Выделение не найдено." };
    }
    return { ok: true, highlight: updated };
  } catch (error: any) {
    console.error("Unable to update PDF highlight category:", error);
    return {
      ok: false,
      message: "Не удалось изменить категорию выделения.",
    };
  }
}

export async function removePdfHighlight(
  highlightId: string
): Promise<{ ok: boolean }> {
  try {
    const userId = await getCurrentUserId();
    const ok = await deleteHighlight(userId, highlightId);
    return { ok };
  } catch (error) {
    console.error("Unable to remove PDF highlight:", error);
    return { ok: false };
  }
}
