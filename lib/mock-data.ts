import type { Author, Book, Chapter } from "./types";

// Временный источник данных для MVP1, пока не поднята PostgreSQL
// и не подключён prisma/schema.prisma. Формат один в один повторяет
// то, что будет возвращать БД — поэтому server/* модули меняются
// на реальные Prisma-запросы без изменения кода страниц.
//
// Важно: текст глав ниже — заглушка, а не отрывки из настоящей книги.
// Реальный текст нужно будет загрузить отдельно (правообладание).

export const AUTHOR: Author = {
  id: "author_strelecky",
  name: "Джон Стрелеки",
  bio: "Американский писатель, автор серии «Кафе на краю земли» о поиске смысла жизни.",
  photoUrl: null,
};

export const BOOK: Book = {
  id: "book_cafe",
  title: "Кафе на краю земли",
  description:
    "Короткая философская притча о герое, который случайно заезжает в придорожное кафе и находит там вопросы, меняющие его жизнь.",
  coverUrl: null,
  language: "ru",
  publishedYear: 2005,
  author: AUTHOR,
};

export const CHAPTERS: Chapter[] = [1, 2, 3, 4, 5].map((number) => ({
  id: `chapter_${number}`,
  bookId: BOOK.id,
  number,
  title: `Глава ${number}`,
  content:
    "Текст главы появится здесь после загрузки реального содержимого книги. " +
    "Пока это заглушка, чтобы можно было собрать и проверить Reader целиком.",
}));

// До подключения Supabase Auth работаем с одним демо-пользователем.
export const DEMO_USER_ID = "demo_user";
