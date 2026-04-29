-- "Kanister" zu system.einheiten hinzufügen, falls noch nicht vorhanden
UPDATE "Einstellung"
SET value = json_insert(value, '$[#]', 'Kanister')
WHERE key = 'system.einheiten'
  AND json_valid(value) = 1
  AND NOT EXISTS (
    SELECT 1 FROM json_each(value) WHERE json_each.value = 'Kanister'
  );

-- system.einheiten anlegen, falls noch nicht vorhanden
INSERT INTO "Einstellung" (key, value)
SELECT 'system.einheiten', '["kg","t","dt","Sack","Stk","Liter","Kanister","Palette","BigBag","km","Stunden"]'
WHERE NOT EXISTS (SELECT 1 FROM "Einstellung" WHERE key = 'system.einheiten');

-- "Kartoffel" zu system.saatgut_kulturen hinzufügen, falls noch nicht vorhanden
UPDATE "Einstellung"
SET value = json_insert(value, '$[#]', 'Kartoffel')
WHERE key = 'system.saatgut_kulturen'
  AND json_valid(value) = 1
  AND NOT EXISTS (
    SELECT 1 FROM json_each(value) WHERE json_each.value = 'Kartoffel'
  );

-- system.saatgut_kulturen anlegen, falls noch nicht vorhanden
INSERT INTO "Einstellung" (key, value)
SELECT 'system.saatgut_kulturen', '["Mais","Raps","Getreide","Gräser","Kartoffel","Zwischenfrüchte","Leguminosen","Sonnenblumen","Sorghum"]'
WHERE NOT EXISTS (SELECT 1 FROM "Einstellung" WHERE key = 'system.saatgut_kulturen');
