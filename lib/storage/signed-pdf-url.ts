const PDF_BUCKET = "book-pdfs";
const SIGNED_URL_TTL_SECONDS = 7200; // 2 hours
// Reuse a signed URL while it has at least this long left. The same URL lets
// the storage CDN serve the file from cache instead of the origin in Tokyo.
const MIN_REMAINING_MS = 30 * 60 * 1000;

const globalForSignedUrls = globalThis as unknown as {
  signedPdfUrls?: Map<string, { url: string; expiresAt: number }>;
};
const signedUrlCache = (globalForSignedUrls.signedPdfUrls ??= new Map());

export function getStorageOrigin(): string {
  return new URL(
    process.env.SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      "https://fkkdgjmtbzzvbvdswxiz.supabase.co"
  ).origin;
}

/**
 * Creates a signed Supabase Storage URL for a book PDF, so PDF.js can fetch
 * byte ranges straight from storage. Returns null when signing is not
 * possible; callers then fall back to the /pdf-stream proxy.
 */
export async function createSignedPdfUrl(storageKey: string): Promise<string | null> {
  const cached = signedUrlCache.get(storageKey);
  if (cached && cached.expiresAt - Date.now() > MIN_REMAINING_MS) return cached.url;

  const supabaseUrl = getStorageOrigin();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return null;

  const objectPath = storageKey.replace(new RegExp(`^${PDF_BUCKET}/`), "");

  try {
    const res = await fetch(
      `${supabaseUrl}/storage/v1/object/sign/${PDF_BUCKET}/${objectPath}`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${serviceRoleKey}`,
          apikey: serviceRoleKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ expiresIn: SIGNED_URL_TTL_SECONDS }),
        cache: "no-store",
      }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as { signedURL?: string };
    if (!data.signedURL) return null;
    const url = `${supabaseUrl}/storage/v1${data.signedURL}`;
    signedUrlCache.set(storageKey, {
      url,
      expiresAt: Date.now() + SIGNED_URL_TTL_SECONDS * 1000,
    });
    return url;
  } catch {
    return null;
  }
}

export { SIGNED_URL_TTL_SECONDS };
