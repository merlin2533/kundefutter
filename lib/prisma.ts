import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL ?? "file:prisma/dev.db";
  const libsqlUrl = url.startsWith("file:./") ? url.replace("file:./", "file:") : url;
  const adapter = new PrismaLibSql({ url: libsqlUrl });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any) as PrismaClient;
}

export const prisma = globalForPrisma.prisma || makeClient();

// Singleton in allen Umgebungen — ohne dies wird in Production bei jedem
// Request ein neuer PrismaClient erstellt → Connection-Pool-Erschöpfung
globalForPrisma.prisma = prisma;
