-- Datumsgenaue Einkaufspreis-Historie je Lieferant (Preisverlauf): beliebig viele,
-- frei datierte Preise innerhalb eines Jahres, von denen einer per "aktiv"-Flag
-- als aktuell gültig markiert wird (lib/einkaufspreisverlauf.ts).

CREATE TABLE "ArtikelLieferantPreis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelLieferantId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL,
    "einkaufspreis" REAL NOT NULL,
    "aktiv" BOOLEAN NOT NULL DEFAULT false,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtikelLieferantPreis_artikelLieferantId_fkey" FOREIGN KEY ("artikelLieferantId") REFERENCES "ArtikelLieferant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ArtikelLieferantPreis_artikelLieferantId_idx" ON "ArtikelLieferantPreis"("artikelLieferantId");
CREATE INDEX "ArtikelLieferantPreis_artikelLieferantId_datum_idx" ON "ArtikelLieferantPreis"("artikelLieferantId", "datum");
