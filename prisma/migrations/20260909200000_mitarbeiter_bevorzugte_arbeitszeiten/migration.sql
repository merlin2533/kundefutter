-- Bevorzugte Arbeitszeiten je Mitarbeiter (JSON {mo,di,mi,do,fr,sa,so}) — Vorbelegung
-- für die Arbeitszeiterfassung, damit übliche Stunden nur noch bestätigt werden müssen.
ALTER TABLE "Mitarbeiter" ADD COLUMN "bevorzugteArbeitszeiten" TEXT;
