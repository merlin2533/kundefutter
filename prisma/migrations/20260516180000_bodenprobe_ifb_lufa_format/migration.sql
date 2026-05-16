-- Bodenprobe: Vollständige Erfassung des IfB-/LUFA-Nord-West-Prüfberichts.
--
-- Hintergrund (Praxisfeedback): Original-Bodenproben-PDFs der LUFA Nord-West
-- enthalten typischerweise 15+ Schläge pro Bericht (Sammelauftrag) und
-- liefern zusätzlich zur reinen Werteliste eine Düngungsempfehlung als
-- Tabelle pro Schlag und Nutzungsvariante. Außerdem verwendet die LWK
-- Niedersachsen Gehaltsklassen A–F (nicht nur A–E).
--
-- Diese Migration ergänzt:
--   * Auftrags-/Meta-Felder (nutzungsart, bodenartGruppe, pHSoll, auftragsNr,
--     probenehmer, kundeNrLabor).
--   * Natrium-Wert + Klasse (CAT-Methode).
--   * Corg und N-Gesamt aus dem Berichtsblock (waren bisher nur indirekt
--     über cn/humus repräsentiert).
--   * Kalkbedarf in dt CaO/ha (IfB-Einheit) zusätzlich zum bestehenden
--     t-CaO/ha-Feld (legacy für interne Berechnung).
--   * empfehlungenJson: JSON-Blob der Düngungsempfehlungs-Tabelle aus der
--     PDF-Anlage (Spalten pro Nutzungsvariante), damit die LUFA-Empfehlung
--     1:1 wieder anzeigbar und exportierbar ist.

ALTER TABLE "Bodenprobe" ADD COLUMN "bodenartGruppe" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "nutzungsart" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "pHSoll" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "auftragsNr" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "probenehmer" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "kundeNrLabor" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "natrium" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "klasseNatrium" TEXT;
ALTER TABLE "Bodenprobe" ADD COLUMN "corg" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "nGesamt" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "kalkbedarfDt" REAL;
ALTER TABLE "Bodenprobe" ADD COLUMN "empfehlungenJson" TEXT;
