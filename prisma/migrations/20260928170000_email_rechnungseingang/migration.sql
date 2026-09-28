-- Automatischer E-Mail-Rechnungseingang (IMAP-Postfach oder Microsoft 365) für Eingangsrechnungen.
-- Verarbeitung landet bewusst im bereits vorhandenen KiEingangsrechnungBatch/-Item-Mechanismus
-- (menschliches "Verbuchen" bleibt der bestehende PUT .../abschliessen-Aufruf) statt eine eigene,
-- direkt geschriebene EingangsRechnung anzulegen — siehe lib/email-eingang-verarbeitung.ts.

ALTER TABLE "KiEingangsrechnungBatch" ADD COLUMN "quelle" TEXT NOT NULL DEFAULT 'upload';
CREATE INDEX "KiEingangsrechnungBatch_quelle_idx" ON "KiEingangsrechnungBatch"("quelle");

ALTER TABLE "KiEingangsrechnungBatchItem" ADD COLUMN "mailImportId" INTEGER;
ALTER TABLE "KiEingangsrechnungBatchItem" ADD COLUMN "dateiHash" TEXT;
CREATE INDEX "KiEingangsrechnungBatchItem_mailImportId_idx" ON "KiEingangsrechnungBatchItem"("mailImportId");
CREATE INDEX "KiEingangsrechnungBatchItem_dateiHash_idx" ON "KiEingangsrechnungBatchItem"("dateiHash");

CREATE TABLE "EingangsRechnungMailImport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "provider" TEXT NOT NULL,
    "postfach" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "von" TEXT NOT NULL,
    "betreff" TEXT,
    "empfangenAm" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'neu',
    "anhaengeAnzahl" INTEGER NOT NULL DEFAULT 0,
    "fehlerText" TEXT,
    "versuche" INTEGER NOT NULL DEFAULT 0,
    "batchId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "EingangsRechnungMailImport_provider_postfach_messageId_key" ON "EingangsRechnungMailImport"("provider", "postfach", "messageId");
CREATE INDEX "EingangsRechnungMailImport_status_idx" ON "EingangsRechnungMailImport"("status");
CREATE INDEX "EingangsRechnungMailImport_empfangenAm_idx" ON "EingangsRechnungMailImport"("empfangenAm");
