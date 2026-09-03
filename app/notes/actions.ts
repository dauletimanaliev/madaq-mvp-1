"use server";

import { revalidatePath } from "next/cache";
import { DEMO_USER_ID } from "@/lib/mock-data";
import { deleteHighlight } from "@/server/highlights/queries";

export async function removeHighlight(formData: FormData) {
  const highlightId = formData.get("highlightId");

  if (typeof highlightId !== "string" || highlightId.length === 0) {
    return;
  }

  try {
    const deleted = await deleteHighlight(DEMO_USER_ID, highlightId);
    if (deleted) revalidatePath("/notes");
  } catch (error) {
    console.error("Unable to delete highlight.", error);
  }
}
