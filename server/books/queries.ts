import { prisma } from "@/lib/db/prisma";
import type { Book } from "@/lib/types";

/** Books in the user's personal library, most recently added first. */
export async function getLibraryBooks(userId: string): Promise<Book[]> {
  const entries = await prisma.userLibrary.findMany({
    where: { userId },
    include: { book: { include: { author: true } } },
    orderBy: { createdAt: "desc" },
  });
  return entries.map((e) => e.book);
}

/** The book, only if it is in the user's library; null otherwise. */
export async function getBookForUser(userId: string, id: string): Promise<Book | null> {
  const decoded = decodeURIComponent(id);
  return prisma.book.findFirst({
    where: {
      OR: [{ id }, { id: decoded }],
      userLibraries: { some: { userId } },
    },
    include: { author: true },
  });
}

export async function getBookById(id: string): Promise<Book | null> {
  const decoded = decodeURIComponent(id);
  return prisma.book.findFirst({
    where: {
      OR: [{ id }, { id: decoded }],
    },
    include: { author: true },
  });
}

/**
 * Fast fuzzy search using PostgreSQL pg_trgm extension and GIN indexes
 * Searches across book titles and author names with typo tolerance.
 */
export async function searchBooks(userId: string, query: string): Promise<Book[]> {
  const q = query.trim();
  if (!q) return getLibraryBooks(userId);

  try {
    const results = await prisma.$queryRaw<
      Array<{
        id: string;
        title: string;
        description: string | null;
        cover_url: string | null;
        language: string;
        published_year: number | null;
        file_hash_sha256: string | null;
        file_size_bytes: number | null;
        total_pages: number | null;
        is_linearized: boolean;
        storage_s3_key: string | null;
        author_id: string;
        author_name: string;
        author_bio: string | null;
        author_photo: string | null;
        content_format: "TEXT" | "PDF" | "EPUB";
        epub_storage_key: string | null;
      }>
    >`
      SELECT b.id, b.title, b.description, b.cover_url, b.language, b.published_year,
             b.file_hash_sha256, b.file_size_bytes, b.total_pages, b.is_linearized, b.storage_s3_key,
             b.content_format, b.epub_storage_key,
             a.id as author_id, a.name as author_name, a.bio as author_bio, a.photo_url as author_photo
      FROM books b
      JOIN authors a ON b.author_id = a.id
      WHERE EXISTS (
              SELECT 1 FROM user_library ul
              WHERE ul.book_id = b.id AND ul.user_id = ${userId}
            )
        AND (b.title % ${q}
         OR a.name % ${q}
         OR b.title ILIKE ${"%" + q + "%"}
         OR a.name ILIKE ${"%" + q + "%"})
      ORDER BY GREATEST(similarity(b.title, ${q}), similarity(a.name, ${q})) DESC
      LIMIT 50;
    `;

    return results.map((r) => ({
      id: r.id,
      title: r.title,
      description: r.description,
      coverUrl: r.cover_url,
      language: r.language,
      publishedYear: r.published_year,
      fileHashSha256: r.file_hash_sha256,
      fileSizeBytes: r.file_size_bytes,
      totalPages: r.total_pages,
      isLinearized: r.is_linearized,
      storageS3Key: r.storage_s3_key,
      contentFormat: r.content_format,
      epubStorageKey: r.epub_storage_key,
      author: {
        id: r.author_id,
        name: r.author_name,
        bio: r.author_bio,
        photoUrl: r.author_photo,
      },
    }));
  } catch (err) {
    console.error("pg_trgm search error, falling back to standard prisma:", err);
    return prisma.book.findMany({
      where: {
        userLibraries: { some: { userId } },
        OR: [
          { title: { contains: q, mode: "insensitive" } },
          { author: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { author: true },
      orderBy: { createdAt: "desc" },
    });
  }
}
