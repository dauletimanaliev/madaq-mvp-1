import { NextResponse } from "next/server";
import { getOptionalUserId } from "@/lib/auth/get-current-user";
import { getBookForUser } from "@/server/books/queries";
import type { Book } from "@/lib/types";

type Access =
  | { ok: true; userId: string; book: Book }
  | { ok: false; response: NextResponse };

/**
 * For API routes: the signed-in user and the book, if the book is in their
 * library. Otherwise a ready 401/404 response. A book outside the user's
 * library answers 404, so its existence is not revealed.
 */
export async function requireBookAccess(rawBookId: string): Promise<Access> {
  const userId = await getOptionalUserId();
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Требуется авторизация" }, { status: 401 }),
    };
  }
  const book = await getBookForUser(userId, decodeURIComponent(rawBookId));
  if (!book) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Книга не найдена" }, { status: 404 }),
    };
  }
  return { ok: true, userId, book };
}
