import { PrismaClient } from "@prisma/client";

// Стандартный паттерн для Next.js: в dev-режиме модуль
// пересоздаётся при каждом hot-reload, поэтому кладём клиент
// в globalThis, чтобы не плодить новые подключения к БД.
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  prismaSchemaVersion: string | undefined;
};

const prismaSchemaVersion = "ingestion-pipeline-v4";

function createPrismaClient() {
  // Connection Pool configuration (Standard v1.0 Section 4.1):
  // Formula: connections = ((core_count * 2) + effective_spindle_count)
  // Enforces connection_limit and pool_timeout on pooled connections
  //
  // In development the server is one long-running process far from the
  // database, so use the session-mode pooler (DIRECT_URL): every query is a
  // single round trip. The transaction-mode pooler (`pgbouncer=true`) wraps
  // each query in BEGIN/DEALLOCATE/COMMIT, about 5 round trips per query.
  // Serverless production keeps the transaction-mode pooler.
  const useSessionPooler =
    process.env.NODE_ENV === "development" && Boolean(process.env.DIRECT_URL);
  let databaseUrl = useSessionPooler ? process.env.DIRECT_URL : process.env.DATABASE_URL;
  if (databaseUrl && !databaseUrl.includes("connection_limit")) {
    const separator = databaseUrl.includes("?") ? "&" : "?";
    // Session-mode connections are held for the process lifetime; keep it small.
    const limit = useSessionPooler ? 5 : 10;
    databaseUrl = `${databaseUrl}${separator}connection_limit=${limit}&pool_timeout=20`;
  }

  return new PrismaClient({
    datasourceUrl: databaseUrl,
    log: process.env.NODE_ENV === "development" ? ["query", "warn", "error"] : ["error"],
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
