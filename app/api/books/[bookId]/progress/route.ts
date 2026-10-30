import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * GET: Retrieve user's saved reading progress (last_read_page, progress_pct)
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId: rawBookId } = await params;
    const bookId = decodeURIComponent(rawBookId);

    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      return NextResponse.json({ lastReadPage: 1, progressPct: 0, isGuest: true });
    }

    const record = await prisma.userLibrary.findUnique({
      where: { userId_bookId: { userId, bookId } },
      select: { lastReadPage: true, progressPct: true, lastReadAt: true },
    });

    if (!record) {
      // Check legacy ReadingProgress table
      const legacy = await prisma.readingProgress.findUnique({
        where: { userId_bookId: { userId, bookId } },
        select: { lastReadPage: true, progressPercent: true, lastReadAt: true },
      });

      return NextResponse.json({
        lastReadPage: legacy?.lastReadPage || 1,
        progressPct: legacy?.progressPercent || 0,
        lastReadAt: legacy?.lastReadAt || null,
      });
    }

    return NextResponse.json({
      lastReadPage: record.lastReadPage,
      progressPct: record.progressPct,
      lastReadAt: record.lastReadAt,
    });
  } catch (error) {
    console.error("Fetch reading progress error:", error);
    return NextResponse.json({ lastReadPage: 1, progressPct: 0 });
  }
}

/**
 * POST: Auto-save reading progress (last_read_page, last_read_at, progress_pct)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId: rawBookId } = await params;
    const bookId = decodeURIComponent(rawBookId);

    const body = await request.json().catch(() => ({}));
    const page = parseInt(body?.page, 10) || 1;
    const totalPages = parseInt(body?.totalPages, 10) || 0;
    const progressPct =
      totalPages > 0 ? Math.min(100, Math.round((page / totalPages) * 100)) : 0;

    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
      // Unauthenticated / guest user: client saves in localStorage
      return NextResponse.json({ success: true, savedInDb: false });
    }

    const now = new Date();

    // Update progress only for a book already in the user's library;
    // saving progress must never add a book to someone's library.
    const updated = await prisma.userLibrary.updateMany({
      where: { userId, bookId },
      data: {
        lastReadPage: page,
        progressPct,
        lastReadAt: now,
      },
    });
    if (updated.count === 0) {
      return NextResponse.json({ error: "Книга не найдена" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      savedInDb: true,
      page,
      progressPct,
      lastReadAt: now,
    });
  } catch (error) {
    console.error("Save reading progress error:", error);
    return NextResponse.json({ error: "Failed to save progress" }, { status: 500 });
  }
}
