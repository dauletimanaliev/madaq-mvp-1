import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * In-book full-text page search (ТЗ §4).
 * Searches book_pages with pg_trgm and returns matching page numbers
 * along with highlighted text snippets.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId: rawBookId } = await params;
    const bookId = decodeURIComponent(rawBookId);

    const { searchParams } = new URL(request.url);
    const q = (searchParams.get("q") || "").trim();

    if (!q || q.length < 2) {
      return NextResponse.json({ results: [] });
    }

    // Search book_pages for this specific book
    const pages = await prisma.$queryRaw<
      Array<{
        page_number: number;
        content: string;
      }>
    >`
      SELECT page_number, content
      FROM book_pages
      WHERE book_id = ${bookId}
        AND (content ILIKE ${"%" + q + "%"} OR content % ${q})
      ORDER BY page_number ASC
      LIMIT 40;
    `;

    // Generate highlighted preview snippets around the search match
    const results = pages.map((p) => {
      const idx = p.content.toLowerCase().indexOf(q.toLowerCase());
      let snippet = "";
      if (idx !== -1) {
        const start = Math.max(0, idx - 60);
        const end = Math.min(p.content.length, idx + q.length + 60);
        snippet =
          (start > 0 ? "…" : "") +
          p.content.slice(start, end).replace(/\s+/g, " ") +
          (end < p.content.length ? "…" : "");
      } else {
        snippet = p.content.slice(0, 120).replace(/\s+/g, " ") + "…";
      }

      return {
        pageNumber: p.page_number,
        snippet,
      };
    });

    return NextResponse.json({ results });
  } catch (error) {
    console.error("In-book search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
