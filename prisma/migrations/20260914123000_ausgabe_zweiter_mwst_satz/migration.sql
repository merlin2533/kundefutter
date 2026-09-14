-- Zweiter Netto-/MwSt-Anteil für Ausgaben-Belege mit gemischten Sätzen auf einer
-- Rechnung (z.B. Bewirtung: Speisen 7 % / Getränke 19 %). Beide Felder optional,
-- nur gesetzt wenn ein Beleg tatsächlich zwei Sätze mitbringt.
ALTER TABLE "Ausgabe" ADD COLUMN "betragNetto2" REAL;
ALTER TABLE "Ausgabe" ADD COLUMN "mwstSatz2" REAL;
