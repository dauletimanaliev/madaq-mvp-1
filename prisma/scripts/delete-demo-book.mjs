import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const demoBookId = "book_cafe";
const demoBookTitle = "Кафе на краю земли";

async function main() {
  const book = await prisma.book.findUnique({
    where: { id: demoBookId },
    select: { id: true, title: true },
  });

  if (!book) {
    console.log(`Cleanup skipped: ${demoBookId} is already absent.`);
    return;
  }

  if (book.id !== demoBookId || book.title !== demoBookTitle) {
    throw new Error("Refusing to delete a book that is not the expected demo book.");
  }

  const result = await prisma.$transaction(async (tx) => {
    const readingProgress = await tx.readingProgress.deleteMany({
      where: { bookId: demoBookId },
    });
    const bookmarks = await tx.bookmark.deleteMany({
      where: { bookId: demoBookId },
    });
    const highlights = await tx.highlight.deleteMany({
      where: { bookId: demoBookId },
    });
    const chapters = await tx.chapter.deleteMany({
      where: { bookId: demoBookId },
    });
    await tx.book.delete({ where: { id: demoBookId } });

    return {
      readingProgress: readingProgress.count,
      bookmarks: bookmarks.count,
      highlights: highlights.count,
      chapters: chapters.count,
    };
  });

  const [deletedBook, relatedRecordCount] = await Promise.all([
    prisma.book.findUnique({ where: { id: demoBookId }, select: { id: true } }),
    prisma.$transaction([
      prisma.readingProgress.count({ where: { bookId: demoBookId } }),
      prisma.bookmark.count({ where: { bookId: demoBookId } }),
      prisma.highlight.count({ where: { bookId: demoBookId } }),
      prisma.chapter.count({ where: { bookId: demoBookId } }),
    ]),
  ]);

  if (deletedBook || relatedRecordCount.some((count) => count !== 0)) {
    throw new Error("Cleanup verification failed: demo book records still exist.");
  }

  console.log(`Deleted ${demoBookId}.`, result);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
