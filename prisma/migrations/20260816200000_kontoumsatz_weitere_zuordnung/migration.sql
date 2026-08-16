-- Zusätzliche Rechnungen, die per DERSELBEN Zahlung beglichen wurden (Kunde
-- überweist mehrere offene Rechnungen in einer Sammelüberweisung). Die
-- Haupt-Rechnung bleibt weiterhin über Kontoumsatz.lieferungId/
-- sammelrechnungId zugeordnet, jede weitere landet hier.

CREATE TABLE "KontoumsatzWeitereZuordnung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kontoumsatzId" INTEGER NOT NULL,
    "lieferungId" INTEGER,
    "sammelrechnungId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KontoumsatzWeitereZuordnung_kontoumsatzId_fkey" FOREIGN KEY ("kontoumsatzId") REFERENCES "Kontoumsatz" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "KontoumsatzWeitereZuordnung_kontoumsatzId_idx" ON "KontoumsatzWeitereZuordnung"("kontoumsatzId");
CREATE INDEX "KontoumsatzWeitereZuordnung_lieferungId_idx" ON "KontoumsatzWeitereZuordnung"("lieferungId");
CREATE INDEX "KontoumsatzWeitereZuordnung_sammelrechnungId_idx" ON "KontoumsatzWeitereZuordnung"("sammelrechnungId");
