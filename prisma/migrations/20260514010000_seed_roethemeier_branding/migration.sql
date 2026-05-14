-- Einmalige Daten-Migration: Firmenname der bestehenden Röthemeier-Installation.
--
-- Nach dem Entfernen der hart codierten Kundennamen aus dem Code (Branch
-- claude/migrate-agraroffice-db) erhält die bestehende Produktiv-Installation
-- hier ihren Firmennamen über die Einstellungs-Tabelle zurück.
--
-- NEUE Installationen bleiben neutral: Zum Zeitpunkt von `prisma migrate deploy`
-- ist deren Datenbank leer (kein "Kunde"-Datensatz vorhanden) -- das Demo-Seeding
-- (prisma/seed.ts) und `ensureMusterDefaults()` laufen erst NACH den Migrationen.
-- Dadurch greift auf einer Neuinstallation keine der folgenden Anweisungen.
--
-- "Bestehende Installation" = Datenbank enthält bereits Kundendaten.
-- Bereits manuell gepflegte Firmennamen werden NICHT überschrieben -- es werden
-- nur fehlende Werte angelegt bzw. der unveränderte Muster-Platzhalter ersetzt.

-- firma.name -- anlegen, falls auf bestehender Installation noch nicht vorhanden
INSERT INTO "Einstellung" ("key", "value")
SELECT 'firma.name', 'Landhandel Röthemeier'
WHERE EXISTS (SELECT 1 FROM "Kunde")
  AND NOT EXISTS (SELECT 1 FROM "Einstellung" WHERE "key" = 'firma.name');

-- firma.name -- Muster-Platzhalter durch echten Namen ersetzen
UPDATE "Einstellung"
SET "value" = 'Landhandel Röthemeier'
WHERE "key" = 'firma.name'
  AND "value" = 'Muster Agrarhandel GmbH'
  AND EXISTS (SELECT 1 FROM "Kunde");

-- system.firmenname -- anlegen, falls auf bestehender Installation noch nicht vorhanden
INSERT INTO "Einstellung" ("key", "value")
SELECT 'system.firmenname', 'Landhandel Röthemeier'
WHERE EXISTS (SELECT 1 FROM "Kunde")
  AND NOT EXISTS (SELECT 1 FROM "Einstellung" WHERE "key" = 'system.firmenname');

-- system.firmenname -- Muster-Platzhalter durch echten Namen ersetzen
UPDATE "Einstellung"
SET "value" = 'Landhandel Röthemeier'
WHERE "key" = 'system.firmenname'
  AND "value" = 'Muster Agrarhandel GmbH'
  AND EXISTS (SELECT 1 FROM "Kunde");
