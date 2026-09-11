-- Tatsächliche Kommen-/Gehen-Zeit je Arbeitsstunden-Eintrag (Format "HH:MM"), zusätzlich zur
-- bereits vorhandenen reinen Gesamtstundenzahl — für die arbeitsrechtliche Aufzeichnungspflicht
-- (Beginn/Ende der täglichen Arbeitszeit, nicht nur die Dauer). Beide Felder bleiben optional:
-- Urlaub/Krank/Feiertag sowie bereits bestehende Alteinträge kennen keine Uhrzeiten.
ALTER TABLE "Arbeitsstunde" ADD COLUMN "von" TEXT;
ALTER TABLE "Arbeitsstunde" ADD COLUMN "bis" TEXT;
