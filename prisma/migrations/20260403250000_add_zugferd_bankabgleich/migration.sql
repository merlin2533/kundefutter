-- Kunde: USt-Identifikationsnummer für ZUGFeRD E-Rechnung
ALTER TABLE "Kunde" ADD COLUMN "ustIdNr" TEXT;

-- CreateTable: Kontoumsatz (Bankkontoauszug-Import & Zahlungszuordnung)
CREATE TABLE "Kontoumsatz" (
    "id"               INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kontoBezeichnung" TEXT,
    "buchungsdatum"    DATETIME NOT NULL,
    "wertstellung"     DATETIME,
    "betrag"           REAL     NOT NULL,
    "waehrung"         TEXT     NOT NULL DEFAULT 'EUR',
    "verwendungszweck" TEXT     NOT NULL,
    "gegenkonto"       TEXT,
    "gegenkontoName"   TEXT,
    "saldo"            REAL,
    "zugeordnet"       INTEGER  NOT NULL DEFAULT 0,
    "lieferungId"      INTEGER,
    "sammelrechnungId" INTEGER,
    "ausgabeId"        INTEGER,
    "importDatum"      DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "importDatei"      TEXT
);

CREATE INDEX "Kontoumsatz_buchungsdatum_idx" ON "Kontoumsatz"("buchungsdatum");
CREATE INDEX "Kontoumsatz_zugeordnet_idx"    ON "Kontoumsatz"("zugeordnet");
CREATE INDEX "Kontoumsatz_betrag_idx"        ON "Kontoumsatz"("betrag");
