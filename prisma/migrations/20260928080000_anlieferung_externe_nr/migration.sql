-- Eierhandel Stage 2: CSV/XLS-Import für Anlieferung + EierSortierung
-- Anlieferung.externeNr: Idempotenz-Schlüssel für den Import (z.B. Belegnummer der Waage) —
-- nullable, mehrere NULLs je kundeId kollidieren in SQLite nicht (NULL <> NULL), ein
-- wiederholter Import derselben externen Belegnummer für denselben Kunden aber schon.
ALTER TABLE "Anlieferung" ADD COLUMN "externeNr" TEXT;

CREATE UNIQUE INDEX "Anlieferung_kundeId_externeNr_key" ON "Anlieferung"("kundeId", "externeNr");
