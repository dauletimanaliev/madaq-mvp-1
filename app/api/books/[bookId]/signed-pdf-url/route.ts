import { NextRequest, NextResponse } from "next/server";
import { requireBookAccess } from "@/lib/auth/book-access";
import { createSignedPdfUrl, SIGNED_URL_TTL_SECONDS } from "@/lib/storage/signed-pdf-url";

export const dynamic = "force-dynamic";

/**
 * Generates a direct CDN Signed URL for Supabase Storage (ТЗ §2).
 * Allows PDF.js to download/stream byte ranges directly from Cloudflare/AWS edge
 * with 0% CPU and bandwidth load on the Next.js web application server.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bookId: string }> }
) {
  try {
    const { bookId: rawBookId } = await params;
    const access = await requireBookAccess(rawBookId);
    if (!access.ok) return access.response;
    const book = access.book;

    if (!book.storageS3Key) {
      return NextResponse.json(
        { error: "PDF не найден или не сохранён в хранилище" },
        { status: 404 }
      );
    }

    const signedUrl = await createSignedPdfUrl(book.storageS3Key);
    if (signedUrl) {
      return NextResponse.json({
        signedUrl,
        expiresIn: SIGNED_URL_TTL_SECONDS,
        isDirectCdn: true,
      });
    }

    return NextResponse.json({
      signedUrl: `/api/books/${encodeURIComponent(book.id)}/pdf-stream`,
      isDirectCdn: false,
    });
  } catch (error) {
    console.error("Signed URL creation error:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}
