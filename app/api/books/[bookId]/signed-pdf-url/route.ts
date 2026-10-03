import { NextRequest, NextResponse } from "next/server";
import { getBookById } from "@/server/books/queries";

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
    const bookId = decodeURIComponent(rawBookId);
    const book = await getBookById(bookId);

    if (!book || !book.storageS3Key) {
      return NextResponse.json(
        { error: "PDF не найден или не сохранён в хранилище" },
        { status: 404 }
      );
    }

    const supabaseUrl =
      process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceRoleKey) {
      // Fallback to internal streaming route
      return NextResponse.json({
        signedUrl: `/api/books/${encodeURIComponent(book.id)}/pdf-stream`,
        isDirectCdn: false,
      });
    }

    // Extract bucket and storage path (e.g. book-pdfs/books/xyz.pdf)
    let bucket = "book-pdfs";
    let objectPath = book.storageS3Key;
    if (book.storageS3Key.startsWith("book-pdfs/")) {
      objectPath = book.storageS3Key.replace(/^book-pdfs\//, "");
    }

    const expiresIn = 7200; // 2 hours

    const signRes = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${bucket}/${objectPath}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expiresIn }),
      }
    );

    if (signRes.ok) {
      const signData = await signRes.json();
      const directCdnUrl = `${supabaseUrl}/storage/v1${signData.signedURL}`;
      return NextResponse.json({
        signedUrl: directCdnUrl,
        expiresIn,
        isDirectCdn: true,
      });
    }

    console.warn("Direct CDN sign failed, using internal stream proxy");
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
