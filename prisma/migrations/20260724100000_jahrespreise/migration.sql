-- Preis-Jahresgültigkeiten: expliziter Preis je Kalenderjahr für Verkaufspreis,
-- Einkaufspreis je Lieferant und Kunden-Sonderpreis. Fehlt ein Jahr, wird zur
-- Laufzeit auf das nächstgelegene bekannte Jahr zurückgegriffen (lib/jahrespreis.ts).

CREATE TABLE "ArtikelJahrespreis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelId" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "preis" REAL NOT NULL,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtikelJahrespreis_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArtikelJahrespreis_artikelId_jahr_key" ON "ArtikelJahrespreis"("artikelId", "jahr");
CREATE INDEX "ArtikelJahrespreis_artikelId_idx" ON "ArtikelJahrespreis"("artikelId");

CREATE TABLE "ArtikelLieferantJahrespreis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelLieferantId" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "einkaufspreis" REAL NOT NULL,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtikelLieferantJahrespreis_artikelLieferantId_fkey" FOREIGN KEY ("artikelLieferantId") REFERENCES "ArtikelLieferant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "ArtikelLieferantJahrespreis_artikelLieferantId_jahr_key" ON "ArtikelLieferantJahrespreis"("artikelLieferantId", "jahr");
CREATE INDEX "ArtikelLieferantJahrespreis_artikelLieferantId_idx" ON "ArtikelLieferantJahrespreis"("artikelLieferantId");

CREATE TABLE "KundeArtikelPreisJahr" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeArtikelPreisId" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "preis" REAL NOT NULL,
    "rabatt" REAL NOT NULL DEFAULT 0,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KundeArtikelPreisJahr_kundeArtikelPreisId_fkey" FOREIGN KEY ("kundeArtikelPreisId") REFERENCES "KundeArtikelPreis" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "KundeArtikelPreisJahr_kundeArtikelPreisId_jahr_key" ON "KundeArtikelPreisJahr"("kundeArtikelPreisId", "jahr");
CREATE INDEX "KundeArtikelPreisJahr_kundeArtikelPreisId_idx" ON "KundeArtikelPreisJahr"("kundeArtikelPreisId");

-- Herkunfts-Markierung auf den Positionen, damit Lieferschein/Rechnung/Angebot/
-- Kontrakt/Vorbestellung anzeigen können, wenn ein Preis aus einem anderen Jahr
-- übernommen (interpoliert) wurde.

ALTER TABLE "Lieferposition" ADD COLUMN "preisInterpoliert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Lieferposition" ADD COLUMN "preisQuelleJahr" INTEGER;

ALTER TABLE "AngebotPosition" ADD COLUMN "preisInterpoliert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AngebotPosition" ADD COLUMN "preisQuelleJahr" INTEGER;

ALTER TABLE "KontraktPosition" ADD COLUMN "preisInterpoliert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "KontraktPosition" ADD COLUMN "preisQuelleJahr" INTEGER;

ALTER TABLE "VorbestellungPosition" ADD COLUMN "preisInterpoliert" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "VorbestellungPosition" ADD COLUMN "preisQuelleJahr" INTEGER;
