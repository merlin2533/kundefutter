-- CreateTable
CREATE TABLE "Kunde" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "firma" TEXT,
    "kategorie" TEXT NOT NULL DEFAULT 'Sonstige',
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "land" TEXT NOT NULL DEFAULT 'Deutschland',
    "lat" REAL,
    "lng" REAL,
    "notizen" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "KundeKontakt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "typ" TEXT NOT NULL,
    "wert" TEXT NOT NULL,
    "label" TEXT,
    CONSTRAINT "KundeKontakt_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lieferant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "ansprechpartner" TEXT,
    "email" TEXT,
    "telefon" TEXT,
    "strasse" TEXT,
    "plz" TEXT,
    "ort" TEXT,
    "notizen" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Artikel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelnummer" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kategorie" TEXT NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    "beschreibung" TEXT,
    "standardpreis" REAL NOT NULL DEFAULT 0,
    "mindestbestand" REAL NOT NULL DEFAULT 0,
    "aktuellerBestand" REAL NOT NULL DEFAULT 0,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ArtikelLieferant" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelId" INTEGER NOT NULL,
    "lieferantId" INTEGER NOT NULL,
    "lieferantenArtNr" TEXT,
    "einkaufspreis" REAL NOT NULL DEFAULT 0,
    "mindestbestellmenge" REAL NOT NULL DEFAULT 0,
    "lieferzeitTage" INTEGER NOT NULL DEFAULT 3,
    "bevorzugt" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ArtikelLieferant_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ArtikelLieferant_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ArtikelPreisHistorie" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelId" INTEGER NOT NULL,
    "alterPreis" REAL NOT NULL,
    "neuerPreis" REAL NOT NULL,
    "geaendertAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notiz" TEXT,
    CONSTRAINT "ArtikelPreisHistorie_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KundeArtikelPreis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "preis" REAL NOT NULL,
    "rabatt" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KundeArtikelPreis_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KundeArtikelPreis_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "KundeBedarf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "intervallTage" INTEGER NOT NULL DEFAULT 30,
    "notiz" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "KundeBedarf_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KundeBedarf_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lieferung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'geplant',
    "stornoBegründung" TEXT,
    "notiz" TEXT,
    "rechnungNr" TEXT,
    "rechnungDatum" DATETIME,
    "wiederkehrend" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Lieferung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lieferposition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieferungId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "verkaufspreis" REAL NOT NULL,
    "einkaufspreis" REAL NOT NULL DEFAULT 0,
    CONSTRAINT "Lieferposition_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Lieferposition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Wareneingang" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieferantId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Wareneingang_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WareineingangPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "wareneingangId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "einkaufspreis" REAL NOT NULL,
    CONSTRAINT "WareineingangPosition_wareneingangId_fkey" FOREIGN KEY ("wareneingangId") REFERENCES "Wareneingang" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WareineingangPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Lagerbewegung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "artikelId" INTEGER NOT NULL,
    "typ" TEXT NOT NULL,
    "menge" REAL NOT NULL,
    "bestandNach" REAL NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notiz" TEXT,
    "lieferungId" INTEGER,
    "wareneingangId" INTEGER,
    CONSTRAINT "Lagerbewegung_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Lagerbewegung_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Lagerbewegung_wareneingangId_fkey" FOREIGN KEY ("wareneingangId") REFERENCES "Wareneingang" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Einstellung" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Artikel_artikelnummer_key" ON "Artikel"("artikelnummer");

-- CreateIndex
CREATE UNIQUE INDEX "ArtikelLieferant_artikelId_lieferantId_key" ON "ArtikelLieferant"("artikelId", "lieferantId");

-- CreateIndex
CREATE UNIQUE INDEX "KundeArtikelPreis_kundeId_artikelId_key" ON "KundeArtikelPreis"("kundeId", "artikelId");

-- CreateIndex
CREATE UNIQUE INDEX "KundeBedarf_kundeId_artikelId_key" ON "KundeBedarf"("kundeId", "artikelId");
