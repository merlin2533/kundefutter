-- Ermöglicht das Hinterlegen des vom Steuerberater gelieferten Original-PDFs je Gehaltsabrechnung,
-- damit Personal-Selbstbedienung-Accounts sich den echten Gehaltszettel selbst herunterladen/ausdrucken können.
ALTER TABLE "Gehaltsabrechnung" ADD COLUMN "belegPfad" TEXT;
ALTER TABLE "Gehaltsabrechnung" ADD COLUMN "belegDateiname" TEXT;
