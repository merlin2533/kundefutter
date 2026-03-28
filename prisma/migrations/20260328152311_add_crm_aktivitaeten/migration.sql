-- CreateTable
CREATE TABLE "KundeAktivitaet" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "kundeId" INTEGER NOT NULL,
    "typ" TEXT NOT NULL,
    "betreff" TEXT NOT NULL,
    "inhalt" TEXT,
    "datum" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "erledigt" BOOLEAN NOT NULL DEFAULT false,
    "faelligAm" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "KundeAktivitaet_kundeId_fkey" FOREIGN KEY ("kundeId") REFERENCES "Kunde" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "KundeAktivitaet_kundeId_idx" ON "KundeAktivitaet"("kundeId");

-- CreateIndex
CREATE INDEX "KundeAktivitaet_datum_idx" ON "KundeAktivitaet"("datum");

-- CreateIndex
CREATE INDEX "KundeAktivitaet_faelligAm_idx" ON "KundeAktivitaet"("faelligAm");
