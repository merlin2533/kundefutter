-- Congruence/Competitor features wave 5:
--   Bodenproben, Düngebedarfsermittlung, Sachkundenachweise,
--   Sortenversuche, Vorbestellungen + Frühbezugsstaffel, VVVO-Nr

-- ─── Kunde: VVVO-Nummer ──────────────────────────────────────────────────────
ALTER TABLE "Kunde" ADD COLUMN "vvvoNr" TEXT;

-- ─── BODENPROBEN ─────────────────────────────────────────────────────────────
CREATE TABLE "Bodenprobe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schlagId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL,
    "probenNr" TEXT,
    "labor" TEXT,
    "tiefe" TEXT,
    "pH" REAL,
    "phosphor" REAL,
    "kalium" REAL,
    "magnesium" REAL,
    "bor" REAL,
    "humus" REAL,
    "nMin" REAL,
    "cn" REAL,
    "bodenart" TEXT,
    "klasse" TEXT,
    "notiz" TEXT,
    "belegPfad" TEXT,
    "belegName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bodenprobe_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Bodenprobe_schlagId_idx" ON "Bodenprobe"("schlagId");
CREATE INDEX "Bodenprobe_datum_idx" ON "Bodenprobe"("datum");

-- ─── DÜNGEBEDARFSERMITTLUNG ──────────────────────────────────────────────────
CREATE TABLE "Duengebedarf" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schlagId" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "fruchtart" TEXT NOT NULL,
    "ertragsZiel" REAL,
    "vorfrucht" TEXT,
    "bodenprobeId" INTEGER,
    "nBedarf" REAL NOT NULL,
    "pBedarf" REAL NOT NULL,
    "kBedarf" REAL NOT NULL,
    "mgBedarf" REAL,
    "parameter" TEXT,
    "notiz" TEXT,
    "berechnetAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Duengebedarf_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Duengebedarf_bodenprobeId_fkey" FOREIGN KEY ("bodenprobeId") REFERENCES "Bodenprobe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Duengebedarf_schlagId_idx" ON "Duengebedarf"("schlagId");
CREATE INDEX "Duengebedarf_jahr_idx" ON "Duengebedarf"("jahr");

-- ─── SACHKUNDENACHWEISE ──────────────────────────────────────────────────────
CREATE TABLE "Sachkundenachweis" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "typ" TEXT NOT NULL,
    "nummer" TEXT,
    "ausstellung" DATETIME,
    "gueltigBis" DATETIME,
    "ausgestelltVon" TEXT,
    "notiz" TEXT,
    "belegPfad" TEXT,
    "belegName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sachkundenachweis_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "Sachkundenachweis_kundeId_idx" ON "Sachkundenachweis"("kundeId");
CREATE INDEX "Sachkundenachweis_gueltigBis_idx" ON "Sachkundenachweis"("gueltigBis");
CREATE INDEX "Sachkundenachweis_typ_idx" ON "Sachkundenachweis"("typ");

-- ─── SORTENVERSUCHE ──────────────────────────────────────────────────────────
CREATE TABLE "Sortenversuch" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "jahr" INTEGER NOT NULL,
    "kultur" TEXT NOT NULL,
    "standort" TEXT,
    "kundeId" INTEGER,
    "schlagId" INTEGER,
    "flaeche" REAL,
    "status" TEXT NOT NULL DEFAULT 'LAUFEND',
    "startDatum" DATETIME,
    "endeDatum" DATETIME,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Sortenversuch_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Sortenversuch_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Sortenversuch_jahr_idx" ON "Sortenversuch"("jahr");
CREATE INDEX "Sortenversuch_kultur_idx" ON "Sortenversuch"("kultur");
CREATE INDEX "Sortenversuch_kundeId_idx" ON "Sortenversuch"("kundeId");

CREATE TABLE "SortenversuchPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "versuchId" INTEGER NOT NULL,
    "sorte" TEXT NOT NULL,
    "saatstaerke" REAL,
    "ertragDtHa" REAL,
    "feuchteProzent" REAL,
    "proteinProzent" REAL,
    "hektolitergew" REAL,
    "bonitur" INTEGER,
    "reife" TEXT,
    "notiz" TEXT,
    CONSTRAINT "SortenversuchPosition_versuchId_fkey" FOREIGN KEY ("versuchId") REFERENCES "Sortenversuch" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "SortenversuchPosition_versuchId_idx" ON "SortenversuchPosition"("versuchId");
CREATE INDEX "SortenversuchPosition_sorte_idx" ON "SortenversuchPosition"("sorte");

-- ─── VORBESTELLUNGEN (Frühbezug) ─────────────────────────────────────────────
CREATE TABLE "Vorbestellung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "kundeId" INTEGER NOT NULL,
    "saison" TEXT NOT NULL,
    "bestelldatum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lieferdatum" DATETIME,
    "bestellfrist" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "rabattProzent" REAL,
    "notiz" TEXT,
    "lieferungId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Vorbestellung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Vorbestellung_nummer_key" ON "Vorbestellung"("nummer");
CREATE INDEX "Vorbestellung_kundeId_idx" ON "Vorbestellung"("kundeId");
CREATE INDEX "Vorbestellung_status_idx" ON "Vorbestellung"("status");
CREATE INDEX "Vorbestellung_bestellfrist_idx" ON "Vorbestellung"("bestellfrist");
CREATE INDEX "Vorbestellung_saison_idx" ON "Vorbestellung"("saison");

CREATE TABLE "VorbestellungPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vorbestellungId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "preis" REAL,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    "reserviert" BOOLEAN NOT NULL DEFAULT false,
    "notiz" TEXT,
    CONSTRAINT "VorbestellungPosition_vorbestellungId_fkey" FOREIGN KEY ("vorbestellungId") REFERENCES "Vorbestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "VorbestellungPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "VorbestellungPosition_vorbestellungId_idx" ON "VorbestellungPosition"("vorbestellungId");
CREATE INDEX "VorbestellungPosition_artikelId_idx" ON "VorbestellungPosition"("artikelId");

CREATE TABLE "FruehbezugsStaffel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "saison" TEXT NOT NULL,
    "kategorie" TEXT,
    "artikelId" INTEGER,
    "bestellfrist" DATETIME NOT NULL,
    "rabattProzent" REAL NOT NULL,
    "beschreibung" TEXT,
    "aktiv" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FruehbezugsStaffel_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "FruehbezugsStaffel_saison_idx" ON "FruehbezugsStaffel"("saison");
CREATE INDEX "FruehbezugsStaffel_bestellfrist_idx" ON "FruehbezugsStaffel"("bestellfrist");
CREATE INDEX "FruehbezugsStaffel_aktiv_idx" ON "FruehbezugsStaffel"("aktiv");
