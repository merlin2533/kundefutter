-- Bodenprobe: Versorgungsklasse pro Nährstoff (P, K, Mg, Bor) statt einer Sammelklasse.
--
-- Beobachtung aus dem Praxisfeedback: Die VDLUFA-Versorgungsklasse ist je
-- Nährstoff unterschiedlich (z.B. P in Klasse D, K in C, Mg in B). Eine
-- einzelne `klasse`-Spalte konnte das nicht abbilden und führte zu falschen
-- Düngeempfehlungen, weil die Korrektur in lib/duengebedarf.ts nur auf P
-- zugriff.
--
-- Migration:
--   1. Vier neue nullable Spalten anlegen (klasseP, klasseK, klasseMg, klasseBor).
--   2. Bestehende `klasse`-Werte als Initial-Schätzung in klasseP/K/Mg spiegeln,
--      da die alte Spalte als "Hauptnährstoffe" gedacht war.
--   3. Die alte `klasse`-Spalte bleibt vorerst erhalten (deprecated) — sie wird
--      von API/UI nicht mehr beschrieben, aber DROP COLUMN wird vermieden, um
--      Datenverlust bei einem versehentlichen Rollback auszuschließen.

ALTER TABLE "Bodenprobe" ADD COLUMN "klasseP" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseK" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseMg" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseBor" TEXT;

UPDATE "Bodenprobe"
   SET "klasseP"  = "klasse",
       "klasseK"  = "klasse",
       "klasseMg" = "klasse"
 WHERE "klasse" IS NOT NULL
   AND "klasseP" IS NULL
   AND "klasseK" IS NULL
   AND "klasseMg" IS NULL;

-- Erweiterte Nährstoffe — Schwefel, Mikronährstoffe (Zn, Cu, Mn),
-- Kationenaustauschkapazität, Kalkbedarf. Alle nullable, weil
-- nicht jedes Labor sie liefert (Standard-Bodenuntersuchung vs. Premium).
ALTER TABLE "Bodenprobe" ADD COLUMN "schwefel" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "zink" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "kupfer" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "mangan" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "kak" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "kalkbedarf" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseSchwefel" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseZink" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseKupfer" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseMangan" TEXT;
