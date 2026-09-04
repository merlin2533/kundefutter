-- CreateTable
CREATE TABLE "LieferantKontakt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieferantId" INTEGER NOT NULL,
    "typ" TEXT NOT NULL,
    "wert" TEXT NOT NULL,
    "label" TEXT,
    "vorname" TEXT,
    "nachname" TEXT,
    CONSTRAINT "LieferantKontakt_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
