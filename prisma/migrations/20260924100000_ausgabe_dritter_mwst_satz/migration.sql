-- Dritter Netto-/MwSt-Anteil für Ausgaben-Belege mit gemischten Sätzen auf einer
-- Rechnung (z.B. Bewirtung: Speisen 7 % / Getränke 19 % / Trinkgeld 0 %). Beide
-- Felder optional, nur gesetzt wenn ein Beleg tatsächlich drei Sätze mitbringt;
-- setzt keinen bereits gesetzten zweiten Anteil voraus. Analog für die KI-Batch-Review
-- (KiAusgabenBatchItem), die vor dem Übernehmen dieselben Felder kennt.
ALTER TABLE "Ausgabe" ADD COLUMN "betragNetto3" REAL;
ALTER TABLE "Ausgabe" ADD COLUMN "mwstSatz3" REAL;
ALTER TABLE "KiAusgabenBatchItem" ADD COLUMN "betragNetto3" REAL;
ALTER TABLE "KiAusgabenBatchItem" ADD COLUMN "mwstSatz3" REAL;
