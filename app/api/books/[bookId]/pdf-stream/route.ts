import { NextRequest, NextResponse } from "next/server";
import { getBookById } from "@/server/books/queries";

export const dynamic = "force-dynamic";

/**
 * HTTP 206 Partial Content PDF streaming proxy (ТЗ §2).
 * Forwards Range requests to cloud storage and streams byte chunks directly
 * to PDF.js, enabling progressive loading of 100+ MB linearized PDFs.
 */
export async function GET(
  request: NextRequest,
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

    const s3Url = `${supabaseUrl}/storage/v1/object/public/${book.storageS3Key}`;

    // Forward range header from client PDF.js
    const rangeHeader = request.headers.get("range");

    const fetchHeaders: Record<string, string> = {};
    if (rangeHeader) {
      fetchHeaders["Range"] = rangeHeader;
    }
    if (serviceRoleKey) {
      fetchHeaders["authorization"] = `Bearer ${serviceRoleKey}`;
      fetchHeaders["apikey"] = serviceRoleKey;
    }

    const upstreamRes = await fetch(s3Url, {
      headers: fetchHeaders,
    });

    const responseHeaders = new Headers();
    responseHeaders.set("Content-Type", "application/pdf");
    responseHeaders.set("Accept-Ranges", "bytes");
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("Cache-Control", "public, max-age=31536000, immutable");

    const contentLength = upstreamRes.headers.get("content-length");
    if (contentLength) {
      responseHeaders.set("Content-Length", contentLength);
    }

    const contentRange = upstreamRes.headers.get("content-range");
    if (contentRange) {
      responseHeaders.set("Content-Range", contentRange);
    }

    const etag = upstreamRes.headers.get("etag");
    if (etag) {
      responseHeaders.set("ETag", etag);
    }

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("PDF stream error:", error);
    return NextResponse.json({ error: "Stream error" }, { status: 500 });
  }
}

export async function HEAD(
  request: NextRequest,
  context: { params: Promise<{ bookId: string }> }
) {
  const res = await GET(request, context);
  return new NextResponse(null, {
    status: res.status,
    headers: res.headers,
  });
}
