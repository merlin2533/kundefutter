-- Stage D fügte in lib/permissions.ts 27 neue a.*-Aktionskonstanten (Gutschriften/
-- Sammelrechnungen/Bestellungen/Lieferanten/Kampagnen/Reklamationen/Kontrakte/PSM/
-- Zertifizierungen/Bankabgleich) ein und backfillte dafür ROLLE_PRESETS in
-- lib/permissions.ts. Dieser Code-Preset wird aber NUR beim Anlegen einer NEUEN Rolle
-- über /einstellungen/benutzer gelesen (app/api/rollen/route.ts) — bereits bestehende
-- Rollen-Datensätze in der Tabelle "Rolle" (angelegt u.a. durch den System-Rollen-Seed
-- 20260604000000_benutzer_rolle_berechtigungen) tragen ihre Berechtigungen als
-- eingefrorenes JSON und werden von einer Code-Änderung nie berührt. Ohne diese
-- Migration hätte jede bestehende Installation mit den seit Stage A/B/C/D neu
-- eingeführten Pflicht-Permissions unbemerkt Schreibzugriff verloren, sobald eine
-- Rolle bereits die zugehörige Seiten-Permission (s.*) hatte — exakt der Regressions-
-- Fall, den die ROLLE_PRESETS-Backfill-Regel eigentlich verhindern soll.
--
-- Muster: json_insert(...,'$[#]',...) hängt einen Wert an ein JSON-Array an (siehe
-- bereits etabliert in 20260429010000_add_einheiten_saatgut_defaults), NOT EXISTS
-- verhindert Duplikate bei wiederholtem Lauf (idempotent). "*"-Rollen (Legacy-Admin-
-- Vollzugriff) werden ausgenommen, ein Backfill dort wäre wirkungslos.

-- ── Generischer Teil: JEDE Rolle (System- und Custom-Rollen), die bereits die
-- zugehörige Seiten-Permission (s.*) hat, bekommt die passenden neuen Aktions-
-- Permissions nachgetragen — unabhängig vom Rollennamen, analog zur "hat die Rolle
-- schon s.X, dann auch a.X.*"-Logik der ROLLE_PRESETS-Kommentare in lib/permissions.ts.

-- Reklamationen (guard: s.reklamationen)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.reklamationen.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.reklamationen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.reklamationen.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.reklamationen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.reklamationen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.reklamationen.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.reklamationen.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.reklamationen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.reklamationen.loeschen', '*'));

-- Kontrakte (guard: s.kontrakte)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kontrakte.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.kontrakte')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.kontrakte.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kontrakte.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.kontrakte')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.kontrakte.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kontrakte.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.kontrakte')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.kontrakte.loeschen', '*'));

-- PSM-Ausbringung (guard: s.psm)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.psm.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.psm')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.psm.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.psm.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.psm')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.psm.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.psm.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.psm')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.psm.loeschen', '*'));

-- Zertifizierungen (guard: s.bodenproben — Nav bündelt /zertifizierungen dort, siehe
-- NAV_PERMISSION in components/Nav.tsx)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.zertifizierungen.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.bodenproben')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.zertifizierungen.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.zertifizierungen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.bodenproben')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.zertifizierungen.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.zertifizierungen.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.bodenproben')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.zertifizierungen.loeschen', '*'));

-- Bestellungen/Bestellliste (guard: s.bestellungen ODER s.bestellliste — beide Seiten
-- führen zu denselben, jetzt gated Bestellungen-Schreibrouten, siehe Review-Finding zu
-- app/api/bestellliste/route.ts)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.bestellungen', 's.bestellliste'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bestellungen.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.bestellungen', 's.bestellliste'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bestellungen.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('s.bestellungen', 's.bestellliste'))
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bestellungen.loeschen', '*'));

-- Gutschriften (guard: s.gutschriften)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.gutschriften')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.gutschriften.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.gutschriften')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.gutschriften.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.gutschriften')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.gutschriften.loeschen', '*'));

-- Sammelrechnungen (guard: s.sammelrechnungen)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sammelrechnungen.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.sammelrechnungen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.sammelrechnungen.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sammelrechnungen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.sammelrechnungen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.sammelrechnungen.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sammelrechnungen.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.sammelrechnungen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.sammelrechnungen.loeschen', '*'));

-- Bankabgleich (guard: s.bankabgleich)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bankabgleich.import')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.bankabgleich')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bankabgleich.import', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bankabgleich.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.bankabgleich')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bankabgleich.bearbeiten', '*'));

-- Lieferanten (guard: s.lieferanten — kein System-Preset hat diese Seiten-Permission,
-- greift also nur bei Custom-Rollen)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.lieferanten')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lieferanten.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.lieferanten')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lieferanten.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.lieferanten')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lieferanten.loeschen', '*'));

-- Kampagnen (guard: s.kampagnen — kein System-Preset hat diese Seiten-Permission,
-- greift also nur bei Custom-Rollen)
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kampagnen.erstellen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.kampagnen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.kampagnen.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kampagnen.bearbeiten')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.kampagnen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.kampagnen.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kampagnen.loeschen')
WHERE json_valid(berechtigungen) = 1
  AND EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 's.kampagnen')
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.kampagnen.loeschen', '*'));

-- ── Gezielter Teil: drei konkrete, per Review verifizierte Regressionen bei den
-- System-Rollen buchhalter/verkauf/lager — eingebettete Funktionen auf Seiten, deren
-- s.*-Permission sie zwar haben, die aber keine eigene Domäne im obigen generischen
-- Teil sind (Lieferanten-IBAN-Speichern aus Eingangsrechnungen/Ausgaben heraus,
-- Sammelbestellung von der Lieferungen-Seite, Gutschrift-"Wieder öffnen" von der
-- Lieferungen-Detailseite). Bewusst NUR für die drei benannten System-Rollen, nicht
-- generisch über s.lieferungen/s.eingangsrechnungen/s.ausgaben — sonst bekäme z.B.
-- die bewusst nur lese-/druckberechtigte Rolle "fahrer" (hat ebenfalls s.lieferungen)
-- unbeabsichtigt neue Schreibrechte auf Bestellungen/Gutschriften.
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.erstellen')
WHERE name = 'buchhalter' AND json_valid(berechtigungen) = 1
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lieferanten.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.bearbeiten')
WHERE name = 'buchhalter' AND json_valid(berechtigungen) = 1
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.lieferanten.bearbeiten', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.erstellen')
WHERE name IN ('verkauf', 'lager') AND json_valid(berechtigungen) = 1
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.bestellungen.erstellen', '*'));
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.bearbeiten')
WHERE name IN ('verkauf', 'lager') AND json_valid(berechtigungen) = 1
  AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value IN ('a.gutschriften.bearbeiten', '*'));

-- ── "buero" ("Alle Funktionen außer Einstellungen und Benutzerverwaltung") bekommt
-- unconditional alle 27 neuen Stage-D-Aktionskonstanten — der Code-Preset in
-- lib/permissions.ts leitet buero dynamisch aus ALL_PERMISSIONS ab (also immer
-- "alles Neue automatisch mit"), der DB-Seed ist aber eine statische Liste, die diesem
-- Anspruch sonst strukturell nicht folgen kann.
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.gutschriften.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.gutschriften.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.gutschriften.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.gutschriften.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sammelrechnungen.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.sammelrechnungen.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sammelrechnungen.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.sammelrechnungen.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.sammelrechnungen.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.sammelrechnungen.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.bestellungen.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.bestellungen.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bestellungen.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.bestellungen.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.lieferanten.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.lieferanten.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.lieferanten.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.lieferanten.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kampagnen.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.kampagnen.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kampagnen.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.kampagnen.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kampagnen.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.kampagnen.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.reklamationen.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.reklamationen.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.reklamationen.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.reklamationen.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.reklamationen.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.reklamationen.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kontrakte.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.kontrakte.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kontrakte.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.kontrakte.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.kontrakte.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.kontrakte.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.psm.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.psm.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.psm.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.psm.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.psm.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.psm.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.zertifizierungen.erstellen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.zertifizierungen.erstellen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.zertifizierungen.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.zertifizierungen.bearbeiten');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.zertifizierungen.loeschen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.zertifizierungen.loeschen');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bankabgleich.import')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.bankabgleich.import');
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.bankabgleich.bearbeiten')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.bankabgleich.bearbeiten');

-- ── Nachzügler zu Stage A (bereits in main, betrifft diese Migration nur beiläufig):
-- der statische "buero"-DB-Seed hatte nie "a.ki.nutzen" — Stage A führte die Prüfung
-- in allen tatsächlich KI-aufrufenden /api/ki/*-Routen ein und ging dabei (wie beim
-- jetzigen Stage-D-Fund) fälschlich davon aus, der Code-Preset (ALL_PERMISSIONS-
-- basiert, hat es automatisch) spiegle sich im DB-Seed wider. Gleicher Mechanismus,
-- gleiche Migration, um ihn zu schließen, statt eine inzwischen dritte Migration nur
-- dafür zu brauchen.
UPDATE "Rolle" SET berechtigungen = json_insert(berechtigungen, '$[#]', 'a.ki.nutzen')
WHERE name = 'buero' AND json_valid(berechtigungen) = 1 AND NOT EXISTS (SELECT 1 FROM json_each(berechtigungen) WHERE json_each.value = 'a.ki.nutzen');
