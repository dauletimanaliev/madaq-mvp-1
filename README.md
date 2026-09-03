# Madaq

Madaq — MVP веб-приложения для спокойного чтения книг. Оно хранит книги и пользовательские данные в Supabase PostgreSQL через Prisma: позиции чтения, закладки и смысловые заметки по выделенным фрагментам.

## Возможности

- библиотека и страница книги;
- Reader с вычисляемой browser-side pagination;
- восстановление позиции чтения по canonical UTF-16 offset;
- закладки и Reading Progress в PostgreSQL;
- выделение текста и заметки пяти типов: Белки, Углеводы, Жиры, Витамины, Клетчатка;
- notes onboarding и страница `/notes/about`;
- сохранение highlights как canonical offsets, независимых от ширины окна, колонок и размера текста;
- обложки книг через Supabase Storage.

## Архитектура

```text
UI
→ Server Actions / server layer
→ Prisma Client
→ Supabase PostgreSQL
```

Для highlights:

```text
DOM Selection
→ DOM Range
→ canonical UTF-16 offsets in Chapter.content
→ Server Action
→ Prisma
→ Supabase PostgreSQL
```

`Chapter.content` — единственный источник текста. Визуальные страницы и подсветка — производные от него, не отдельные записи в БД.

## Технологии

- Next.js 16, React 19, TypeScript;
- Prisma 6;
- Supabase PostgreSQL и Storage;
- Tailwind CSS 4.

## Локальный запуск

Требования: Node.js 22+ и доступ к Supabase project.

```bash
npm install
cp .env.example .env
npx prisma generate
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

В `.env` нужны:

```env
DATABASE_URL="..."
DIRECT_URL="..."
```

`DATABASE_URL` использует Supabase transaction pooler. `DIRECT_URL` используется Prisma CLI для migrations.

## База данных

```bash
npx prisma migrate status
npx prisma db seed
```

Seed идемпотентно создаёт demo user, автора Джона Стрелеки и книгу `book_new_cafe_guest` с 40 главами. Старая черновая книга `book_cafe` намеренно не создаётся.

Одноразовый безопасный cleanup старой demo-книги:

```bash
npm run db:cleanup-demo-book
```

Скрипт проверяет точные ID и title, удаляет только связанные записи старой книги и безопасен при повторном запуске.

## Обложки

Обложка хранится в Supabase Storage, не в PostgreSQL. Ожидаемый публичный объект:

```text
book-covers/new-cafe-guest/cover.png
```

Для настройки bucket и upload локальной обложки нужен server-side ключ только в локальном окружении:

```env
SUPABASE_SERVICE_ROLE_KEY="..."
```

```bash
npm run storage:upload-new-cafe-guest-cover
```

Не добавляйте service role key в Git или browser environment.

## Проверки

```bash
npm run lint
npx tsc --noEmit
npx prisma migrate status
```

## Production deployment

GitHub Pages не подходит для этого приложения: ему нужны Next.js Server Components, Server Actions и подключение Prisma к PostgreSQL.

Рекомендуемый путь — GitHub для исходного кода и Vercel для production deployment. В Vercel Production Environment добавьте как минимум `DATABASE_URL` и `DIRECT_URL`. Для runtime не требуется публичный доступ к Prisma или к database password.
