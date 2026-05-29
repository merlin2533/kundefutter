# AGRI-Office

Webbasiertes Warenwirtschafts- und CRM-System für den Landhandel (Futter, Dünger, Saatgut, Analysen).

```
   ___                     ___   __  __ _
  / _ \ __ _ _ __ __ _ _ _/ _ \ / _|/ _(_) ___ ___
 | | | |/ _` | '__/ _` | '__| | | |_| |_| |/ __/ _ \
 | |_| | (_| | | | (_| | |  | |_|  _|  _| | (_|  __/
  \___/ \__,_|_|  \__,_|_|   \___/_| |_| |_|\___\___|
        Landhandel Management
```

---

## Funktionsübersicht

### Kundenverwaltung
- Kundenstammdaten: Name, Firma, Adresse, Betriebsnummer, bewirtschaftete Fläche
- **Kontakte** (Ansprechpartner: Name, Funktion, Tel/Mobil/E-Mail/Fax)
- **Schlagkartei** je Kunde: Felder mit Fruchtart, Sorte, Fläche, Vorfrucht, Aussaatjahr
- **Bedarfsplanung**: wiederkehrende Bedarfe mit Intervall und Überfälligkeitsprüfung
- **Sonderpreise**: individuelle Preisvereinbarungen je Kunde + Artikel
- **Notizen** mit Themen (Wichtig, Info, Offener Punkt, Wettbewerber-Info, …)
- **CRM-Aktivitäten**: Besuch, Anruf, E-Mail, Aufgabe mit Fälligkeit
- **Agraranträge (AFIG)**: Daten aus agrarzahlungen.de, verknüpfbar mit Kunden
- **Kundenmappe** als HTML-Druck: alle Daten auf einen Blick
- **Karte** mit Geo-Koordinaten (Leaflet / OpenStreetMap)
- Import aus Excel/CSV, Adressvalidierung via Nominatim (OSM)

### Artikel & Lager
- Artikelstamm: Artikelnummer, Name, Kategorie, Unterkategorie, Einheit, VK-Preis, EK-Preis, MwSt
- **Kategorien & Unterkategorien** vollständig konfigurierbar (Futter, Dünger, Saatgut, Analysen, Beratung, Pflege …)
- **Lagerbestand**: Mindestbestand, Ampelstatus (grün / gelb / rot)
- **Lagerorte** als freie Eingabe mit konfigurierbaren Vorschlägen
- **Chargenrückverfolgung** je Lieferposition
- **Inhaltsstoffe** strukturiert erfassbar (Name, Menge, Einheit) – mit KI-Recherche
- **Lieferantenzuordnung** mit EK-Preisen; bevorzugter Lieferant markierbar
- **Wareneingänge** mit Lagerbuchung
- **Lagerbewegungshistorie**
- **Preishistorie** je Artikel
- **Mengenrabatte** (Staffelpreise) nach Artikel, Kategorie oder Kunde
- Import/Export als Excel/CSV
- Paginierte Listenansicht (100 je Seite) mit Such- und Kategorie-/Unterkategoriefilter

### Angebote
- Angebotsnummer AN-YYYY-NNNN (transaktionssichere Vergabe)
- Status: Offen / Angenommen / Abgelehnt / Abgelaufen
- Gültigkeitsdatum, interne Notiz
- Rabatt je Position
- **Aus Angebot direkt eine Lieferung erstellen**
- Angebots-PDF (Druck)

### Lieferungen & Logistik
- Lieferscheine: geplant → geliefert → storniert
- Positionen mit Menge, VK, EK, Rabatt, Chargennummer
- **Marge & Deckungsbeitrag** je Lieferung
- **Lieferschein-PDF** (ohne Preise, Unterschriftsfeld)
- **Rechnung-PDF** (mit MwSt-Aufteilung, IBAN/BIC)
- Kategorie-Präfix bei Positionen (z.B. „Saatgut · Mais – Artikelname")

### Rechnungswesen & Finanzen
- Automatische, transaktionssichere Rechnungsnummervergabe
- Zahlungsziel, Bezahlt-Markierung, Zahlungsdatum
- **Mahnwesen**: Überfälligkeitsliste mit Tagen seit Fälligkeit
- **Sammelrechnungen** über mehrere Lieferungen
- Massenexport (ZIP mit Rechnungen / Lieferscheinen)

### CRM & Aufgaben
- CRM-Übersichtsseite mit Kalender und offenen Wiedervorlagen
- **Telefonmaske** `/telefonmaske`: Kundensuche bei eingehendem Anruf (letzte Lieferung, offene Beträge, Bedarfe)
- **Tagesansicht Außendienst**: offene Aufgaben, fällige Anrufe, geplante Touren
- **Aufgaben/TODO** mit Priorität, Typ, Tags, Fälligkeit, Kundenzuordnung
- Dashboard-Widgets: Kein-Kontakt-Kunde (>30 Tage), offene Aufgaben, Umsatz-KPIs

### Tourenplanung
- Tagesübersicht aller geplanten Lieferungen sortiert nach PLZ
- **Routenberechnung** (km + Zeit) via OSRM
- Startpunkt konfigurierbar, Geocodierung via Nominatim
- Tour-Namen konfigurierbar unter Einstellungen
- **Tour-PDF** zum Ausdrucken / Weitergeben

### Marktpreise
- Eurostat-Preisindizes für Agrarrohstoffe (Input + Output, quartalsweise)
- Cache mit 7-Tage-Gültigkeit, On-Demand-Aktualisierung

### Agraranträge (AFIG)
- Import der agrarzahlungen.de-CSV (bis 250 MB, Streaming)
- Suche nach Empfänger, Betriebsnummer, PLZ
- Verknüpfung mit Kundenstamm
- AFIG-PDF je Kunde

### Preisauskunft
- Schnellsuche: Artikel auswählen + Kunde → zeigt VK, Sonderpreis, aktuellen Lagerbestand

### KI-Integration
- Provider: OpenAI (GPT-4o/4.1) oder Anthropic (Claude Sonnet/Haiku/Opus)
- **Lieferschein-Erkennung per Foto** (`/ki/wareneingang`)
- **Bestellungs-Erkennung** aus Bild (`/ki/lieferung`)
- **CRM-Notizen** aus Foto/Sprache (`/ki/crm`)
- **Inhaltsstoff-Recherche**: KI schlägt Inhaltsstoffe eines Produktes vor
- Benutzerdefinierte Prompts je Feature konfigurierbar
- Kostentracking (Tokens, Kosten in Cent) in der Datenbank

### Einstellungen
| Seite | Inhalt |
|---|---|
| Firma | Name, Adresse, Tel, E-Mail, IBAN/BIC |
| Erscheinungsbild | Firmenlogo (erscheint in PDFs und Navigation) |
| Artikelkategorien | Kategorien + Unterkategorien verwalten |
| Stammdaten | Einheiten, Lagerorte, Fruchtarten, Notizthemen |
| Tour-Namen | Konfigurierbare Tour-Bezeichnungen |
| Adressen | Batch-Geocodierung aller Kunden |
| Agraranträge | AFIG CSV-Import |
| KI / AI | API-Keys, Modell, Prompts, Statistik |
| System | Version, Datenbank, Duplikat-Bereinigung |

### PWA
- Web App Manifest – installierbar auf Mobile und Desktop
- Service Worker mit Cache-First-Strategie für Offline-Nutzung
- Icons 192×192 und 512×512

---

## Technik

| Komponente | Version/Details |
|---|---|
| Next.js | 16 – App Router, Turbopack |
| Prisma | 7 – SQLite via @libsql/client |
| React | 19 |
| Tailwind CSS | 4 |
| jsPDF + autotable | PDF-Erzeugung |
| JSZip | Massenexport als ZIP |
| Leaflet / react-leaflet | Kundenkarte |
| XLSX | Excel-Import/Export |
| OSRM | Routenberechnung (öffentliche API) |
| Nominatim | Geocodierung via OpenStreetMap |
| Eurostat REST API | Agrarrohstoff-Preisindizes |

---

## Entwicklung

```bash
npm install
npx prisma migrate dev
npm run dev
```

Läuft auf `http://localhost:3000`.

## Produktion (Docker)

```bash
docker compose -f docker-compose.prod.yml up -d
```

Die App ist erreichbar unter `http://localhost:8080`.

Backups werden täglich um 2:00 Uhr erstellt (`/data/backups/`).

Docker Image: `merlin2539/kundefutter:latest`  
CI: GitHub Actions baut automatisch auf Push zu `main` und `claude/**`

---

## Datenbank

SQLite via libsql. Migrationen in `prisma/migrations/`.

Wichtige Modelle: `Kunde`, `KundeKontakt`, `KundeNotiz`, `KundeAktivitaet`, `KundeSchlag`,
`Artikel`, `ArtikelInhaltsstoff`, `ArtikelLieferant`, `Lieferung`, `Lieferposition`,
`Wareneingang`, `Lagerbewegung`, `Mengenrabatt`, `Sammelrechnung`, `Angebot`, `AngebotPosition`,
`Aufgabe`, `AntragEmpfaenger`, `MarktpreisCache`, `Einstellung`.
