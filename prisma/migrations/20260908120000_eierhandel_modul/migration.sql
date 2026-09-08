-- Eierhandel-Modul: Erzeuger-Stammdaten (Legehennenbetriebsregister), Kennzeichnungsfelder
-- an Lieferposition (EU-Vermarktungsnorm, Del. VO (EU) 2023/2465 + DVO (EU) 2023/2466) und
-- Sortierprotokoll (eine Anlieferung wird in mehrere klassifizierte Ausgangschargen aufgeteilt).

-- AlterTable: Kunde (Erzeuger-Stammdaten im Anlieferungs-Kontext)
ALTER TABLE "Kunde" ADD COLUMN "erzeugercode" TEXT;
ALTER TABLE "Kunde" ADD COLUMN "haltungsform" INTEGER;

-- AlterTable: Lieferposition (Eier-Kennzeichnung, eingefroren bei Positionserstellung)
ALTER TABLE "Lieferposition" ADD COLUMN "gueteklasse" TEXT;
ALTER TABLE "Lieferposition" ADD COLUMN "gewichtsklasse" TEXT;
ALTER TABLE "Lieferposition" ADD COLUMN "legedatum" DATETIME;
ALTER TABLE "Lieferposition" ADD COLUMN "erzeugercode" TEXT;

-- CreateTable
CREATE TABLE "EierSortierung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "anlieferungId" INTEGER,
    "notiz" TEXT,
    "erstelltVon" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EierSortierung_anlieferungId_fkey" FOREIGN KEY ("anlieferungId") REFERENCES "Anlieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "EierSortierung_anlieferungId_idx" ON "EierSortierung"("anlieferungId");
CREATE INDEX "EierSortierung_datum_idx" ON "EierSortierung"("datum");

-- CreateTable
CREATE TABLE "EierSortierungPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "sortierungId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "gueteklasse" TEXT NOT NULL,
    "gewichtsklasse" TEXT NOT NULL,
    "menge" REAL NOT NULL,
    "chargeNr" TEXT,
    "legedatum" DATETIME,
    "erzeugercode" TEXT,
    CONSTRAINT "EierSortierungPosition_sortierungId_fkey" FOREIGN KEY ("sortierungId") REFERENCES "EierSortierung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "EierSortierungPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "EierSortierungPosition_sortierungId_idx" ON "EierSortierungPosition"("sortierungId");
CREATE INDEX "EierSortierungPosition_artikelId_idx" ON "EierSortierungPosition"("artikelId");
