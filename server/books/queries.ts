import { prisma } from "@/lib/db/prisma";
import type { Book } from "@/lib/types";

export async function getBooks(): Promise<Book[]> {
  return prisma.book.findMany({
    include: { author: true },
  });
}

export async function getBookById(id: string): Promise<Book | null> {
  return prisma.book.findUnique({
    where: { id },
    include: { author: true },
  });
}
