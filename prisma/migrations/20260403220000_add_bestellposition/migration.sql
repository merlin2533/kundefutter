-- CreateTable: Bestellposition (Lieferanten-Bestellliste)
CREATE TABLE "Bestellposition" (
    "id"            INTEGER  NOT NULL PRIMARY KEY AUTOINCREMENT,
    "lieferantId"   INTEGER  NOT NULL,
    "artikelId"     INTEGER  NOT NULL,
    "kundeId"       INTEGER,
    "lieferungId"   INTEGER,
    "angebotId"     INTEGER,
    "menge"         REAL     NOT NULL,
    "einheit"       TEXT     NOT NULL DEFAULT 'kg',
    "einkaufspreis" REAL     NOT NULL DEFAULT 0,
    "status"        TEXT     NOT NULL DEFAULT 'offen',
    "bestelltAm"    DATETIME,
    "geliefertAm"   DATETIME,
    "notiz"         TEXT,
    "createdAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Bestellposition_lieferantId_fkey" FOREIGN KEY ("lieferantId") REFERENCES "Lieferant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bestellposition_artikelId_fkey"   FOREIGN KEY ("artikelId")   REFERENCES "Artikel"   ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Bestellposition_kundeId_fkey"     FOREIGN KEY ("kundeId")     REFERENCES "Kunde"     ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Bestellposition_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Bestellposition_lieferantId_idx" ON "Bestellposition"("lieferantId");
CREATE INDEX "Bestellposition_artikelId_idx"   ON "Bestellposition"("artikelId");
CREATE INDEX "Bestellposition_status_idx"       ON "Bestellposition"("status");
CREATE INDEX "Bestellposition_lieferungId_idx"  ON "Bestellposition"("lieferungId");
