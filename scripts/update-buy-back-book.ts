import { PrismaClient } from '@prisma/client';
import { extractPdfWithFormatting } from '../lib/books/pdf-formatter';
import { parseBookText } from '../lib/books/parser';
import { renderPageAsImage } from 'unpdf';
import fs from 'node:fs/promises';
import path from 'node:path';

const prisma = new PrismaClient();

async function updateBook() {
  const bookId = 'book_buy_back_your_time_dan_martell_340_1_32r6q';
  const pdfPath = '/Users/dauletimanaliev/кітаптар/Buy_Back_Your_Time_-_Dan_Martell-340-1.pdf';
  
  console.log('Reading PDF...');
  const buffer = await fs.readFile(pdfPath);
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
  const pdfData = new Uint8Array(arrayBuffer);

  // 1. Generate & save cover image
  console.log('Generating cover image from page 1...');
  const coverBuffer = await renderPageAsImage(
    pdfData,
    1,
    {
      width: 500,
      canvasImport: () => import('@napi-rs/canvas'),
    }
  );

  const coversDir = path.join(process.cwd(), 'public', 'covers');
  await fs.mkdir(coversDir, { recursive: true });
  const coverFileName = bookId + '.png';
  await fs.writeFile(path.join(coversDir, coverFileName), Buffer.from(coverBuffer as ArrayBuffer));
  const coverUrl = '/covers/' + coverFileName;

  // 2. Extract text with full formatting
  console.log('Extracting formatted text with true font resolution...');
  const text = await extractPdfWithFormatting(new Uint8Array(arrayBuffer.slice(0)));

  // 3. Parse chapters
  console.log('Parsing chapters...');
  const parsed = parseBookText(text, 'Buy Back Your Time');
  console.log('Found', parsed.chapters.length, 'chapters');

  // 4. Update book & chapters in DB
  console.log('Updating DB...');
  const existingChapters = await prisma.chapter.findMany({
    where: { bookId },
    select: { id: true },
  });
  const chapterIds = existingChapters.map((c) => c.id);

  await prisma.highlight.deleteMany({
    where: { chapterId: { in: chapterIds } },
  });
  await prisma.readingProgress.deleteMany({
    where: { chapterId: { in: chapterIds } },
  });
  await prisma.chapter.deleteMany({ where: { bookId } });
  
  await prisma.book.update({
    where: { id: bookId },
    data: {
      title: 'Buy Back Your Time',
      coverUrl,
    },
  });

  await prisma.chapter.createMany({
    data: parsed.chapters.map((ch) => ({
      bookId,
      number: ch.number,
      title: ch.title,
      content: ch.content,
    })),
  });

  console.log('Successfully updated book and chapters with cover & rich formatting!');
  await prisma.$disconnect();
}

updateBook().catch((e) => {
  console.error(e);
  process.exit(1);
});
