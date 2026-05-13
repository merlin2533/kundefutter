-- Migration: skonto_teilzahlung_vorlagen_chargen_ghs
-- Adds: Skonto fields on Lieferung + Sammelrechnung, Teilzahlung, AngebotVorlage,
--       ChargenZertifikat, GHS fields on Artikel, MHD on WareineingangPosition,
--       Cross-Docking flag on Wareneingang

-- Skonto on Lieferung
ALTER TABLE "Lieferung" ADD COLUMN "skontoProzent" REAL;
ALTER TABLE "Lieferung" ADD COLUMN "skontoTage" INTEGER;
ALTER TABLE "Lieferung" ADD COLUMN "skontoGenutzt" BOOLEAN NOT NULL DEFAULT false;

-- Skonto on Sammelrechnung
ALTER TABLE "Sammelrechnung" ADD COLUMN "skontoProzent" REAL;
ALTER TABLE "Sammelrechnung" ADD COLUMN "skontoTage" INTEGER;
ALTER TABLE "Sammelrechnung" ADD COLUMN "skontoGenutzt" BOOLEAN NOT NULL DEFAULT false;

-- Teilzahlung table
CREATE TABLE "Teilzahlung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieferungId" INTEGER,
    "sammelrechnungId" INTEGER,
    "betrag" REAL NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Teilzahlung_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Teilzahlung_sammelrechnungId_fkey" FOREIGN KEY ("sammelrechnungId") REFERENCES "Sammelrechnung" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Teilzahlung_lieferungId_idx" ON "Teilzahlung"("lieferungId");
CREATE INDEX "Teilzahlung_sammelrechnungId_idx" ON "Teilzahlung"("sammelrechnungId");

-- AngebotVorlage table
CREATE TABLE "AngebotVorlage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "notiz" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- AngebotVorlagePosition table
CREATE TABLE "AngebotVorlagePosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vorlageId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "preis" REAL NOT NULL DEFAULT 0,
    "rabatt" REAL NOT NULL DEFAULT 0,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    "notiz" TEXT,
    CONSTRAINT "AngebotVorlagePosition_vorlageId_fkey" FOREIGN KEY ("vorlageId") REFERENCES "AngebotVorlage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AngebotVorlagePosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "AngebotVorlagePosition_vorlageId_idx" ON "AngebotVorlagePosition"("vorlageId");

-- GHS fields on Artikel
ALTER TABLE "Artikel" ADD COLUMN "ghsKlassen" TEXT;
ALTER TABLE "Artikel" ADD COLUMN "hSaetze" TEXT;
ALTER TABLE "Artikel" ADD COLUMN "pSaetze" TEXT;
ALTER TABLE "Artikel" ADD COLUMN "signalwort" TEXT;

-- MHD on WareineingangPosition
ALTER TABLE "WareineingangPosition" ADD COLUMN "mhd" DATETIME;

-- Cross-Docking on Wareneingang
ALTER TABLE "Wareneingang" ADD COLUMN "istCrossDocking" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Wareneingang" ADD COLUMN "lieferungId" INTEGER;

-- ChargenZertifikat table
CREATE TABLE "ChargenZertifikat" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "chargeNr" TEXT NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "dateiname" TEXT NOT NULL,
    "pfad" TEXT NOT NULL,
    "typ" TEXT,
    "groesse" INTEGER,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ChargenZertifikat_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ChargenZertifikat_chargeNr_idx" ON "ChargenZertifikat"("chargeNr");
CREATE INDEX "ChargenZertifikat_artikelId_idx" ON "ChargenZertifikat"("artikelId");
