-- CreateTable
CREATE TABLE "Umsatzziel" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "jahr" INTEGER NOT NULL,
    "monat" INTEGER,
    "kategorie" TEXT,
    "zielBetrag" REAL NOT NULL,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Umsatzziel_jahr_monat_kategorie_key" ON "Umsatzziel"("jahr", "monat", "kategorie");

-- CreateIndex
CREATE INDEX "Umsatzziel_jahr_idx" ON "Umsatzziel"("jahr");
