import { PrismaClient } from "@prisma/client";
import newCafeGuestChapters from "./data/new-cafe-guest.chapters.json" with { type: "json" };

const prisma = new PrismaClient();

const demoUser = {
  id: "demo_user",
  email: "demo@madaq.local",
  name: "Madaq Demo User",
  avatarUrl: null,
};

const author = {
  id: "author_strelecky",
  name: "Джон Стрелеки",
  bio: "Американский писатель, автор серии «Кафе на краю земли» о поиске смысла жизни.",
  photoUrl: null,
};

const newCafeGuestBook = {
  id: "book_new_cafe_guest",
  title: "Новая гостья кафе на краю земли",
  description:
    "Как сделать правильный выбор, когда оказываешься на перепутье.",
  coverUrl: null,
  language: "ru",
  publishedYear: null,
  authorId: author.id,
};

const newCafeGuestBookChapters = newCafeGuestChapters.map((chapter) => ({
  ...chapter,
  bookId: newCafeGuestBook.id,
}));

async function upsertBookWithChapters(book, chapters) {
  await prisma.book.upsert({
    where: { id: book.id },
    // Storage owns the production cover URL. A normal seed must not erase it.
    update: {
      title: book.title,
      description: book.description,
      language: book.language,
      publishedYear: book.publishedYear,
      authorId: book.authorId,
    },
    create: book,
  });

  for (const chapter of chapters) {
    await prisma.chapter.upsert({
      where: {
        bookId_number: {
          bookId: chapter.bookId,
          number: chapter.number,
        },
      },
      update: chapter,
      create: chapter,
    });
  }
}

async function main() {
  await prisma.user.upsert({
    where: { id: demoUser.id },
    update: demoUser,
    create: demoUser,
  });

  await prisma.author.upsert({
    where: { id: author.id },
    update: author,
    create: author,
  });

  await upsertBookWithChapters(newCafeGuestBook, newCafeGuestBookChapters);
}

main()
  .then(() => {
    console.log("Seed completed.");
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
