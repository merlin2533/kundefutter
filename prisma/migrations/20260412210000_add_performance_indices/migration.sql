-- Performance-Indizes für häufig gefilterte Spalten
-- (vgl. Code-Review-Report: reduziert Full-Table-Scans bei wachsendem Datenbestand)

-- Kunde: häufig gefiltert in Listen/Dashboard
CREATE INDEX IF NOT EXISTS "Kunde_aktiv_idx" ON "Kunde"("aktiv");
CREATE INDEX IF NOT EXISTS "Kunde_kategorie_idx" ON "Kunde"("kategorie");
CREATE INDEX IF NOT EXISTS "Kunde_name_idx" ON "Kunde"("name");

-- Artikel: Listen, Dashboard-Lageralarm, Katalogsuche
CREATE INDEX IF NOT EXISTS "Artikel_aktiv_idx" ON "Artikel"("aktiv");
CREATE INDEX IF NOT EXISTS "Artikel_kategorie_idx" ON "Artikel"("kategorie");
CREATE INDEX IF NOT EXISTS "Artikel_name_idx" ON "Artikel"("name");

-- Aufgabe: Tagesansicht/Filter nach Status+Fälligkeit
CREATE INDEX IF NOT EXISTS "Aufgabe_erledigt_faelligAm_idx" ON "Aufgabe"("erledigt", "faelligAm");
CREATE INDEX IF NOT EXISTS "Aufgabe_kundeId_erledigt_idx" ON "Aufgabe"("kundeId", "erledigt");

-- Lieferposition: Chargenrückverfolgung, Bedarfs-Lookups
CREATE INDEX IF NOT EXISTS "Lieferposition_lieferungId_idx" ON "Lieferposition"("lieferungId");
CREATE INDEX IF NOT EXISTS "Lieferposition_artikelId_idx" ON "Lieferposition"("artikelId");

-- WareineingangPosition: Lagerbewegungs-Lookups
CREATE INDEX IF NOT EXISTS "WareineingangPosition_wareneingangId_idx" ON "WareineingangPosition"("wareneingangId");
CREATE INDEX IF NOT EXISTS "WareineingangPosition_artikelId_idx" ON "WareineingangPosition"("artikelId");

-- Lagerbewegung: Bewegungsliste je Artikel, Chronologie
CREATE INDEX IF NOT EXISTS "Lagerbewegung_artikelId_idx" ON "Lagerbewegung"("artikelId");
CREATE INDEX IF NOT EXISTS "Lagerbewegung_datum_idx" ON "Lagerbewegung"("datum");
CREATE INDEX IF NOT EXISTS "Lagerbewegung_artikelId_datum_idx" ON "Lagerbewegung"("artikelId", "datum");

-- AngebotPosition: Angebots-Detail, Artikelzuordnung
CREATE INDEX IF NOT EXISTS "AngebotPosition_angebotId_idx" ON "AngebotPosition"("angebotId");
CREATE INDEX IF NOT EXISTS "AngebotPosition_artikelId_idx" ON "AngebotPosition"("artikelId");
