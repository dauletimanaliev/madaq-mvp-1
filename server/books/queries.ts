import { prisma } from "@/lib/db/prisma";
import type { Book } from "@/lib/types";

export async function getBooks(): Promise<Book[]> {
  return prisma.book.findMany({
    include: { author: true },
    orderBy: { createdAt: "desc" },
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
export async function searchBooks(query: string): Promise<Book[]> {
  const q = query.trim();
  if (!q) return getBooks();

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
      }>
    >`
      SELECT b.id, b.title, b.description, b.cover_url, b.language, b.published_year,
             b.file_hash_sha256, b.file_size_bytes, b.total_pages, b.is_linearized, b.storage_s3_key,
             a.id as author_id, a.name as author_name, a.bio as author_bio, a.photo_url as author_photo
      FROM books b
      JOIN authors a ON b.author_id = a.id
      WHERE b.title % ${q}
         OR a.name % ${q}
         OR b.title ILIKE ${"%" + q + "%"}
         OR a.name ILIKE ${"%" + q + "%"}
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
