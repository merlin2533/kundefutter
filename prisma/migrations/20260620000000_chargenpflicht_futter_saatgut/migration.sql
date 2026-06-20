-- Futter und Saatgut sind gesetzlich chargenpflichtig (Rückverfolgbarkeit).
-- Bestehende Artikel dieser Kategorien einmalig auf Chargenpflicht setzen.
-- Neuanlage/Änderung erzwingt das Flag zusätzlich in der API.
UPDATE "Artikel" SET "chargePflicht" = true WHERE "kategorie" IN ('Futter', 'Saatgut') AND "chargePflicht" = false;
