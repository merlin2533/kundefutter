import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

function makeClient() {
  const url = process.env.DATABASE_URL ?? "file:prisma/dev.db";
  const libsqlUrl = url.startsWith("file:./") ? url.replace("file:./", "file:") : url;
  const adapter = new PrismaLibSql({ url: libsqlUrl });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma || makeClient();

// Singleton in allen Umgebungen — ohne dies wird in Production bei jedem
// Request ein neuer PrismaClient erstellt → Connection-Pool-Erschöpfung
globalForPrisma.prisma = prisma;

// Für bessere Concurrent-Read-Performance (SQLite WAL-Modus):
async function ensureWalMode() {
  try {
    await prisma.$executeRawUnsafe('PRAGMA journal_mode=WAL;');
    await prisma.$executeRawUnsafe('PRAGMA synchronous=NORMAL;');
    await prisma.$executeRawUnsafe('PRAGMA cache_size=10000;');
    await prisma.$executeRawUnsafe('PRAGMA temp_store=memory;');
  } catch (e) {
    // silently ignore (might not be SQLite)
  }
}
// Einmalig beim Start aufrufen (fire-and-forget)
ensureWalMode().catch(() => {});
