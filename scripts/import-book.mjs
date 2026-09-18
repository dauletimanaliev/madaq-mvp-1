import fs from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function parseArgs() {
  const args = process.argv.slice(2);
  const params = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--")) {
      const key = arg.slice(2);
      const nextArg = args[i + 1];
      if (nextArg && !nextArg.startsWith("--")) {
        params[key] = nextArg;
        i++;
      } else {
        params[key] = true;
      }
    }
  }

  return params;
}

function normalizeContent(raw) {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function parseBookText(rawText, defaultTitle) {
  const text = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();

  const chapterRegex =
    /(?:^|\n)(?:#{1,3}\s+)?(?:Глава|ГЛАВА|глава|Chapter|CHAPTER|Часть|ЧАСТЬ)\s+([0-9IVXLCDM]+|[а-яёА-ЯЁ\w]+)?(?::|\.|\s-|\s—)?\s*([^\n]*)/g;

  const matches = [];
  let match;

  while ((match = chapterRegex.exec(text)) !== null) {
    matches.push({
      index: match.index,
      length: match[0].length,
      numberStr: (match[1] || "").trim(),
      titleStr: (match[2] || "").trim(),
    });
  }

  if (matches.length < 2) {
    const mdHeaderRegex = /(?:^|\n)#{1,2}\s+([^\n]+)/g;
    matches.length = 0;
    while ((match = mdHeaderRegex.exec(text)) !== null) {
      matches.push({
        index: match.index,
        length: match[0].length,
        numberStr: "",
        titleStr: (match[1] || "").trim(),
      });
    }
  }

  if (matches.length === 0) {
    return {
      title: defaultTitle || "Без названия",
      chapters: [
        {
          number: 1,
          title: defaultTitle || "Глава 1",
          content: normalizeContent(text),
        },
      ],
    };
  }

  const chapters = [];
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];

    const contentStart = current.index + current.length;
    const contentEnd = next ? next.index : text.length;
    const chapterRawContent = text.slice(contentStart, contentEnd);
    const content = normalizeContent(chapterRawContent);

    if (!content && matches.length > 1) continue;

    const chapterNumber = i + 1;
    let title = current.titleStr || null;
    if (title && title.startsWith("#")) {
      title = title.replace(/^#+\s*/, "").trim();
    }

    chapters.push({
      number: chapterNumber,
      title: title || `Глава ${chapterNumber}`,
      content,
    });
  }

  return {
    title: defaultTitle,
    chapters,
  };
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^\w\sа-яё-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 40);
}

async function main() {
  const params = parseArgs();

  if (!params.file) {
    console.error(`
Использование:
  node scripts/import-book.mjs --file <путь_к_файлу> [опции]

Опции:
  --file <path>         Путь к файлу книги (.md, .txt, .json)
  --title <string>      Название книги (по умолчанию из файла)
  --author <string>     Имя автора (по умолчанию: Неизвестный автор)
  --description <text>  Описание книги
  --cover <url>         Ссылка на обложку
  --id <string>         ID книги (по умолчанию: генерируется из названия)
    `);
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), params.file);
  if (!fs.existsSync(filePath)) {
    console.error(`Ошибка: Файл не найден по пути: ${filePath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  let parsedBook;
  const defaultTitle = params.title || path.basename(filePath, ext);

  if (ext === ".json") {
    const jsonData = JSON.parse(raw);
    if (Array.isArray(jsonData)) {
      parsedBook = {
        title: defaultTitle,
        chapters: jsonData.map((item, idx) => ({
          number: item.number ?? idx + 1,
          title: item.title || null,
          content: normalizeContent(item.content || ""),
        })),
      };
    } else {
      parsedBook = {
        title: jsonData.title || defaultTitle,
        author: jsonData.author,
        description: jsonData.description,
        coverUrl: jsonData.coverUrl,
        chapters: (jsonData.chapters || []).map((item, idx) => ({
          number: item.number ?? idx + 1,
          title: item.title || null,
          content: normalizeContent(item.content || ""),
        })),
      };
    }
  } else {
    parsedBook = parseBookText(raw, defaultTitle);
  }

  const title = params.title || parsedBook.title || defaultTitle;
  const authorName = params.author || parsedBook.author || "Неизвестный автор";
  const description = params.description || parsedBook.description || null;
  const coverUrl = params.cover || parsedBook.coverUrl || null;

  const bookId =
    params.id ||
    `book_${slugify(title)}_${Math.random().toString(36).substring(2, 7)}`;

  console.log(`\n📚 Импорт книги:`);
  console.log(`   Название: ${title}`);
  console.log(`   Автор:    ${authorName}`);
  console.log(`   ID:       ${bookId}`);
  console.log(`   Глав:     ${parsedBook.chapters.length}`);

  // 1. Find or create author
  let author = await prisma.author.findFirst({
    where: { name: authorName },
  });

  if (!author) {
    author = await prisma.author.create({
      data: {
        name: authorName,
      },
    });
    console.log(`   ✓ Создан автор: ${author.name} (id: ${author.id})`);
  } else {
    console.log(`   ✓ Найден существующий автор: ${author.name}`);
  }

  // 2. Upsert book
  const book = await prisma.book.upsert({
    where: { id: bookId },
    update: {
      title,
      description,
      coverUrl,
      authorId: author.id,
    },
    create: {
      id: bookId,
      title,
      description,
      coverUrl,
      language: "ru",
      authorId: author.id,
    },
  });
  console.log(`   ✓ Книга сохранена в базе данных: ${book.title}`);

  // 3. Upsert chapters
  let totalChars = 0;
  for (const chapter of parsedBook.chapters) {
    await prisma.chapter.upsert({
      where: {
        bookId_number: {
          bookId: book.id,
          number: chapter.number,
        },
      },
      update: {
        title: chapter.title,
        content: chapter.content,
      },
      create: {
        bookId: book.id,
        number: chapter.number,
        title: chapter.title,
        content: chapter.content,
      },
    });
    totalChars += chapter.content.length;
  }

  console.log(
    `   ✓ Импортировано ${parsedBook.chapters.length} глав (всего ${totalChars.toLocaleString()} символов)`
  );
  console.log(`\n🎉 Готово! Ссылка для чтения: /books/${book.id}/read\n`);
}

main()
  .catch((err) => {
    console.error("Ошибка при импорте:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
