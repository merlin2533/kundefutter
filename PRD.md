# PRD: KundeFutter – Verwaltungssystem für Futter, Dünger & Saatgut

**Version**: 2.0
**Stand**: 2026-03-28
**Status**: Final – bereit zur Implementierung

---

## 1. Kontext & Ziel

Wir sind Wiederverkäufer von Tierfutter, Dünger und Saatgut. Dieses Tool zentralisiert Kunden-, Artikel-, Lieferanten- und Lagerverwaltung, berechnet Margen, prognostiziert Lagerreichweiten, schlägt Nachbestellungen automatisch vor und zeigt alle Kunden auf einer interaktiven Karte.

---

## 2. Nutzergruppen

| Rolle | Beschreibung |
|---|---|
| **Disponent** | Plant Lieferungen, verwaltet Artikel, Lager & Lieferanten |
| **Außendienst** | Pflegt Kundendaten, erfasst Bedarfe, nutzt Karte |
| **Geschäftsführung** | Benötigt Gesamtübersichten, Margenberichte & Exporte |

---

## 3. Kernmodule

### 3.1 Kundenverwaltung

**Stammdaten:**
- Name, Firmierung, Kundenkategorie (Landwirt, Pferdehof, Kleintierhalter, Großhändler, Sonstige)
- Straße, PLZ, Ort, Land
- Geo-Koordinaten (lat/lng) – automatisch via OSM-Geocoding oder manuell korrigierbar
- Notizen, Status (aktiv / inaktiv)

**Mehrfachkontakte:**
- Beliebig viele Kontakteinträge pro Kunde
- Typen: Telefon, Mobilnummer, Fax, E-Mail
- Label frei wählbar (z.B. „Büro", „Herr Müller", „Notfall")
- Anzeige übersichtlich im Kundenprofil

**Verknüpfungen:**
- Übersicht aller Artikel, die ein Kunde regelmäßig bezieht (KundeBedarf)
- Kundenspezifische Sonderpreise pro Artikel
- Komplette Lieferhistorie

### 3.2 Kundenkarte (OpenStreetMap)

- Interaktive Karte mit allen aktiven Kunden als Marker
- Marker-Farbe nach Kategorie oder Lieferstatus
- Klick auf Marker: Popup mit Name, Adresse, letzter Lieferung, direkter Link zum Kundenprofil
- Suche & Filterung (nach Kategorie, PLZ-Bereich)
- Geocoding über Nominatim (OSM) beim Speichern der Adresse
- Manuelles Verschieben des Markers möglich (Koordinaten-Override)

### 3.3 Artikelverwaltung

- Anlegen mit: Name, Artikelnummer (auto-generiert oder manuell), Kategorie (Futter / Dünger / Saatgut), Einheit (kg, t, Sack, Liter, Stück), Beschreibung
- Zuweisung zu einem oder mehreren Lieferanten inkl. Lieferanten-Artikelnummer, Einkaufspreis, Mindestbestellmenge, Lieferzeit (Tage)
- Bevorzugter Lieferant markierbar
- **Standardverkaufspreis** & automatische Margenanzeige
- Status: aktiv / inaktiv

### 3.4 Lieferantenverwaltung

- Stammdaten: Firmenname, Ansprechpartner, E-Mail, Telefon, Adresse, Notizen
- Übersicht aller bestellbaren Artikel bei diesem Lieferanten inkl. Preis & Lieferzeit
- Status: aktiv / inaktiv

### 3.5 Lagerverwaltung

**Bestandsführung:**
- Aktueller Lagerbestand pro Artikel (in Artikeleinheit)
- Mindestbestand (Meldebestand) pro Artikel – konfigurierbar
- Ampelsystem pro Artikel:
  - 🟢 Grün: Bestand > Mindestbestand + Puffer
  - 🟡 Gelb: Bestand ≤ Mindestbestand
  - 🔴 Rot: Bestand = 0 oder negativ

**Wareneingänge:**
- Datum, Lieferant, beliebig viele Positionen (Artikel + Menge + Einkaufspreis)
- Automatische Bestandserhöhung + Lagerbewegungsprotokoll
- Einkaufspreis wird in ArtikelLieferant aktualisiert (optional)

**Warenausgänge:**
- Automatisch durch Auslieferungen (Bestandsreduzierung)
- Lagerbewegungsprotokoll mit Referenz zur Lieferung

**Lagerkorrektur:**
- Manuelle Korrektur (Inventur, Schwund, Bruch)
- Pflichtfeld: Begründung

**Lagerbewegungsprotokoll:**
- Vollständige Historie: Datum, Typ (Eingang/Ausgang/Korrektur), Menge, Bestand danach, Referenz

### 3.6 Lieferungsverwaltung

- Neue Lieferung: Kunde wählen, Datum, beliebig viele Positionen (Artikel + Menge)
- Verkaufspreis pro Position: automatisch aus Kundensonderpreis > Standard
- Einkaufspreis pro Position: automatisch aus bevorzugtem Lieferant
- **Margenanzeige live** während der Erfassung (€ und %)
- Status: geplant → geliefert → (storniert)
- Bei „geliefert": automatische Bestandsreduzierung
- Stornierung: Bestand wird zurückgebucht
- Freitextnotiz

### 3.7 Prognose & Disposition

#### Lagerreichweite
- Berechnung des **Ø Tagesverbrauchs** pro Artikel aus Lieferhistorie (konfigurierbarer Zeitraum: 30 / 60 / 90 Tage)
- **Reichweite in Tagen** = Aktueller Bestand ÷ Ø Tagesverbrauch
- Anzeige: „Artikel X reicht noch ca. **14 Tage**"
- Berücksichtigung geplanter (noch nicht gelieferter) Lieferungen

#### Bestellvorschlag
Automatischer Vorschlag wenn:
- Bestand < Mindestbestand, **oder**
- Reichweite < konfigurierbarer Schwellwert (Standard: 21 Tage)

Bestellmenge = (Ø Tagesverbrauch × Zielhorizont in Tagen) – aktueller Bestand

- Vorschlag gruppiert nach Lieferant
- Berücksichtigt Mindestbestellmenge des Lieferanten
- Manuelle Anpassung der Bestellmenge vor Export
- Export als PDF oder XLSX (eine Tabelle pro Lieferant)

#### Kundenbedarfsplanung
- Regelmäßiger Bedarf pro Kunde (z.B. 500 kg Rinderfutter alle 14 Tage)
- Basierend auf Historie: letzter Liefertermin + Intervall = nächster Termin
- Anzeige: „Fällige Lieferungen in den nächsten X Tagen"

### 3.8 Preismanagement & Margen

#### Preishierarchie (Priorität absteigend)
1. **Kundenspezifischer Preis** (direkt am Kunden hinterlegter Sonderpreis für diesen Artikel)
2. **Standardverkaufspreis** des Artikels

#### Margenberechnung
- Marge (€) = Verkaufspreis – Einkaufspreis (aus bevorzugtem Lieferant)
- Marge (%) = Marge € / Verkaufspreis × 100
- Anzeige überall: Artikeldetail, Lieferungserfassung, Kundendetail
- **Margenwarnung** (orange) wenn Marge < 10 % (konfigurierbar)
- **Margenfehler** (rot) wenn Verkaufspreis < Einkaufspreis

#### Margenberichte
- Marge pro Kunde (Zeitraum wählbar)
- Marge pro Artikel
- Gesamtübersicht Umsatz / Einkauf / Deckungsbeitrag

---

## 4. Exportfunktionen

| Export | Format | Inhalt |
|---|---|---|
| Kundenliste | CSV / XLSX | Alle Kundenstammdaten inkl. Kontakte |
| Lieferhistorie | CSV / XLSX | Alle Lieferungen, filterbar nach Zeitraum & Kunde |
| Artikelliste | CSV / XLSX | Alle Artikel inkl. Lieferant & Preise & Marge |
| Bestellvorschlag | PDF / XLSX | Artikel gruppiert nach Lieferant |
| Kundenbedarf | PDF | Pro Kunde: Artikel + Lieferhistorie |
| Lagerübersicht | CSV / XLSX | Bestand, Mindestbestand, Reichweite, Status |
| Lagerbewegungen | CSV / XLSX | Alle Ein-/Ausgänge im Zeitraum |
| Margenbericht | XLSX | Marge pro Kunde / Artikel / Zeitraum |

---

## 5. Ideen für spätere Erweiterungen (Backlog)

Diese Punkte wurden identifiziert, sind aber nicht Teil des MVP. Priorisierung nach Priorität:

### Priorität 1 – Kurzfristig (hoher Nutzen, überschaubarer Aufwand)

| # | Erweiterung | Beschreibung | Nutzen |
|---|---|---|---|
| 1 | **Dashboard mit KPIs** | Startseite mit: Umsatz laufender Monat, offene Lieferungen, Lageralarm-Zähler, Top-5-Kunden, fällige Lieferungen | Alles auf einen Blick – kein mühsames Zusammenklicken |
| 2 | **Saisonale Prognose** | Verbrauchsmuster nach Kalendermonat auswerten; Prognose berücksichtigt saisonale Schwankungen (Dünger März/April, Saatgut Frühjahr/Herbst, Futter gleichmäßig) | Verhindert Fehlbestellungen durch rein lineare Hochrechnung |
| 3 | **Chargen- / MHD-Tracking** | Mindesthaltbarkeitsdatum pro Wareneingangsposition, FIFO-Warnung bei ablaufender Ware, Filterung nach Chargen | Pflicht für Saatgut & bestimmte Futtermittel; vermeidet Haftungsrisiken |
| 4 | **Wiederkehrende Lieferungen automatisch anlegen** | Aus KundeBedarf (Menge + Intervall) automatisch Lieferungen als „geplant" vorbelegen | Spart manuelle Erfassung bei Stammkunden; nichts wird vergessen |
| 5 | **Stornobegründung & Kundenkommunikations-Log** | Pflichtfeld bei Stornierung; freie Gesprächsnotizen pro Kunde (Datum, Bearbeiter, Text) | Wissen bleibt im System, auch wenn jemand krank ist |

### Priorität 2 – Mittelfristig (strategisch wichtig)

| # | Erweiterung | Beschreibung | Nutzen |
|---|---|---|---|
| 6 | **Rechnungserstellung** | PDF-Rechnung direkt aus Lieferung generieren (Logo, Steuern, Zahlungsziel, fortlaufende Rechnungsnummer) | Ersetzt das zweite Tool; alles in einem System |
| 7 | **Lieferantenbestellung per PDF / E-Mail** | Bestellvorschlag als fertiges Bestelldokument direkt an Lieferant senden (PDF-Anhang oder mailto-Link) | Spart Zeit, verhindert Fehler beim manuellen Abtippen |
| 8 | **Preislisten-Import vom Lieferanten** | Einkaufspreise via Excel-Upload aktualisieren; Vorschau + Bestätigung vor Übernahme; Preishistorie pro ArtikelLieferant | Preisänderungen in Sekunden statt stundenlanger Handpflege; alte Margen bleiben nachvollziehbar |
| 9 | **Mehrere Lagerorte** | Lagerbestand pro Artikel auf mehrere Standorte aufteilen (Hauptlager, Außenlager, Scheune); Gesamtbestand + Bestand je Standort | Sobald mehr als ein physischer Lagerort existiert zwingend notwendig |
| 10 | **E-Mail-Benachrichtigung** | Automatische E-Mail bei Lagerunterschreitung, ablaufendem MHD und fälligen Lieferungen | Proaktive Warnung ohne tägliches Einloggen |

### Priorität 3 – Strategisch / Phase 3

| # | Erweiterung | Beschreibung | Nutzen |
|---|---|---|---|
| 11 | **Benutzerrollen & Rechte** | Rollen: Admin / Disponent / Außendienst; Außendienst sieht keine Einkaufspreise, Disponent kann keine Stammdaten löschen | Sobald mehrere Personen arbeiten unerlässlich |
| 12 | **Routenplanung auf der Karte** | Liefertag mit mehreren Kunden: optimale Reihenfolge berechnen (Nearest-Neighbor oder OSRM-API), Route auf OSM-Karte visualisieren, Export als Fahrerliste | Spart Sprit und Fahrzeit |
| 13 | **Mobile PWA / Offline-Fähigkeit** | App auf Handy installierbar; Kundenliste & Lieferungen offline verfügbar; Sync wenn wieder online | Außendienst auf Höfen hat oft schlechtes Netz |
| 14 | **Kundenportal (readonly)** | Kunden können sich einloggen und eigene Lieferhistorie & Rechnungen einsehen | Serviceverbesserung; weniger Rückfragen per Telefon |
| 15 | **Preishistorie** | Jede Änderung an Einkaufs- und Verkaufspreisen wird versioniert gespeichert | Alte Lieferungen behalten korrekte Margen; Preisstreitigkeiten lückenlos nachvollziehbar |

### Bekannte Risiken & Designentscheidungen

| Risiko | Empfehlung |
|---|---|
| Geocoding schlägt fehl bei Hofadressen (Flurnamen, keine Hausnummern) | Manuelle Koordinateneingabe als Fallback muss gut zugänglich sein |
| Lieferung und Rechnung sind heute dasselbe Konzept | Datenmodell frühzeitig trennen (Lieferung → kann eine Rechnung erzeugen) |
| Einkaufspreis-Änderungen überschreiben alte Margen | Preishistorie (Punkt 15) oder Snapshot-Preis pro Lieferposition |
| Keine Stornobegründung | In Phase 1 als Pflichtfeld einplanen |

---

## 6. Datenschema (vollständig)

```
Kunde
  ├── id, name, firma, kategorie
  ├── strasse, plz, ort, land, lat, lng
  ├── notizen, aktiv
  ├── KundeKontakt[] (typ, wert, label)
  ├── KundeBedarf[] (→ Artikel, menge, intervallTage)
  ├── KundeArtikelPreis[] (→ Artikel, preis, rabatt)
  └── Lieferung[]

Artikel
  ├── id, artikelnummer, name, kategorie, einheit
  ├── standardpreis, mindestbestand, aktuellerBestand
  ├── beschreibung, aktiv
  ├── ArtikelLieferant[] (→ Lieferant, einkaufspreis, mindestbestellmenge, lieferzeitTage, bevorzugt)
  ├── KundeArtikelPreis[]
  ├── KundeBedarf[]
  ├── Lieferposition[]
  └── Lagerbewegung[]

Lieferant
  ├── id, name, ansprechpartner, email, telefon
  ├── strasse, plz, ort, notizen, aktiv
  ├── ArtikelLieferant[]
  └── Wareneingang[]

Lieferung
  ├── id, kundeId, datum, status, notiz
  ├── Lieferposition[] (→ Artikel, menge, verkaufspreis, einkaufspreis)
  └── Lagerbewegung[]

Wareneingang
  ├── id, lieferantId, datum, notiz
  ├── WareineingangPosition[] (→ Artikel, menge, einkaufspreis)
  └── Lagerbewegung[]

Lagerbewegung
  ├── id, artikelId, typ, menge, bestandNach, datum, notiz
  ├── → Lieferung (optional)
  └── → Wareneingang (optional)
```

---

## 7. Technischer Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router), TailwindCSS |
| Backend | Next.js API Routes (Full-Stack) |
| Datenbank | SQLite via Prisma ORM |
| Karte | Leaflet + React-Leaflet + OpenStreetMap (Nominatim Geocoding) |
| Exporte | xlsx (Excel), jsPDF + jspdf-autotable (PDF) |
| Icons | lucide-react |
| Deployment | Docker (Node.js Alpine Image) |

---

## 8. MVP-Scope (Phase 1 – wird jetzt gebaut)

1. Kundenverwaltung inkl. Mehrfachkontakte (Telefon, E-Mail) und Adresspflege
2. Kundenkarte (OSM) mit Geocoding
3. Artikelverwaltung mit Lieferantenzuordnung & Preisen
4. Lieferantenverwaltung
5. Lagerverwaltung (Bestand, Mindestbestand, Wareneingänge, Korrekturen)
6. Lieferungserfassung mit automatischer Bestandsreduzierung & Margenanzeige
7. Prognose: Reichweite & Bestellvorschlag
8. Preismanagement (Standard + kundenspezifisch) & Margenanzeige
9. Exporte: CSV/XLSX für alle Kernbereiche, PDF Bestellvorschlag
10. Docker-Deployment
