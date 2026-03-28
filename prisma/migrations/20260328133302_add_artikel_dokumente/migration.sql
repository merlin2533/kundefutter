-- CreateTable
CREATE TABLE "ArtikelDokument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "dateiname" TEXT NOT NULL,
    "pfad" TEXT NOT NULL,
    "typ" TEXT,
    "groesse" INTEGER,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ArtikelDokument_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
