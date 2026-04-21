"use strict";
// Admin-Seed (idempotent). Plain Node.js damit wir in der Produktion weder
// ts-node noch TypeScript-Toolchain brauchen – nur Node + Laufzeit-Deps.
require("dotenv/config");
const { PrismaClient } = require("@prisma/client");
const { PrismaLibSql } = require("@prisma/adapter-libsql");
const bcrypt = require("bcryptjs");

const url = process.env.DATABASE_URL || "file:prisma/dev.db";
const libsqlUrl = url.startsWith("file:./") ? url.replace("file:./", "file:") : url;
const adapter = new PrismaLibSql({ url: libsqlUrl });
const prisma = new PrismaClient({ adapter });

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
  console.log("Admin-Benutzer angelegt (admin / MarkusStraub)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
