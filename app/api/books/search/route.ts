import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/server/books/queries";
import { getOptionalUserId } from "@/lib/auth/get-current-user";

export async function GET(request: NextRequest) {
  const userId = await getOptionalUserId();
  if (!userId) {
    return NextResponse.json({ books: [] }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  try {
    const books = await searchBooks(userId, q);
    return NextResponse.json({ books });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
