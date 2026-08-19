-- Manueller Override der automatisch berechneten Mahnstufe (1|2|3), null = automatisch.
-- Ermöglicht z.B. einen Brief ohne Mahngebühr, indem man auf Stufe 1 zurückstuft.
ALTER TABLE "Lieferung" ADD COLUMN "manuelleMahnstufe" INTEGER;
