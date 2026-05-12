-- Reklamationsmanagement + Streckengeschäft

-- Neue Felder an Lieferung
ALTER TABLE "Lieferung" ADD COLUMN "istStreckengeschaeft" BOOLEAN NOT NULL DEFAULT 0;
ALTER TABLE "Lieferung" ADD COLUMN "streckenLieferantId" INTEGER;

-- Reklamation
CREATE TABLE "Reklamation" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "kundeId" INTEGER NOT NULL,
    "lieferungId" INTEGER,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "betreff" TEXT NOT NULL,
    "beschreibung" TEXT NOT NULL,
    "kategorie" TEXT NOT NULL DEFAULT 'Qualitaet',
    "prioritaet" TEXT NOT NULL DEFAULT 'normal',
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "zugewiesen" TEXT,
    "loesung" TEXT,
    "geloestAm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Reklamation_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Reklamation_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Reklamation_nummer_key" ON "Reklamation"("nummer");
CREATE INDEX "Reklamation_kundeId_idx" ON "Reklamation"("kundeId");
CREATE INDEX "Reklamation_status_idx" ON "Reklamation"("status");
CREATE INDEX "Reklamation_datum_idx" ON "Reklamation"("datum");
CREATE INDEX "Reklamation_prioritaet_idx" ON "Reklamation"("prioritaet");
