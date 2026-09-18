"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { deleteBookmark } from "@/server/bookmarks/queries";

export async function removeBookmark(formData: FormData) {
  const bookmarkId = formData.get("bookmarkId");

  if (typeof bookmarkId !== "string" || bookmarkId.length === 0) {
    return;
  }

  const userId = await getCurrentUserId();
  try {
    const deleted = await deleteBookmark(userId, bookmarkId);
    if (deleted) revalidatePath("/bookmarks");
  } catch (error) {
    console.error("Unable to delete bookmark.", error);
  }
}
