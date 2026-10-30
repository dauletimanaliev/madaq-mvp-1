/** Upload rules shared by the upload dialog and the server. */
export const MAX_UPLOAD_MB = 50;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
/** Books one user can keep in their library. */
export const MAX_BOOKS_PER_USER = 100;
export const ALLOWED_UPLOAD_EXTENSIONS = [".pdf", ".epub", ".txt", ".md", ".json"] as const;

export function uploadExtension(fileName: string): string | null {
  const lower = fileName.toLowerCase();
  return ALLOWED_UPLOAD_EXTENSIONS.find((ext) => lower.endsWith(ext)) ?? null;
}

/** Private bucket for raw uploads before processing, in per-user folders. */
export const TEMP_UPLOAD_BUCKET = "book-pdfs";
