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
  // Connection Pool configuration (Standard v1.0 Section 4.1):
  // Formula: connections = ((core_count * 2) + effective_spindle_count)
  // Enforces connection_limit and pool_timeout on pooled connections
  let databaseUrl = process.env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.includes("connection_limit")) {
    const separator = databaseUrl.includes("?") ? "&" : "?";
    databaseUrl = `${databaseUrl}${separator}connection_limit=10&pool_timeout=20`;
  }

  return new PrismaClient({
    datasourceUrl: databaseUrl,
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
