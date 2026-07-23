-- Das Modell "Anlieferung" (Erzeugerabrechnung) war seit der ersten Version dieses
-- Repos im Prisma-Schema definiert, aber es wurde nie eine Migration dafür erzeugt —
-- "prisma migrate deploy" legt die Tabelle daher bislang nirgends an.

-- CreateTable
CREATE TABLE "Anlieferung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "nummer" TEXT NOT NULL,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "kundeId" INTEGER NOT NULL,
    "artikelId" INTEGER NOT NULL,
    "menge" REAL NOT NULL,
    "einheit" TEXT NOT NULL DEFAULT 't',
    "feuchte" REAL,
    "qualitaet" TEXT,
    "preisProEinheit" REAL,
    "gesamtBetrag" REAL,
    "notiz" TEXT,
    "gutschriftId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Anlieferung_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Anlieferung_artikelId_fkey" FOREIGN KEY ("artikelId") REFERENCES "Artikel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Anlieferung_gutschriftId_fkey" FOREIGN KEY ("gutschriftId") REFERENCES "Gutschrift" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Anlieferung_nummer_key" ON "Anlieferung"("nummer");

-- CreateIndex
CREATE UNIQUE INDEX "Anlieferung_gutschriftId_key" ON "Anlieferung"("gutschriftId");

-- CreateIndex
CREATE INDEX "Anlieferung_kundeId_idx" ON "Anlieferung"("kundeId");

-- CreateIndex
CREATE INDEX "Anlieferung_datum_idx" ON "Anlieferung"("datum");
