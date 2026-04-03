-- CreateTable: Ausgabe (Ausgabenbuch / Betriebsausgaben)
CREATE TABLE "Ausgabe" (
    "id"           INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "datum"        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "belegNr"      TEXT,
    "beschreibung" TEXT     NOT NULL,
    "betragNetto"  REAL     NOT NULL,
    "mwstSatz"     REAL     NOT NULL DEFAULT 19,
    "kategorie"    TEXT     NOT NULL DEFAULT 'Sonstige',
    "lieferantId"  INTEGER,
    "bezahltAm"    DATETIME,
    "notiz"        TEXT,
    "createdAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Ausgabe_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Ausgabe_datum_idx"      ON "Ausgabe"("datum");
CREATE INDEX "Ausgabe_lieferantId_idx" ON "Ausgabe"("lieferantId");
CREATE INDEX "Ausgabe_kategorie_idx"  ON "Ausgabe"("kategorie");
