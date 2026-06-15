-- Manuell anpassbare Lieferschein-Nummer auf der Rechnung (Default: Lieferungs-ID/Auftrag)
ALTER TABLE "Lieferung" ADD COLUMN "lieferscheinNr" TEXT;
