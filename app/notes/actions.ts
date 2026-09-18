"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUserId } from "@/lib/auth/get-current-user";
import { deleteHighlight } from "@/server/highlights/queries";

export async function removeHighlight(formData: FormData) {
  const highlightId = formData.get("highlightId");

  if (typeof highlightId !== "string" || highlightId.length === 0) {
    return;
  }

  const userId = await getCurrentUserId();
  try {
    const deleted = await deleteHighlight(userId, highlightId);
    if (deleted) revalidatePath("/notes");
  } catch (error) {
    console.error("Unable to delete highlight.", error);
  }
}
