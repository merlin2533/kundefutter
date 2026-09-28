-- Eierhandel Stage 1: Packstellen-Zulassungsnummer + lose/verpackt
-- Artikel.verpackungsart: "lose" | "verpackt", nullable (nur für Eier-Artikel relevant)
-- Lieferposition.verpackungsart: eingefrorener Snapshot bei Positionserstellung (analog mwstSatz)
ALTER TABLE "Artikel" ADD COLUMN "verpackungsart" TEXT;
ALTER TABLE "Lieferposition" ADD COLUMN "verpackungsart" TEXT;
