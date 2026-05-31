-- CreateTable: Rollen-Modell für DB-gestütztes RBAC
CREATE TABLE "Rolle" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "bezeichnung" TEXT NOT NULL,
    "beschreibung" TEXT,
    "berechtigungen" TEXT NOT NULL DEFAULT '[]',
    "istSystem" BOOLEAN NOT NULL DEFAULT false,
    "erstelltAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "geaendertAm" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "Rolle_name_key" ON "Rolle"("name");

-- AlterTable: Benutzer um rolleId + berechtigungen erweitern
ALTER TABLE "Benutzer" ADD COLUMN "rolleId" INTEGER REFERENCES "Rolle"("id");
ALTER TABLE "Benutzer" ADD COLUMN "berechtigungen" TEXT NOT NULL DEFAULT '[]';

CREATE INDEX "Benutzer_rolleId_idx" ON "Benutzer"("rolleId");

-- Seed: System-Rollen anlegen
INSERT INTO "Rolle" ("name","bezeichnung","beschreibung","berechtigungen","istSystem","geaendertAm") VALUES
('admin','Administrator','Vollzugriff auf alle Funktionen','["*"]',1,CURRENT_TIMESTAMP),
('buero','Büro / Innendienst','Alle Funktionen außer Einstellungen und Benutzer-Verwaltung','["s.dashboard","s.kunden","s.kunden.bewertung","s.kunden.karte","s.kunden.import","s.mailverteiler","s.artikel","s.lieferanten","s.lager","s.inventur","s.lieferungen","s.angebote","s.aufgaben","s.rechnungen","s.sammelrechnungen","s.gutschriften","s.ausgaben","s.bankabgleich","s.mahnwesen","s.statistik","s.marktpreise","s.agrarantraege","s.bodenproben","s.duengebedarf","s.vorbestellungen","s.bestellungen","s.eingangsrechnungen","s.kontrakte","s.reklamationen","s.kampagnen","s.psm","s.sortenversuche","s.rationsberechnung","s.fahrer","s.tourenplanung","s.audit","a.kunden.erstellen","a.kunden.bearbeiten","a.kunden.loeschen","a.artikel.erstellen","a.artikel.bearbeiten","a.artikel.loeschen","a.lieferungen.erstellen","a.lieferungen.stornieren","a.angebote.erstellen","a.angebote.bearbeiten","a.lager.wareneingang","a.lager.korrektur","a.export.lieferschein","a.export.rechnung","a.export.rechnung_mail","a.export.datev","a.export.bulk","f.artikel.einkaufspreis","f.artikel.marge","f.lieferung.einkaufswert","f.kunde.umsatz","f.kunde.offenerBetrag","f.statistik.deckungsbeitrag","f.statistik.umsatz","f.kalkulation"]',1,CURRENT_TIMESTAMP),
('verkauf','Außendienst / Verkauf','CRM, Angebote, Lieferungen – ohne Einkaufspreise und Massen-Export','["s.dashboard","s.kunden","s.kunden.bewertung","s.kunden.karte","s.artikel","s.lieferungen","s.angebote","s.aufgaben","s.besuchstermine","s.bodenproben","s.duengebedarf","s.vorbestellungen","s.kontrakte","s.reklamationen","s.psm","s.sortenversuche","s.rationsberechnung","s.tourenplanung","s.marktpreise","a.kunden.erstellen","a.kunden.bearbeiten","a.angebote.erstellen","a.angebote.bearbeiten","a.lieferungen.erstellen","a.export.lieferschein","a.export.rechnung","a.export.rechnung_mail","f.kunde.umsatz","f.kunde.offenerBetrag"]',1,CURRENT_TIMESTAMP),
('lager','Lagermitarbeiter','Lager, Wareneingänge, Bestellliste – ohne Einkaufspreise','["s.dashboard","s.artikel","s.lager","s.inventur","s.lieferungen","s.bestellungen","s.bestellliste","s.wareneingang","a.lager.wareneingang","a.lager.korrektur","a.export.lieferschein"]',1,CURRENT_TIMESTAMP),
('fahrer','Fahrer','Touren, Lieferscheine – nur Lese- und Druckzugriff','["s.dashboard","s.lieferungen","s.fahrer","s.tourenplanung","a.export.lieferschein"]',1,CURRENT_TIMESTAMP),
('buchhalter','Buchhalter / Buchhaltung','Finanzen, Rechnungen, DATEV-Export, Statistik','["s.dashboard","s.rechnungen","s.sammelrechnungen","s.gutschriften","s.ausgaben","s.bankabgleich","s.mahnwesen","s.statistik","s.offene_posten","s.eingangsrechnungen","a.export.rechnung","a.export.rechnung_mail","a.export.datev","a.export.bulk","f.kunde.umsatz","f.kunde.offenerBetrag","f.statistik.umsatz","f.statistik.deckungsbeitrag","f.kalkulation"]',1,CURRENT_TIMESTAMP),
('readonly','Nur Lesen','Lesezugriff auf alle Bereiche, keine Änderungen und keine Exporte','["s.dashboard","s.kunden","s.kunden.bewertung","s.artikel","s.lieferungen","s.angebote","s.aufgaben","s.lager","s.statistik","s.marktpreise"]',1,CURRENT_TIMESTAMP);
