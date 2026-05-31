-- AlterTable: Ausgabe – DATEV Buchungskonten-Felder
ALTER TABLE "Ausgabe" ADD COLUMN "buchungstyp"             TEXT NOT NULL DEFAULT 'Betriebsausgabe';
ALTER TABLE "Ausgabe" ADD COLUMN "sachkonto"               TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "kostenstelle"            TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "zahlungsweg"             TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "reiseZiel"               TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "reiseKm"                 REAL;
ALTER TABLE "Ausgabe" ADD COLUMN "reiseKilometerpauschale" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Ausgabe" ADD COLUMN "reiseZweck"              TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "bewirtungTeilnehmer"     TEXT;
ALTER TABLE "Ausgabe" ADD COLUMN "bewirtungZweck"          TEXT;

-- CreateIndex
CREATE INDEX "Ausgabe_buchungstyp_idx"  ON "Ausgabe"("buchungstyp");
CREATE INDEX "Ausgabe_zahlungsweg_idx"  ON "Ausgabe"("zahlungsweg");
CREATE INDEX "Ausgabe_kostenstelle_idx" ON "Ausgabe"("kostenstelle");
