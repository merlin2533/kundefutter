-- Migration: Lieferant IBAN/BIC/Kontoinhaber + EingangsRechnung zahlungsDatum

ALTER TABLE "Lieferant" ADD COLUMN "iban" TEXT;
ALTER TABLE "Lieferant" ADD COLUMN "bic" TEXT;
ALTER TABLE "Lieferant" ADD COLUMN "kontoinhaber" TEXT;

ALTER TABLE "EingangsRechnung" ADD COLUMN "zahlungsDatum" DATETIME;
