# AgrarOffice Röthemeier

Webbasiertes Warenwirtschafts- und CRM-System für Landhandel (Futter, Dünger, Saatgut).

```
   ___                     ___   __  __ _
  / _ \ __ _ _ __ __ _ _ _/ _ \ / _|/ _(_) ___ ___
 | | | |/ _` | '__/ _` | '__| | | |_| |_| |/ __/ _ \
 | |_| | (_| | | | (_| | |  | |_|  _|  _| | (_|  __/
  \___/ \__,_|_|  \__,_|_|   \___/_| |_| |_|\___\___|
        Röthemeier  -  Landhandel Management
```

## Features

### Kundenverwaltung
- Kundenstammdaten mit Firma, Kategorie, Verantwortlichem
- Kontakte (Telefon, Mobil, E-Mail, Fax)
- Wiederkehrende Bedarfe mit Intervall
- Individuelle Sonderpreise & Rabatte
- Adressvalidierung via OpenStreetMap/Nominatim
- Kundenimport aus Excel/CSV
- **Kundenmappe als PDF** (Stammdaten, Bedarfe, Lieferhist., CRM-Aktivitäten)

### CRM / Aktivitäten
- Besuchsberichte, Anrufe, E-Mails, Notizen, Aufgaben pro Kunde
- Überfälligkeitsanzeige für offene Aufgaben
- CRM-Übersichtsseite (`/crm`) mit allen offenen Aufgaben
- Aktivitäten als eigene Seite anlegen (`/kunden/[id]/aktivitaet`)

### Lieferungen & Logistik
- Lieferungsverwaltung mit Status (geplant → geliefert → storniert)
- Chargen-/Losnummern pro Position
- Mengenrabatte (nach Artikel, Kategorie oder Kunde)
- Wiederkehrende Bedarfe mit Überfälligkeitsprüfung

### Tourenplanung
- Tagesansicht aller geplanten Lieferungen sortiert nach PLZ
- **Routenberechnung (km + Zeit)** via OSRM (OpenStreetMap Routing)
- Startpunkt-Geocodierung via Nominatim
- Touren-PDF zum Ausdrucken

### Rechnungswesen & Finanzen
- Automatische Rechnungsnummervergabe (transaktionssicher)
- Rechnung PDF, Lieferschein PDF
- Sammelrechnungen über mehrere Lieferungen
- Zahlungsstatus / Bezahlt-Markierung
- Mahnwesen mit Überfälligkeitsliste
- **Massenexport**: Rechnungen oder Lieferscheine als ZIP-Archiv
  - Filter: Datum, Kunde, Rechnungsnummernkreis

### Artikel & Lager
- Artikelstamm mit Kategorien (Futter, Dünger, Saatgut)
- Lagerbestandsverwaltung mit Mindestbestand und Ampelstatus
- Wareneingang mit Lieferantenzuordnung
- Lagerbewegungshistorie

### Statistik & Analyse
- Dashboard mit Monatsübersicht, Top-Kunden, offene Rechnungen
- Statistikseite: Umsatz, Marge, Artikelverteilung
- Jahresübersicht pro Kunde (SVG-Balkendiagramm)
- Prognose-Seite für Bedarfsplanung

### Export (CSV/Excel)
- Kundenliste, Artikel, Lieferanten, Lieferhistorie, Lager, Lagerbewegungen, Margenbericht

### Einstellungen
- Firmendaten (erscheinen in PDFs)
- Mitarbeiter/Verantwortliche verwalten (Dropdown für Kunden)
- Kunden-Kategorien verwalten (Dropdown für Kunden)
- Adress-Batch-Validierung: alle Kunden ohne Koordinaten per OSM geocodieren

### PWA
- Web App Manifest, installierbar auf Mobilgeräten
- Hamburger-Navigation mit gruppierten Untermenüs

---

## Technik

| Komponente | Version |
|---|---|
| Next.js | 16 (App Router, Turbopack) |
| Prisma | 7 + SQLite via @libsql/client |
| React | 19 |
| Tailwind CSS | 4 |
| jsPDF + jspdf-autotable | PDF-Erzeugung serverseitig |
| JSZip | ZIP für Massenexport |
| Leaflet + react-leaflet | Kundenkarte |
| XLSX | Kundenimport |
| OSRM | Routenberechnung (öffentliche API) |
| Nominatim | Geocodierung (OpenStreetMap) |

---

## Entwicklung

```bash
npm install
npx prisma migrate dev
npm run dev
```

## Produktion (Docker)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Die App ist erreichbar unter `http://localhost:8080`.

Backups werden täglich um 2:00 Uhr erstellt (`/data/backups/`).

---

## Datenbank

SQLite (via libsql). Migrationen in `prisma/migrations/`.

Wichtige Modelle: `Kunde`, `Lieferung`, `Lieferposition`, `Artikel`, `Lager`, `KundeAktivitaet`, `Mengenrabatt`, `Sammelrechnung`, `Einstellung`.

---

## API-Routen (Auswahl)

| Route | Methoden | Beschreibung |
|---|---|---|
| `/api/kunden` | GET, POST | Kundenliste |
| `/api/kunden/[id]` | GET, PUT, DELETE | Einzelkunde |
| `/api/kunden/aktivitaeten` | GET, POST, PATCH, DELETE | CRM-Aktivitäten |
| `/api/kunden/adress-validierung` | GET, POST | OSM-Geocodierung |
| `/api/lieferungen` | GET, POST | Lieferungen |
| `/api/lieferungen/[id]` | GET, PATCH, DELETE | Einzellieferung |
| `/api/exporte/rechnung` | GET | Rechnung PDF |
| `/api/exporte/lieferschein` | GET | Lieferschein PDF |
| `/api/exporte/sammelrechnung` | POST | Sammelrechnung PDF |
| `/api/exporte/bulk` | GET | Massenexport ZIP |
| `/api/exporte/kundenmappe` | GET | Kundenmappe PDF |
| `/api/exporte/tour` | GET | Tourenliste PDF |
| `/api/einstellungen` | GET, PUT | Firma- u. Systemeinstellungen |
| `/api/mengenrabatte` | GET, POST, DELETE | Rabattregeln |
| `/api/mahnwesen` | GET | Offene/überfällige Rechnungen |
| `/api/statistik` | GET | Aggregierte Statistiken |

---

## Geplante Erweiterungen (Ideen)

- **Wetterwarnung** bei Feldlieferungen (OpenWeather API)
- **Automatische Liefervorschläge** auf Basis Bedarfsintervall
- **Lieferantenbewertung** (Zuverlässigkeit, Qualität)
- **Kampagnenplaner** für Saisonaktionen
- **Buchhaltungsexport** (DATEV-Format)
- **Mobilerfassung** per QR-Code am Hof
- **Bestands-Alerts** per E-Mail bei Unterschreitung Mindestbestand
- **Kundenbewertung** / Lead-Score basierend auf Umsatz & Aktivität
- **Serienbriefe / E-Mail-Kampagnen** für Kundenkommunikation
- **Tourenoptimierung** (TSP-Algorithmus für optimale Reihenfolge)
