/**
 * Deletes a book's files from Supabase Storage (PDF, EPUB, cover).
 * Best effort: failures are logged, the database is the source of truth.
 */
export async function deleteBookFiles(book: {
  storageS3Key: string | null;
  epubStorageKey: string | null;
  coverUrl: string | null;
}): Promise<void> {
  const supabaseUrl =
    process.env.SUPABASE_URL || "https://fkkdgjmtbzzvbvdswxiz.supabase.co";
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) return;

  // Storage keys look like "bucket/path/to/file".
  const keys: string[] = [];
  if (book.storageS3Key) keys.push(book.storageS3Key);
  if (book.epubStorageKey) keys.push(book.epubStorageKey);
  const coverMatch = book.coverUrl?.match(/\/storage\/v1\/object\/public\/(.+)$/);
  if (coverMatch) keys.push(decodeURIComponent(coverMatch[1]));

  const byBucket = new Map<string, string[]>();
  for (const key of keys) {
    const slash = key.indexOf("/");
    if (slash <= 0) continue;
    const bucket = key.slice(0, slash);
    byBucket.set(bucket, [...(byBucket.get(bucket) ?? []), key.slice(slash + 1)]);
  }

  await Promise.all(
    [...byBucket].map(async ([bucket, prefixes]) => {
      try {
        const res = await fetch(`${supabaseUrl}/storage/v1/object/${bucket}`, {
          method: "DELETE",
          headers: {
            authorization: `Bearer ${serviceRoleKey}`,
            apikey: serviceRoleKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({ prefixes }),
        });
        if (!res.ok) console.warn(`Storage delete failed in ${bucket}:`, await res.text());
      } catch (err) {
        console.warn(`Storage delete error in ${bucket}:`, err);
      }
    })
  );
}
