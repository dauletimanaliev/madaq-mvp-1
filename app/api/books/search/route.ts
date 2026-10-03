import { NextRequest, NextResponse } from "next/server";
import { searchBooks } from "@/server/books/queries";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";

  try {
    const books = await searchBooks(q);
    return NextResponse.json({ books });
  } catch (error) {
    console.error("Search API error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
