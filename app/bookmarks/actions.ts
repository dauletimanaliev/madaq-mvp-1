"use server";

import { revalidatePath } from "next/cache";
import { DEMO_USER_ID } from "@/lib/mock-data";
import { deleteBookmark } from "@/server/bookmarks/queries";

export async function removeBookmark(formData: FormData) {
  const bookmarkId = formData.get("bookmarkId");

  if (typeof bookmarkId !== "string" || bookmarkId.length === 0) {
    return;
  }

  try {
    const deleted = await deleteBookmark(DEMO_USER_ID, bookmarkId);
    if (deleted) revalidatePath("/bookmarks");
  } catch (error) {
    console.error("Unable to delete bookmark.", error);
  }
}
