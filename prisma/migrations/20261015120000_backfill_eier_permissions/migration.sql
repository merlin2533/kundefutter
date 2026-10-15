-- Eierhandel: Die Routen /api/eiersortierung, /api/eiersortierung/import und
-- /api/exporte/kat-meldung waren bisher nur modul-, aber nicht berechtigungsgesperrt.
-- Neue Aktions-Permissions (lib/permissions.ts); damit bestehende Rollen nichts verlieren,
-- was sie bisher konnten, wird nachgetragen (ROLLE_PRESETS gilt nur für NEUE Rollen):
--   a.eier.sortierung.erstellen / .loeschen -> jede Rolle mit Lager-Aktionsrechten (a.lager.wareneingang/-korrektur; so bleibt eine reine Lese-Rolle schreibgeschützt)
--   a.export.kat                            -> jede Rolle mit a.export.datev (Buchhaltungs-Export)
-- "buero" bekommt unconditional alle drei (Code-Preset leitet buero aus ALL_PERMISSIONS ab).
-- Idempotent (NOT EXISTS), "*"-Rollen ausgenommen.

UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.eier.sortierung.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND (EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lager.wareneingang', 'a.lager.korrektur')))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.eier.sortierung.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.eier.sortierung.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND (EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lager.wareneingang', 'a.lager.korrektur')))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.eier.sortierung.loeschen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.export.kat')
WHERE json_valid(berechtigungen) = 1
  AND (EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.export.datev'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.export.kat', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.eier.sortierung.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.eier.sortierung.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.eier.sortierung.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.eier.sortierung.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.export.kat')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.export.kat');
