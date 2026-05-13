-- Performance-Indizes: fehlende Indizes für häufig gefilterte Spalten

-- KundeAktivitaet: Filter nach erledigt-Status (Wiedervorlage/Fälligkeiten)
CREATE INDEX IF NOT EXISTS "KundeAktivitaet_erledigt_idx" ON "KundeAktivitaet"("erledigt");

-- Lagerbewegung: Filter nach Bewegungstyp (eingang | ausgang | korrektur | UMBUCHUNG)
CREATE INDEX IF NOT EXISTS "Lagerbewegung_typ_idx" ON "Lagerbewegung"("typ");
