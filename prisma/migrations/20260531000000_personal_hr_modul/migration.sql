-- CreateTable
CREATE TABLE "Mitarbeiter" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "vorname" TEXT NOT NULL,
    "nachname" TEXT NOT NULL,
    "typ" TEXT NOT NULL DEFAULT 'festgehalt',
    "eintrittsdatum" DATETIME NOT NULL,
    "austrittsdatum" DATETIME,
    "aktiv" BOOLEAN NOT NULL DEFAULT 1,
    "email" TEXT,
    "telefon" TEXT,
    "iban" TEXT,
    "bic" TEXT,
    "kontoinhaber" TEXT,
    "grundgehalt" REAL,
    "minijobPauschale" REAL,
    "stundenlohn" REAL,
    "wochenstunden" REAL,
    "urlaubstageProJahr" INTEGER NOT NULL DEFAULT 0,
    "kostenstelle" TEXT,
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Arbeitsstunde" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mitarbeiterId" INTEGER NOT NULL,
    "datum" DATETIME NOT NULL,
    "stunden" REAL NOT NULL,
    "art" TEXT NOT NULL DEFAULT 'arbeit',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Arbeitsstunde_mitarbeiterId_fkey" FOREIGN KEY ("mitarbeiterId") REFERENCES "Mitarbeiter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Gehaltsabrechnung" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mitarbeiterId" INTEGER NOT NULL,
    "monat" INTEGER NOT NULL,
    "jahr" INTEGER NOT NULL,
    "stundenGesamt" REAL,
    "brutto" REAL NOT NULL,
    "netto" REAL NOT NULL,
    "abzuege" REAL NOT NULL DEFAULT 0,
    "notiz" TEXT,
    "status" TEXT NOT NULL DEFAULT 'OFFEN',
    "zahlungsDatum" DATETIME,
    "ausgabeId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Gehaltsabrechnung_mitarbeiterId_fkey" FOREIGN KEY ("mitarbeiterId") REFERENCES "Mitarbeiter" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Urlaubsantrag" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "mitarbeiterId" INTEGER NOT NULL,
    "von" DATETIME NOT NULL,
    "bis" DATETIME NOT NULL,
    "tage" REAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BEANTRAGT',
    "notiz" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Urlaubsantrag_mitarbeiterId_fkey" FOREIGN KEY ("mitarbeiterId") REFERENCES "Mitarbeiter" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Mitarbeiter_aktiv_idx" ON "Mitarbeiter"("aktiv");

-- CreateIndex
CREATE INDEX "Mitarbeiter_typ_idx" ON "Mitarbeiter"("typ");

-- CreateIndex
CREATE INDEX "Arbeitsstunde_mitarbeiterId_idx" ON "Arbeitsstunde"("mitarbeiterId");

-- CreateIndex
CREATE INDEX "Arbeitsstunde_datum_idx" ON "Arbeitsstunde"("datum");

-- CreateIndex
CREATE INDEX "Arbeitsstunde_mitarbeiterId_datum_idx" ON "Arbeitsstunde"("mitarbeiterId", "datum");

-- CreateIndex
CREATE UNIQUE INDEX "Gehaltsabrechnung_ausgabeId_key" ON "Gehaltsabrechnung"("ausgabeId");

-- CreateIndex
CREATE UNIQUE INDEX "Gehaltsabrechnung_mitarbeiterId_monat_jahr_key" ON "Gehaltsabrechnung"("mitarbeiterId", "monat", "jahr");

-- CreateIndex
CREATE INDEX "Gehaltsabrechnung_status_idx" ON "Gehaltsabrechnung"("status");

-- CreateIndex
CREATE INDEX "Gehaltsabrechnung_mitarbeiterId_idx" ON "Gehaltsabrechnung"("mitarbeiterId");

-- CreateIndex
CREATE INDEX "Gehaltsabrechnung_jahr_monat_idx" ON "Gehaltsabrechnung"("jahr", "monat");

-- CreateIndex
CREATE INDEX "Urlaubsantrag_mitarbeiterId_idx" ON "Urlaubsantrag"("mitarbeiterId");

-- CreateIndex
CREATE INDEX "Urlaubsantrag_status_idx" ON "Urlaubsantrag"("status");

-- CreateIndex
CREATE INDEX "Urlaubsantrag_von_bis_idx" ON "Urlaubsantrag"("von", "bis");
