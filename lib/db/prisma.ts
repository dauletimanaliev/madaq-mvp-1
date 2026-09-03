import { PrismaClient } from "@prisma/client";

// Стандартный паттерн для Next.js: в dev-режиме модуль
// пересоздаётся при каждом hot-reload, поэтому кладём клиент
// в globalThis, чтобы не плодить новые подключения к БД.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

const prismaSchemaVersion = "highlight-types-v1";

function createPrismaClient() {
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

// Prisma Client was regenerated with the Highlight model while the Next.js
// dev process was still holding a global client generated from the old schema.
// Replace that stale singleton during HMR instead of trying to use a delegate
// that does not exist on it.
const hasCurrentSchema =
  globalForPrisma.prisma &&
  "highlight" in globalForPrisma.prisma &&
  globalForPrisma.prismaSchemaVersion === prismaSchemaVersion;

if (globalForPrisma.prisma && !hasCurrentSchema) {
  void globalForPrisma.prisma.$disconnect();
  globalForPrisma.prisma = undefined;
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

globalForPrisma.prisma = prisma;
globalForPrisma.prismaSchemaVersion = prismaSchemaVersion;
