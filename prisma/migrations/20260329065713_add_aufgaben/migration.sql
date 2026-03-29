-- CreateTable
CREATE TABLE "Aufgabe" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "betreff" TEXT NOT NULL,
    "beschreibung" TEXT,
    "faelligAm" DATETIME,
    "erledigt" BOOLEAN NOT NULL DEFAULT false,
    "erledigtAm" DATETIME,
    "prioritaet" TEXT NOT NULL DEFAULT 'normal',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "typ" TEXT NOT NULL DEFAULT 'aufgabe',
    "kundeId" INTEGER,
    "erstellt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "aktualisiert" DATETIME NOT NULL,
    CONSTRAINT "Aufgabe_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Aufgabe_kundeId_idx" ON "Aufgabe"("kundeId");

-- CreateIndex
CREATE INDEX "Aufgabe_erledigt_idx" ON "Aufgabe"("erledigt");

-- CreateIndex
CREATE INDEX "Aufgabe_faelligAm_idx" ON "Aufgabe"("faelligAm");
