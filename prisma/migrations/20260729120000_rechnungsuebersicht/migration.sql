-- Rechnungsübersicht: reines Übersichtsdokument über bereits ausgestellte
-- Einzelrechnungen (Lieferungen mit gesetzter rechnungNr) eines Kunden. Im
-- Unterschied zur Sammelrechnung wird keine neue Rechnungsnummer vergeben und
-- die referenzierten Lieferungen bleiben unverändert eigenständige Rechnungen
-- (deshalb M:N über RechnungsuebersichtEintrag statt exklusiver 1:N-Zuordnung).

CREATE TABLE "Rechnungsuebersicht" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "titel" TEXT,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Rechnungsuebersicht_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Rechnungsuebersicht_kundeId_idx" ON "Rechnungsuebersicht"("kundeId");

CREATE TABLE "RechnungsuebersichtEintrag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "rechnungsuebersichtId" INTEGER NOT NULL,
    "lieferungId" INTEGER NOT NULL,
    CONSTRAINT "RechnungsuebersichtEintrag_rechnungsuebersichtId_fkey" FOREIGN KEY ("rechnungsuebersichtId") REFERENCES "Rechnungsuebersicht" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RechnungsuebersichtEintrag_lieferungId_fkey" FOREIGN KEY ("lieferungId") REFERENCES "Lieferung" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "RechnungsuebersichtEintrag_rechnungsuebersichtId_lieferungId_key" ON "RechnungsuebersichtEintrag"("rechnungsuebersichtId", "lieferungId");
CREATE INDEX "RechnungsuebersichtEintrag_lieferungId_idx" ON "RechnungsuebersichtEintrag"("lieferungId");
