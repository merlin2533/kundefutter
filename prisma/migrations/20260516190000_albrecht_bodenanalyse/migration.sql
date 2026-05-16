-- Albrecht-Bodenanalyse (Geobüro Christophel, ALBRECHT PLUS)
-- Kein Ersatz für DüV-Düngebedarfsermittlung — nur Bodenstruktur-Beratung.

CREATE TABLE "BodenanalyseAlbrecht" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schlagId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL,
    "probenId" TEXT,
    "kultur" TEXT,
    "tiefe" TEXT,
    "bodenart" TEXT,

    -- Basisdaten
    "phH2O" REAL,
    "phKCl" REAL,
    "kak" REAL,
    "humus" REAL,
    "nGesamt" REAL,
    "cn" REAL,
    "nNachlieferung" REAL,
    "caCo3" REAL,
    "leitfaehigkeit" REAL,

    -- Kationen-Sättigung %
    "caSaettigung" REAL,
    "mgSaettigung" REAL,
    "kSaettigung" REAL,
    "naSaettigung" REAL,
    "hSaettigung" REAL,
    "variabelSaett" REAL,

    -- Kationen-Vorräte kg/ha
    "caVorrat" REAL,
    "mgVorrat" REAL,
    "kVorrat" REAL,
    "naVorrat" REAL,

    -- Anionen + Phosphor
    "schwefel" REAL,
    "p2o5Verfuegbar" REAL,
    "p2o5Vorrat" REAL,

    -- Spurenelemente ppm
    "bor" REAL,
    "eisen" REAL,
    "mangan" REAL,
    "kupfer" REAL,
    "zink" REAL,
    "chlorid" REAL,
    "silizium" REAL,
    "kobalt" REAL,
    "molybdaen" REAL,
    "selen" REAL,

    -- Empfehlungen JSON + Metadaten
    "empfehlungenJson" TEXT,
    "notiz" TEXT,
    "belegPfad" TEXT,
    "belegName" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BodenanalyseAlbrecht_schlagId_fkey"
        FOREIGN KEY ("schlagId") REFERENCES "KundeSchlag" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BodenanalyseAlbrecht_schlagId_idx" ON "BodenanalyseAlbrecht"("schlagId");
CREATE INDEX "BodenanalyseAlbrecht_datum_idx" ON "BodenanalyseAlbrecht"("datum");
