-- Competitor features: Kreditlimit, Sachkunde, PSM, Bestellungen, Kontrakte, Kampagnen, Eingangsrechnungen

-- Neue Felder an Kunde
ALTER TABLE "Kunde" ADD COLUMN "kreditlimit" REAL;
ALTER TABLE "Kunde" ADD COLUMN "sachkundeNr" TEXT;
ALTER TABLE "Kunde" ADD COLUMN "sachkundeGueltigBis" DATETIME;

-- PSM-Ausbringung
CREATE TABLE "PsmAusbringung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "schlagId" INTEGER,
    "datum" DATETIME NOT NULL,
    "mittel" TEXT NOT NULL,
    "wirkstoff" TEXT,
    "menge" REAL NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 'l/ha',
    "kultur" TEXT,
    "flaeche" REAL,
    "anwendungsgrund" TEXT,
    "wartezeit" INTEGER,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PsmAusbringung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PsmAusbringung_schlagId_fkey" FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "PsmAusbringung_kundeId_idx" ON "PsmAusbringung"("kundeId");
CREATE INDEX "PsmAusbringung_datum_idx" ON "PsmAusbringung"("datum");

-- Formelle Lieferantenbestellung
CREATE TABLE "Bestellung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "lieferantId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lieferdatum" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Bestellung_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Bestellung_nummer_key" ON "Bestellung"("nummer");
CREATE INDEX "Bestellung_lieferantId_idx" ON "Bestellung"("lieferantId");
CREATE INDEX "Bestellung_status_idx" ON "Bestellung"("status");
CREATE INDEX "Bestellung_datum_idx" ON "Bestellung"("datum");

CREATE TABLE "BestellungPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bestellungId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "mengeGeliefert" REAL NOT NULL DEFAULT 0,
    "preis" REAL,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    CONSTRAINT "BestellungPosition_bestellungId_fkey" FOREIGN KEY ("bestellungId") REFERENCES "Bestellung" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "BestellungPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "BestellungPosition_bestellungId_idx" ON "BestellungPosition"("bestellungId");
CREATE INDEX "BestellungPosition_artikelId_idx" ON "BestellungPosition"("artikelId");

-- Kontrakte
CREATE TABLE "Kontrakt" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "kundeId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gueltigVon" DATETIME NOT NULL,
    "gueltigBis" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'AKTIV',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Kontrakt_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "Kontrakt_nummer_key" ON "Kontrakt"("nummer");
CREATE INDEX "Kontrakt_kundeId_idx" ON "Kontrakt"("kundeId");
CREATE INDEX "Kontrakt_status_idx" ON "Kontrakt"("status");
CREATE INDEX "Kontrakt_gueltigBis_idx" ON "Kontrakt"("gueltigBis");

CREATE TABLE "KontraktPosition" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kontraktId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "mengeAbgerufen" REAL NOT NULL DEFAULT 0,
    "preis" REAL,
    "einheit" TEXT NOT NULL DEFAULT 'kg',
    CONSTRAINT "KontraktPosition_kontraktId_fkey" FOREIGN KEY ("kontraktId") REFERENCES "Kontrakt" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KontraktPosition_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "KontraktPosition_kontraktId_idx" ON "KontraktPosition"("kontraktId");
CREATE INDEX "KontraktPosition_artikelId_idx" ON "KontraktPosition"("artikelId");

-- Kampagnen
CREATE TABLE "Kampagne" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "beschreibung" TEXT,
    "von" DATETIME NOT NULL,
    "bis" DATETIME NOT NULL,
    "rabattProzent" REAL,
    "aktiv" BOOLEAN NOT NULL DEFAULT 1,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
CREATE INDEX "Kampagne_aktiv_idx" ON "Kampagne"("aktiv");
CREATE INDEX "Kampagne_bis_idx" ON "Kampagne"("bis");

CREATE TABLE "KampagneArtikel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kampagneId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "sonderpreis" REAL,
    CONSTRAINT "KampagneArtikel_kampagneId_fkey" FOREIGN KEY ("kampagneId") REFERENCES "Kampagne" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "KampagneArtikel_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "KampagneArtikel_kampagneId_artikelId_key" ON "KampagneArtikel"("kampagneId", "artikelId");
CREATE INDEX "KampagneArtikel_kampagneId_idx" ON "KampagneArtikel"("kampagneId");
CREATE INDEX "KampagneArtikel_artikelId_idx" ON "KampagneArtikel"("artikelId");

-- Eingangsrechnungen
CREATE TABLE "EingangsRechnung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT,
    "lieferantId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL,
    "faelligAm" DATETIME,
    "betrag" REAL NOT NULL,
    "mwst" REAL NOT NULL DEFAULT 19,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "belegpfad" TEXT,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EingangsRechnung_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "EingangsRechnung_lieferantId_idx" ON "EingangsRechnung"("lieferantId");
CREATE INDEX "EingangsRechnung_status_idx" ON "EingangsRechnung"("status");
CREATE INDEX "EingangsRechnung_faelligAm_idx" ON "EingangsRechnung"("faelligAm");
