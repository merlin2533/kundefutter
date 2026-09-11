-- Verknüpft einen Login-Account (Benutzer) optional mit genau einem Mitarbeiter-Stammdatensatz.
-- Macht diesen Login zu einem Selbstbedienungs-Account, der unabhängig von rolle/rolleId nur
-- die eigene Arbeitszeiterfassung sehen darf (siehe istPersonalSelbstbedienung() in
-- lib/permissions.ts) — kein Zugriff auf Kollegendaten oder Gehaltsabrechnungen.
ALTER TABLE "Benutzer" ADD COLUMN "mitarbeiterId" INTEGER;
CREATE UNIQUE INDEX "Benutzer_mitarbeiterId_key" ON "Benutzer"("mitarbeiterId");
CREATE INDEX "Benutzer_mitarbeiterId_idx" ON "Benutzer"("mitarbeiterId");
