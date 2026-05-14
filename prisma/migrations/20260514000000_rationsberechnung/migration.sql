-- Rationsberechnung: Tierhaltung je Kunde + gespeicherte Futter-Rationsberechnungen

-- KundeTier: Tier/Tiergruppe (Herde) je Kunde
CREATE TABLE "KundeTier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "tierart" TEXT NOT NULL,
    "nutzungsart" TEXT NOT NULL,
    "rasse" TEXT,
    "anzahl" INTEGER NOT NULL DEFAULT 1,
    "gewicht" REAL,
    "leistung" REAL,
    "leistungEinheit" TEXT,
    "laktationstag" INTEGER,
    "notiz" TEXT,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert" DATETIME NOT NULL,
    CONSTRAINT "KundeTier_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "KundeTier_kundeId_idx" ON "KundeTier"("kundeId");
CREATE INDEX "KundeTier_tierart_idx" ON "KundeTier"("tierart");

-- Rationsberechnung: gespeicherte Berechnung (Positionen + Ergebnis als JSON-Snapshot)
CREATE TABLE "Rationsberechnung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bezeichnung" TEXT NOT NULL,
    "tierart" TEXT NOT NULL,
    "nutzungsart" TEXT NOT NULL,
    "modus" TEXT NOT NULL DEFAULT 'simple',
    "kundeId" INTEGER,
    "kundeTierId" INTEGER,
    "gewicht" REAL,
    "leistung" REAL,
    "parameter" TEXT NOT NULL,
    "notiz" TEXT,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert" DATETIME NOT NULL,
    CONSTRAINT "Rationsberechnung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Rationsberechnung_kundeTierId_fkey" FOREIGN KEY ("kundeTierId") REFERENCES "KundeTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "Rationsberechnung_kundeId_idx" ON "Rationsberechnung"("kundeId");
CREATE INDEX "Rationsberechnung_kundeTierId_idx" ON "Rationsberechnung"("kundeTierId");
CREATE INDEX "Rationsberechnung_tierart_idx" ON "Rationsberechnung"("tierart");
CREATE INDEX "Rationsberechnung_erstellt_idx" ON "Rationsberechnung"("erstellt");
