"use server";

import { z } from "zod";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import {
  listEpubHighlights,
  createEpubHighlight,
  updateHighlightType,
  deleteHighlight,
  updateEpubHighlightCfi,
} from "@/server/highlights/queries";
import type { Highlight, HighlightType } from "@/lib/types";

const saveEpubHighlightSchema = z.object({
  bookId: z.string().min(1),
  cfi: z.string().min(1),
  sectionHref: z.string().optional().nullable(),
  sectionIndex: z.number().int().optional().nullable(),
  selectedText: z.string().min(1).max(10000),
  textQuotePrefix: z.string().max(1000).optional().nullable(),
  textQuoteSuffix: z.string().max(1000).optional().nullable(),
  type: z.enum(["protein", "carbohydrate", "fat", "vitamin", "fiber"]).optional().nullable(),
  note: z.string().max(5000).optional().nullable(),
});

export async function fetchEpubHighlights(bookId: string): Promise<Highlight[]> {
  try {
    const userId = await getCurrentUserId();
    return await listEpubHighlights(userId, bookId);
  } catch (error) {
    console.error("Failed to fetch EPUB highlights:", error);
    return [];
  }
}

export async function saveEpubHighlight(
  rawInput: z.infer<typeof saveEpubHighlightSchema>
): Promise<{ ok: true; highlight: Highlight } | { ok: false; message: string }> {
  const tStart = performance.now();
  try {
    const tZodStart = performance.now();
    const parsed = saveEpubHighlightSchema.safeParse(rawInput);
    const tZod = performance.now() - tZodStart;
    if (!parsed.success) {
      return {
        ok: false,
        message: "Некорректные данные выделения: " + parsed.error.issues.map((i) => i.message).join(", "),
      };
    }

    const tAuthStart = performance.now();
    const userId = await getCurrentUserId();
    const tAuth = performance.now() - tAuthStart;

    const tDbStart = performance.now();
    const highlight = await createEpubHighlight(userId, parsed.data);
    const tDb = performance.now() - tDbStart;

    const tTotal = performance.now() - tStart;
    console.log(
      `⏱️ [saveEpubHighlight Profiler] TOTAL: ${tTotal.toFixed(1)}ms | ` +
      `Auth: ${tAuth.toFixed(1)}ms | ` +
      `Zod: ${tZod.toFixed(1)}ms | ` +
      `DB (createEpubHighlight): ${tDb.toFixed(1)}ms`
    );

    return { ok: true, highlight };
  } catch (error: unknown) {
    console.error("Unable to save EPUB highlight:", error);
    const message = error instanceof Error ? error.message : "Не удалось сохранить выделение.";
    return {
      ok: false,
      message,
    };
  }
}

export async function updateEpubHighlightCategory(
  highlightId: string,
  type: HighlightType | null,
  note?: string | null
): Promise<{ ok: true; highlight: Highlight } | { ok: false; message: string }> {
  try {
    const userId = await getCurrentUserId();
    const updated = await updateHighlightType(userId, highlightId, type, note);
    if (!updated) {
      return { ok: false, message: "Выделение не найдено." };
    }
    return { ok: true, highlight: updated };
  } catch (error: unknown) {
    console.error("Unable to update EPUB highlight category:", error);
    return {
      ok: false,
      message: "Не удалось изменить категорию выделения.",
    };
  }
}

export async function removeEpubHighlight(
  highlightId: string
): Promise<{ ok: boolean }> {
  try {
    const userId = await getCurrentUserId();
    const ok = await deleteHighlight(userId, highlightId);
    return { ok };
  } catch (error) {
    console.error("Unable to remove EPUB highlight:", error);
    return { ok: false };
  }
}

export async function repairEpubHighlightCfi(
  highlightId: string,
  newCfi: string
): Promise<{ ok: boolean }> {
  try {
    const userId = await getCurrentUserId();
    const updated = await updateEpubHighlightCfi(userId, highlightId, newCfi);
    return { ok: Boolean(updated) };
  } catch (error) {
    console.error("Unable to repair EPUB highlight CFI:", error);
    return { ok: false };
  }
}
