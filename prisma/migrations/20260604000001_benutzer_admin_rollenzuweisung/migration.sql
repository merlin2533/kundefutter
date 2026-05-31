-- Alle vorhandenen Benutzer der Admin-Rolle zuweisen
-- (einmalige Migration beim Upgrade auf das neue Berechtigungssystem)
UPDATE "Benutzer"
SET "rolleId" = (SELECT "id" FROM "Rolle" WHERE "name" = 'admin' LIMIT 1)
WHERE "rolleId" IS NULL;
