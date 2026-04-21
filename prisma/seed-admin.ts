import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import bcrypt from "bcryptjs";

const url = process.env.DATABASE_URL ?? "file:prisma/dev.db";
const libsqlUrl = url.startsWith("file:./") ? url.replace("file:./", "file:") : url;
const adapter = new PrismaLibSql({ url: libsqlUrl });
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const vorhanden = await prisma.benutzer.findUnique({ where: { benutzername: "admin" } });
  if (vorhanden) {
    console.log("Admin-Benutzer existiert bereits – überspringe");
    return;
  }
  const hash = await bcrypt.hash("MarkusStraub", 10);
  await prisma.benutzer.create({
    data: {
      benutzername: "admin",
      passwortHash: hash,
      name: "Administrator",
      rolle: "admin",
    },
  });
  console.log("✅ Admin-Benutzer angelegt (admin / MarkusStraub)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
