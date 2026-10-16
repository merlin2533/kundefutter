-- Review-Runde 2: neue a.*.bearbeiten-Permissions für bisher ungeschützte Schreib-Routen.
-- ROLLE_PRESETS gilt nur für NEUE Rollen; bestehende Rolle-Datensätze werden hier nachgezogen
-- (Muster: 20260928160000_backfill_rollen_berechtigungen, idempotent, '*'-Rollen ausgenommen).
-- Rollen, die nur Lese-Seiten (s.*) haben, bekommen bewusst KEIN Schreibrecht, außer sie hatten
-- die zugehörige Fach-Aktion (a.kunden.bearbeiten etc.) bereits; 'readonly' bleibt read-only.

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.inventur.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.inventur'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.inventur.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.aufgaben.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.aufgaben','a.kunden.bearbeiten','a.kunden.erstellen'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.aufgaben.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.besuchstermine.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.besuchstermine','a.kunden.bearbeiten'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.besuchstermine.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.ausgaben.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.ausgaben','s.eingangsrechnungen'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.ausgaben.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.eingangsrechnungen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.ausgaben','s.eingangsrechnungen'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.eingangsrechnungen.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bodenproben.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.bodenproben'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bodenproben.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.duengebedarf.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.duengebedarf'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.duengebedarf.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.vorbestellungen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.vorbestellungen'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.vorbestellungen.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sortenversuche.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.sortenversuche'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.sortenversuche.bearbeiten', '*'));

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.rationsberechnung.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND name <> 'readonly'
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.rationsberechnung'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.rationsberechnung.bearbeiten', '*'));
