/**
 * Returns the appropriate reader URL based on book contentFormat and storage keys.
 * - EPUB books -> /books/[id]/epub
 * - PDF books -> /books/[id]/pdf
 * - Text books -> /books/[id]/read
 */
export function getBookReaderUrl(book: {
  id: string;
  contentFormat?: string | null;
  storageS3Key?: string | null;
  epubStorageKey?: string | null;
}): string {
  // If original EPUB is available, always use original EPUB reader
  if (book.contentFormat === "EPUB" || Boolean(book.epubStorageKey)) {
    return `/books/${book.id}/epub`;
  }
  // If original PDF is available, always use original PDF reader (like Apple Preview)
  if (book.contentFormat === "PDF" || Boolean(book.storageS3Key)) {
    return `/books/${book.id}/pdf`;
  }
  return `/books/${book.id}/read`;
}
