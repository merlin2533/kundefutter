-- CreateTable
CREATE TABLE "Gutschrift" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "kundeId" INTEGER NOT NULL,
    "lieferungId" INTEGER,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "grund" TEXT NOT NULL,
    "notiz" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gutschrift_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Gutschrift_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GutschriftPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "gutschriftId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "preis" REAL NOT NULL,
    "ruecknahme" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "GutschriftPosition_gutschriftId_fkey" FOREIGN KEY ("gutschriftId") REFERENCES "Gutschrift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "GutschriftPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Gutschrift_nummer_key" ON "Gutschrift"("nummer");

-- CreateIndex
CREATE INDEX "Gutschrift_kundeId_idx" ON "Gutschrift"("kundeId");

-- CreateIndex
CREATE INDEX "Gutschrift_datum_idx" ON "Gutschrift"("datum");
