# AGRI-Office — Projekt-Wissensbasis

---

## Marketing-Website (`web/`)

Die SaaS-Landingpage liegt unter `web/index.html` (statisches **HTML**, kein Framework).

### Technologie-Stack der Website
- **Reines HTML5 + CSS3 + Vanilla JS** — kein Build-Schritt, kein Framework
- PHP kann optional für Kontaktformular-Backend ergänzt werden (z.B. `web/kontakt.php`)
- Fonts: Google Fonts (Inter + Playfair Display), per `<link>` geladen
- Icons: Inline SVG — keine externe Icon-Bibliothek
- Performance: Critical CSS inline, Scroll-Animationen via IntersectionObserver, Counter-Animation

### Struktur
```
web/
├── index.html          ← Haupt-Landingpage (Single-Page)
├── sitemap.xml         ← SEO Sitemap
├── robots.txt          ← Crawler-Regeln
└── img/
    └── favicon.svg     ← Favicon
```

### Abschnitte der Landingpage
1. **Hero** — Headline, CTA, App-Preview-Mockup, Trust-Avatare
2. **Trust-Bar** — DSGVO, Verfügbarkeit, Support, Kündigung
3. **Features-Übersicht** — 9 Feature-Cards (3×3 Grid)
4. **Deep-Dives** — CRM, Lager/Lieferung, KI/Marktpreise (alternierend mit App-Mockups)
5. **Stats** — Animierte Zähler (47+ Betriebe, 12.000+ Lieferscheine, 98%, 4h)
6. **Pricing** — 3 Tarife (Starter €49, Professional €129, Enterprise individuell) mit Monats/Jahres-Toggle
7. **Testimonials** — 3 Kundenstimmen
8. **FAQ** — 6 Fragen mit Accordion (Schema.org FAQPage)
9. **CTA-Banner** — E-Mail + Telefon Conversion
10. **Footer** — Links, Badges, Copyright

### SEO-Daten
- Title: `AGRI-Office – Die All-in-One CRM & ERP Software für Agrarhändler | SaaS`
- Meta Description: max 160 Zeichen, mit Keywords
- Schema.org: `SoftwareApplication` + `FAQPage` + `AggregateRating`
- Open Graph + Twitter Card vollständig
- Canonical: `https://agri-office.de/`
- Sitemap verlinkt in `robots.txt`

### Preise (SaaS-Tarife)
| Tarif | Monatlich | Jährlich | Nutzer |
|-------|-----------|----------|--------|
| Starter | €49 | €41 | bis 3 |
| Professional | €129 | €108 | bis 10 |
| Enterprise | individuell | — | unbegrenzt |

### Farben (CSS Custom Properties)
- `--green-700: #40916c` (Primär)
- `--green-800: #2d6a4f` (Hover)
- `--green-900: #1b4332` (Hero/Footer Hintergrund)
- `--amber: #f4a261` (CTA/Akzent)

### Regeln für Website-Änderungen
- Neue Features im Produkt → immer Feature-Card und ggf. Deep-Dive in `web/index.html` ergänzen
- Preisänderungen → in `web/index.html` Abschnitt `pricing-grid` UND Schema.org `offers` anpassen
- SEO-Keywords immer in `<title>`, `<meta name="description">` und `<h1>` integriert halten
- Keine externen JS-Bibliotheken hinzufügen (Performance)
- PHP nur für serverseitige Logik (Kontaktformular, Lead-Capture) — Datei dann `web/kontakt.php`

---

## Framework & Laufzeitumgebung

**WICHTIG: Lies immer zuerst `node_modules/next/dist/docs/` bevor du Code schreibst.**
Diese Next.js-Version hat Breaking Changes gegenüber dem Trainingswissen.

- **Next.js 16** App Router mit Turbopack
- **Prisma 7** + SQLite via `@libsql/client`
- **Branch:** aktuelle Feature-Branches unter `claude/**`
- **Deployment:** `http://194.164.59.48:8080`
- **RouteContext-Pattern:** `type Params = { params: Promise<{ id: string }> }` — immer `await ctx.params`

---

## Datenbankmodelle (Prisma)

```
Kunde               — Stammdaten, betriebsnummer, flaeche, geo-Koordinaten
KundeKontakt        — 1:N Ansprechpartner
KundeNotiz          — 1:N Notizen mit thema (Wichtig/Info/Offener Punkt/Wettbewerber…)
KundeAktivitaet     — CRM-Aktivitäten (typ, betreff, inhalt, datum, faelligAm, erledigt)
Lieferant           — Lieferantenstamm
Artikel             — Lagerartikel mit Preis, Mindestbestand
ArtikelInhaltsstoff — 1:N Inhaltsstoffe je Artikel (name, menge Float?, einheit String?)
ArtikelDokument     — Dateianlagen an Artikel
ArtikelLieferant    — Einkaufspreise je Lieferant
ArtikelPreisHistorie— Preishistorie
KundeArtikelPreis   — Sonderpreise je Kunde+Artikel
KundeBedarf         — Bedarfspläne (aktiv Boolean)
Lieferung           — Lieferscheine (status: geplant/geliefert/storniert)
Lieferposition      — Positionen einer Lieferung (chargeNr String?)
Wareneingang        — Wareneingänge
WareineingangPosition
Lagerbewegung       — alle Lagerbuchungen
Inventur            — Inventur-Kopf (datum, status: offen/abgeschlossen, bezeichnung)
InventurPosition    — Positionen einer Inventur (artikel, gezaehlt, erwartet)
Mengenrabatt        — Staffelrabatte
Sammelrechnung      — Rechnungen mit zahlungsstatus
Gutschrift          — Gutschriften (nummer, status, positionen)
GutschriftPosition
Ausgabe             — Ausgabenbuch (datum, betrag, kategorie, belegpfad)
Kontoumsatz         — Bankabgleich-Buchungen (buchungsdatum, betrag, verwendungszweck)
Bestellliste        — Bestellpositionen (artikel, menge, lieferant, status)
Besuchstermin       — Besuchsplanung (datum, kundeId, status, notiz)
Benutzer            — Multi-User (benutzername, passwortHash, rolle, aktiv)
AuditLog            — Änderungshistorie (entitaet, entitaetId, aktion, feld, alterWert, neuerWert)
KiNutzung           — KI-Kostentracking (provider, modell, feature, tokens, kostenCent)
Einstellung         — Key/Value-Store (system.*, firma.*, letzte_angebotsnummer, ki.*, smtp.*)
MarktpreisCache     — Eurostat-Preisindex (dataset, produktCode, zeitraum, land)
AgrarflaechenCache  — Flächendaten-Cache
AntragEmpfaenger    — AFIG-Daten (agrarzahlungen.de) aggregiert je Empfänger+Jahr
Angebot             — Angebote (nummer AN-YYYY-NNNN, status OFFEN/ANGENOMMEN/ABGELEHNT/ABGELAUFEN)
AngebotPosition     — Positionen eines Angebots (artikelId, menge, preis, rabatt, einheit)
KundeSchlag         — Schlagkartei je Kunde (name, flaeche, fruchtart, sorte, vorfrucht, aussaatJahr)
Bodenprobe          — Bodenproben je KundeSchlag (datum, pH, P2O5, K2O, Mg, Bor, Humus, NMin, Bodenart, Klasse)
Duengebedarf        — Berechnete N/P/K/Mg-Bedarfe je Schlag + Jahr (DüV Anlage 4)
Sachkundenachweis   — PSM/Spritzgerät/Düngerschulung pro Kunde mit Ablaufdatum + Beleg
Sortenversuch       — Sortenversuche/Demoflächen (jahr, kultur, standort, flaeche, status)
SortenversuchPosition — Sorte mit Ertrag/Feuchte/Protein/hl-Gew/Bonitur
Vorbestellung       — Saison-/Frühbezugsbestellungen (nummer VB-YYYY-NNNN, status OFFEN/BESTAETIGT/UMGEWANDELT/STORNIERT)
VorbestellungPosition — Position mit Mengen, Frühbezugspreis, Lagerreservierung
FruehbezugsStaffel  — Rabattregeln (saison, kategorie?, artikelId?, bestellfrist, rabattProzent)
KundeTier           — Tier/Tiergruppe je Kunde (tierart, nutzungsart, anzahl, gewicht, leistung) — Basis Rationsberechnung
Rationsberechnung   — gespeicherte Futterration (tierart, nutzungsart, modus, kundeId?/kundeTierId? optional, parameter JSON-Snapshot)
Aufgabe             — TODO/Wiedervorlage (betreff, faelligAm, erledigt, prioritaet, typ, kundeId?)
Reklamation         — Kundenbeschwerden (nummer, betreff, kategorie, prioritaet, status OFFEN/IN_BEARBEITUNG/GELOEST/GESCHLOSSEN, kundeId, lieferungId?)
Kampagne            — Marketingkampagnen (name, von, bis, rabattProzent, aktiv)
KampagneArtikel     — M:N Artikel↔Kampagne
KampagneKunde       — M:N Kunden↔Kampagne
Kontrakt            — Liefervereinbarungen (nummer, gueltigVon, gueltigBis, status, kundeId)
KontraktPosition    — Mengen-Abrufe je Kontrakt (artikel, menge, mengeAbgerufen)
PsmAusbringung      — PSM-Ausbringungsdokumentation (mittel, datum, menge, schlagId, kundeId)
Zertifizierung      — Kundenzertifizierungen (typ z.B. AMA/BIO/QS, gueltigBis, kundeId)
BodenanalyseAlbrecht— Albrecht-Analysen je KundeSchlag
Anbauplan           — Jahres-/Saisonplanung je Schlag (kultur, flaeche, saison, menge)
EingangsRechnung    — Lieferantenrechnungen (nummer, datum, faelligAm, betrag, mwst, status OFFEN/BEZAHLT/STORNIERT, lieferantId)
Bestellung          — Lieferantenbestellungen (nummer, datum, status OFFEN/BESTAETIGT/TEILGELIEFERT/ABGESCHLOSSEN/STORNIERT, lieferantId)
BestellungPosition  — Positionen je Bestellung (artikel, menge, mengeGeliefert, preis)
AngebotVorlage      — Wiederverwendbare Angebotsvorlagen (name, positionen)
AngebotVorlagePosition
Anlieferung         — Erzeugerbis-/Abrechnung (erzeuger, datum, artikel, menge, preis)
ChargenZertifikat   — Zertifikate je Charge (chargeNr, typ, datei)
Benachrichtigung    — System-Alerts (typ, text, gelesen, faelligAm)
KundePortalZugang   — Login-Daten fürs Kunden-Portal (username, passwortHash)
Teilzahlung         — Teilzahlungen zu Lieferungen (betrag, datum, notiz)
Umsatzziel          — Umsatzziele (monat/jahr, ziel, ist-Vergleich)
MqttRegel           — MQTT-Automatisierungsregeln (topic, bedingung, aktion, ki-Verarbeitung)
PegelstandCache     — Pegelstand-Daten (station, wert, einheit, zeitpunkt)
EinkaufStatus       — Interner Bestell-/Lieferstatus je BestelllistenPosition
KundeSprengstoffErklaerung — Sprengstoffvorläufer-Erklärungen je Kunde
```

### Einstellung Key-Konventionen
| Key | Inhalt |
|-----|--------|
| `system.logo` | Base64 DataURL des Firmenlogos |
| `system.tournamen` | JSON-Array gespeicherter Tour-Namen |
| `system.firmenname` | Firmenbezeichnung |
| `firma.*` | Firmenstammdaten (adresse, plz, ort, tel, email, iban, bic, bank, steuernummer, ustIdNr…) |
| `letzte_angebotsnummer` | Letzter Angebots-Zähler (AN-YYYY-NNNN) |
| `ki.mistral_key` | Mistral API-Key |
| `ki.modell_language` | Sprachmodell (Chat/JSON-Strukturierung), z.B. "mistral-large-latest" |
| `ki.modell_transcription` | Transkriptionsmodell (Diktieren), z.B. "voxtral-mini-latest" |
| `ki.modell_tts` | Sprachausgabe-Modell (optional) |
| `ki.tts_voice` | Stimmen-ID für Sprachausgabe (optional) |
| `ki.prompt.<feature>` | Benutzerdefinierter Prompt (leerer Wert = Standard) |
| `smtp.*` | SMTP-Konfiguration (host, port, secure, user, pass) |
| `email.from` | Absender-E-Mail-Adresse |
| `resend.api_key` | Resend API-Key |
| `system.nextcloud.serverUrl` | Nextcloud-Server-URL (WebDAV-Basis) |
| `system.nextcloud.username` | Nextcloud-Benutzername |
| `system.nextcloud.appPassword` | Nextcloud-App-Passwort (HTTP Basic Auth) |
| `system.nextcloud.rootPfad` | Root-Ordner in Nextcloud (Standard `/AGRI-Office`) |
| `system.nextcloud.zentralOrdner` | JSON-Array `{name, pfad}` frei benannter Ordner unter `Zentral/` |
| `system.nextcloud.backfillStatus` | JSON-Fortschrittsstatus des einmaligen Backfill-Jobs |
| `system.nextcloud.letzterAutoSync` | ISO-Zeitstempel des letzten automatischen Nextcloud-Sync-Laufs (Cron-Job `nextcloudSync` in `/api/cron`, höchstens 1×/Tag) |
| `system.nummernkreis` | JSON `{prefix, laenge, naechste}` für Artikelnummern |
| `system.bankkonten` | JSON-Array der Bankkonten |
| `datev.*` | DATEV Kontenrahmen-Mapping |

---

## Seitenstruktur (App Router)

```
app/
├── page.tsx                    Dashboard (KPIs, MATIF-Futures, Wiedervorlagen, Kein-Kontakt-Widget, CRM-Schnellerfassung)
├── login/page.tsx              Login-Seite (JWT-Session via lib/auth.ts)
├── kunden/
│   ├── page.tsx                Kundenliste (Filter, Pagination, Import/Export, Löschen)
│   ├── neu/page.tsx            Neuer Kunde
│   ├── bewertung/page.tsx      Kundenbewertung (RFM-Analyse, KPI-Cards)
│   ├── karte/page.tsx          Karte (Geocoding, Cluster)
│   └── [id]/page.tsx           Kundendetail
│       DIREKT_TABS: Stammdaten | Lieferhistorie | CRM | Angebote | Aufgaben
│       GRUPPEN-TABS: Vertrieb (Bedarfe, Sonderpreise, Statistik, Vorgangskette, Reklamationen)
│                     Agrar (Schlagkartei, Düngebedarf, Albrecht, Tiere, Agrarantrag)
│                     Mehr (Zertifizierungen, Sachkundenachweise, Dokumente, Erklärungen)
│       Tiere-Tab: Tierbestand erfassen + "Ration berechnen" → /rationsberechnung
│       Schnellübersicht-Strip: Kontakt, Adresse, Offener Betrag, Letzte Lieferung,
│             Schnellaktionen: Neue Lieferung, CRM, PSM-Ausbringung, + Kontrakt, Preisliste, Rückruf
│   └── [id]/mappe/page.tsx     Kundenmappe HTML-Druck
│   └── [id]/aktivitaet/page.tsx  CRM-Aktivität direkt erfassen
├── kundenimport/page.tsx       Erweiterter Kunden-Import (Schritt-für-Schritt UI)
├── telefonmaske/page.tsx       Telefon-Schnellsuche (Anruf-Lookup)
├── tagesansicht/page.tsx       Tages-Übersicht Außendienst
├── preisauskunft/page.tsx      Preisauskunft Artikel + Sonderpreise
├── besuchstermine/
│   ├── page.tsx                Besuchstermine-Kalender/Liste
│   └── neu/page.tsx
├── mailverteiler/page.tsx      E-Mail-Verteiler (Kunden-Segment-Auswahl + Versand)
├── angebote/
│   ├── page.tsx
│   ├── neu/page.tsx
│   ├── [id]/page.tsx
│   └── [id]/druck/page.tsx
├── aufgaben/
│   ├── page.tsx                TODO-Liste mit Filtern
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── bodenproben/
│   ├── page.tsx                Bodenproben-Liste je Schlag
│   └── neu/page.tsx
├── duengebedarf/page.tsx       Düngebedarfsermittlung (interaktiv, DüV Anlage 4)
├── sachkundenachweise/
│   ├── page.tsx                Liste mit Ablauf-Status (gültig/ablaufend/abgelaufen)
│   └── neu/page.tsx
├── sortenversuche/
│   ├── page.tsx                Versuche + Sorten-Ranking (Mehrjahres-Vergleich)
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── vorbestellungen/
│   ├── page.tsx                Vorbestellungen (Frühbezug) Liste
│   ├── neu/page.tsx            Frühbezugs-Staffel-Auto-Vorschlag
│   └── [id]/page.tsx           Detail + "→ Lieferung umwandeln"
├── rationsberechnung/page.tsx  Futterration berechnen (Modus einfach/detailliert, XLS-Export)
├── artikel/
│   ├── page.tsx                Artikelliste (Kategorie-Filter, Bulk-Delete, Pagination)
│   ├── neu/page.tsx
│   └── [id]/page.tsx           Artikeldetail (Inhaltsstoffe-Tab, KI-Suche, Lieferanten-Tab)
├── lieferanten/
│   ├── page.tsx
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── lieferungen/
│   ├── page.tsx
│   ├── neu/page.tsx            (mit Artikel-Verfügbarkeitsampel)
│   └── [id]/
│       ├── page.tsx
│       ├── lieferschein/page.tsx  HTML-Druckseite
│       └── rechnung/page.tsx      HTML-Druckseite
├── rechnungen/
│   ├── page.tsx                Rechnungsliste (aus Lieferungen + Sammelrechnungen)
│   └── neu/page.tsx            Neue Einzelrechnung
├── gutschriften/
│   ├── page.tsx
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── ausgaben/
│   ├── page.tsx                Ausgabenbuch (Kategorien, Beleg-Upload)
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── bankabgleich/
│   ├── page.tsx                Bankabgleich (Umsätze zuordnen, Vorschläge)
│   └── import/page.tsx         CSV/MT940-Import
├── sammelrechnungen/
│   ├── page.tsx
│   └── neu/page.tsx
├── mahnwesen/page.tsx          Mahnwesen (offene Rechnungen, Mahnstufen, PDF-Druck)
├── lager/
│   ├── page.tsx
│   ├── chargen/page.tsx        Chargenrückverfolgung
│   ├── umbuchungen/page.tsx    Lagerumbuchungen zwischen Lagerorten
│   └── wareneingang/page.tsx
├── inventur/
│   ├── page.tsx                Inventurliste
│   ├── neu/page.tsx
│   └── [id]/page.tsx           Inventur-Detail (Positionen, Abschluss)
├── bestellliste/page.tsx       Bestellliste (offene Bestellpositionen je Lieferant)
├── bestellungen/               Lieferantenbestellungen (OFFEN→BESTAETIGT→TEILGELIEFERT→ABGESCHLOSSEN)
│   ├── page.tsx
│   ├── neu/page.tsx
│   └── [id]/page.tsx           Detail + "→ Wareneingang buchen" Button
├── eingangsrechnungen/         Lieferantenrechnungen (OFFEN/BEZAHLT/STORNIERT)
│   ├── page.tsx
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── einkaufszettel/page.tsx     Schnell-Einkaufszettel
├── anlieferungen/              Erzeugerabrechnung
│   ├── page.tsx
│   └── neu/page.tsx
├── kampagnen/                  Marketingkampagnen mit Potenzialanalyse
│   ├── page.tsx
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── reklamationen/              Beschwerdemanagement
│   ├── page.tsx
│   ├── neu/page.tsx            (nimmt kundeId + lieferungId aus URL)
│   └── [id]/page.tsx
├── kontrakte/                  Liefervereinbarungen mit Abruf-Tracking
│   ├── page.tsx
│   ├── neu/page.tsx            (nimmt kundeId aus URL)
│   └── [id]/page.tsx
├── psm/                        PSM-Ausbringungsdokumentation
│   ├── page.tsx
│   ├── neu/page.tsx            (nimmt kundeId aus URL)
│   └── [id]/page.tsx
├── zertifizierungen/           Kundenzertifizierungen (AMA, BIO, QS, …)
│   ├── page.tsx
│   ├── neu/page.tsx
│   └── [id]/page.tsx
├── spritzfenster/page.tsx      Wetterbasierte Spritzfenster-Prognose
├── anbauplanung/               Jahres-/Saisonplanung je Schlag
│   ├── page.tsx
│   └── neu/page.tsx
├── bodenanalyse/               Albrecht-Analyse (ideale Bodenverhältnisse)
│   ├── page.tsx
│   └── neu/page.tsx
├── duev/                       DüV-Sperrfristen und Nährstoffbilanz
│   ├── page.tsx                Ampelansicht Sperrfristen
│   └── bilanz/page.tsx         Nährstoffbilanz (DüV §8)
├── offene-posten/page.tsx      Offene Posten mit Mahnstufen-Filter
├── finanzen/
│   └── cashflow/page.tsx       Cashflow-Übersicht + Liquiditätsvorschau
├── preislisten-import/page.tsx Preislisten-Import (EK-Update via CSV/Excel)
├── kalkulation/
│   ├── page.tsx                Preiskalkulation (Marge, Verkaufspreis aus EK)
│   └── naehrstoffe/page.tsx    Nährstoffkalkulator
├── mengenrabatte/
│   ├── page.tsx
│   └── neu/page.tsx
├── angebot-vorlagen/           Wiederverwendbare Angebotsvorlagen
│   ├── page.tsx
│   └── neu/page.tsx
├── crm/page.tsx                CRM + Kalender-Tab (Besuchsplanung)
├── tourenplanung/page.tsx
├── marktpreise/page.tsx
├── agrarantraege/page.tsx
├── gebietsanalyse/page.tsx
├── prognose/page.tsx
├── statistik/page.tsx          Statistik (Umsatz/Marge Charts, Kunden-/Artikel-Statistik)
│   ├── uebersicht/page.tsx     Statistik-Dashboard
│   ├── kunden/page.tsx         Kundenauswertung
│   ├── artikel/page.tsx        Artikelauswertung
│   ├── abc/page.tsx            ABC-Analyse
│   ├── saisonal/page.tsx       Saisonale Auswertung
│   ├── deckungsbeitrag/page.tsx Deckungsbeitrags-Analyse
│   ├── budget/page.tsx         Budgetplanung
│   ├── angebote/page.tsx       Angebots-Conversion
│   ├── crm/page.tsx            CRM-Aktivitäten-Statistik
│   ├── vorbestellungen/page.tsx Vorbestellungs-Auswertung
│   ├── aging/page.tsx          Offene-Posten-Aging
│   ├── ausgaben/page.tsx       Ausgaben-Auswertung
│   ├── lieferanten/page.tsx    Lieferanten/Einkauf-Statistik
│   ├── lager/page.tsx          Lager-Auswertung
│   ├── reklamationen/page.tsx  Reklamations-Statistik
│   └── liquiditaet/page.tsx    Liquiditätsanalyse (12-Monats-Vorschau)
├── analyse/
│   ├── abc/page.tsx            → redirect /statistik/abc
│   ├── deckungsbeitrag/page.tsx → redirect /statistik/deckungsbeitrag
│   └── saisonal/page.tsx       → redirect /statistik/saisonal
├── audit/page.tsx              Änderungshistorie (AuditLog, Filter nach Entität/Aktion)
├── exporte/page.tsx
├── qr/[id]/page.tsx            QR-Lieferschein-Scan (öffentlich, kein Login)
├── portal/                     Kunden-Portal (öffentlich/eigenständige Authentifizierung)
│   ├── page.tsx                Portal-Dashboard
│   ├── login/page.tsx
│   ├── bestellung/page.tsx
│   ├── lieferscheine/page.tsx
│   └── rechnungen/page.tsx
├── ki/
│   ├── page.tsx                KI-Übersicht
│   ├── wareneingang/page.tsx   Lieferschein-Erkennung per Foto
│   ├── lieferung/page.tsx      Bestellungs-Erkennung
│   ├── crm/page.tsx            CRM-Notizen aus Bild/Sprache
│   └── erkennung/page.tsx      Allgemeine Belegerkennung
├── fahrer/
│   ├── page.tsx                Fahrer-Cockpit (Tourenübersicht, Unterschrift auf Lieferschein)
│   └── standorte/page.tsx      Fahrer-Standort-Tracking
├── onboarding/page.tsx         Ersteinrichtungs-Assistent
├── hilfe/page.tsx              Hilfe-Seite (Feature-Übersicht, alle Bereiche)
├── einstellungen/
│   ├── page.tsx                Kachelübersicht
│   ├── firma/page.tsx
│   ├── erscheinungsbild/page.tsx
│   ├── lager/page.tsx
│   ├── adressen/page.tsx
│   ├── tournamen/page.tsx
│   ├── system/page.tsx
│   ├── stammdaten/page.tsx     Kategorien, Einheiten, Unterkategorien, Lagerorte, Fruchtarten
│   ├── lieferanten/page.tsx    Zahlungskonditionen, MwSt
│   ├── agrarantraege/page.tsx  CSV-Import UI (AFIG)
│   ├── ki/page.tsx             API-Keys, Modell, Prompt-Verwaltung, Statistik
│   ├── benutzer/               Benutzerverwaltung (Multi-User, Rollen)
│   │   ├── page.tsx
│   │   ├── neu/page.tsx
│   │   └── [id]/page.tsx
│   ├── email/page.tsx          SMTP/Resend-Konfiguration + Test
│   ├── backup/page.tsx         DB-Backup herunterladen / wiederherstellen
│   ├── nextcloud/page.tsx      Nextcloud-Zugangsdaten, Zentrale Ordner, Backfill-Job
│   ├── bankkonten/page.tsx     Bankkonten-Stammdaten (IBAN, BIC)
│   ├── nummernkreis/page.tsx   Artikelnummer-Prefix + Startnummer
│   ├── ausgaben/page.tsx       Ausgaben-Kategorien konfigurieren
│   ├── datev/page.tsx          DATEV-Export Konfiguration
│   ├── artikelkategorien/page.tsx  Artikelkategorien verwalten
│   ├── import/
│   │   ├── page.tsx            Import-Übersicht
│   │   ├── kunden/page.tsx     Kunden-Import UI
│   │   └── preisliste/page.tsx Preislisten-Import Einstellungen
│   ├── artikel-import/page.tsx Artikel-Import-Konfiguration
│   ├── mahnwesen/page.tsx      Mahnwesen-Konfiguration (Fristen, Gebühren, Zinssatz)
│   ├── marktpreise/page.tsx    Marktpreise-Cache-Verwaltung
│   ├── portal/page.tsx         Kunden-Portal-Zugangsdaten
│   ├── sicherheit/page.tsx     Passwort-Richtlinie
│   ├── benachrichtigungen/page.tsx  System-Alert-Schwellwerte
│   ├── loeschzentrum/page.tsx  Duplikate, Datenbereinigung, FTS-Rebuild
│   ├── gdpr/page.tsx           DSGVO (Art. 15–17)
│   ├── mqtt/page.tsx           MQTT-Automatisierungsregeln + KI
│   ├── email-import/page.tsx   Eingehende E-Mails (Resend) + KI-Verarbeitung
│   └── cron/page.tsx           Cron-Jobs überwachen + manuell auslösen
├── manifest.ts
├── icon.tsx
└── apple-icon.tsx
```

**Regel: Keine Modals für Formulare** — jedes Erfassungsformular ist eine eigene Seite (`/neu/page.tsx`).

---

## API-Routen

```
-- Authentifizierung --
/api/auth/login                 POST({benutzername,passwort}) — JWT-Session-Cookie setzen
/api/auth/logout                POST — Session-Cookie löschen
/api/auth/me                    GET — aktuelle Session-Infos

-- Benutzerverwaltung --
/api/benutzer                   GET, POST
/api/benutzer/[id]              GET, PUT, DELETE

-- Kunden --
/api/kunden                     GET(filter+limit+page+aktiv+tag), POST
/api/kunden/[id]                GET, PUT, DELETE
/api/kunden/[id]/kontakte       GET, POST, DELETE
/api/kunden/[id]/notizen        GET, POST, DELETE?notizId= (thema: Wichtig/Info/Wettbewerber/…)
/api/kunden/[id]/preise         GET, POST, DELETE (Sonderpreise, ehemals /sonderpreise)
/api/kunden/[id]/bedarfe        GET, POST, DELETE
/api/kunden/[id]/schlaegte      GET, POST, DELETE?schlagId=
/api/kunden/aktivitaeten        GET(?kundeId,?typ,?faelligVon,?faelligBis,?offene), POST
/api/kunden/adress-validierung  GET(stats), POST(batch)
/api/kunden/bewertung           GET — RFM-Auswertung
/api/kunden/import              POST (multipart CSV/Excel)
/api/kundenimport               POST — erweiterter Import-Endpunkt

-- Artikel --
/api/artikel                    GET(?search,?kategorie,?unterkategorie,?limit,?page), POST
/api/artikel/[id]               GET, PUT, DELETE
/api/artikel/[id]/lieferanten/[lieferantId]  DELETE (ArtikelLieferant entfernen)
/api/artikel/[id]/preishistorie GET
/api/artikel/[id]/dokumente     GET, POST (Dateianlage)
/api/artikel/[id]/dokumente/[docId]  DELETE
/api/artikel/import             POST (multipart CSV/Excel)
/api/artikel/dedup              POST — Duplikat-Bereinigung
/api/artikel/kategorien         GET — Kategorien + Unterkategorien aus DB

-- Lieferanten --
/api/lieferanten                GET, POST
/api/lieferanten/[id]           GET, PUT, DELETE

-- Lieferungen --
/api/lieferungen                GET, POST
/api/lieferungen/[id]           GET, PUT, DELETE
/api/lieferungen/[id]/positionen         GET, POST
/api/lieferungen/[id]/positionen/[posId] PUT, DELETE
/api/lieferungen/wiederkehrend  POST — wiederkehrende Lieferungen auslösen

-- Lager --
/api/lager                      GET — Lagerübersicht (Bestände)
/api/lager/wareneingaenge       GET, POST
/api/lager/korrektur            POST — Lagerkorrektur (ehemals /korrekturen)
/api/lager/chargen              GET?charge=X (min. 2 Zeichen, take:500)
/api/lager/umbuchungen          GET, POST — Umbuchung zwischen Lagerorten
/api/lager/bewegungen           GET(?artikelId,?von,?bis)
/api/lager/lagerorte            GET — konfigurierte Lagerorte

-- Inventur --
/api/inventur                   GET, POST
/api/inventur/[id]              GET, PUT, DELETE (inkl. Abschluss-Aktion)

-- Bestellliste / Prognose --
/api/bestellliste               GET, POST
/api/bestellliste/[id]          PUT, DELETE
/api/prognose                   GET(?kundeId,?artikelId,?monate)
/api/prognose/bestellvorschlag  GET — automatischer Bestellvorschlag

-- Angebote --
/api/angebote                   GET(?kundeId,?status,?search), POST (auto AN-YYYY-NNNN)
/api/angebote/[id]              GET, PUT({aktion:"annehmen"}|{status,notiz,gueltigBis}), DELETE

-- Aufgaben --
/api/aufgaben                   GET(?status,?kundeId,?tag,?prioritaet,?faelligBis), POST
/api/aufgaben/[id]              GET, PUT, DELETE

-- Bodenproben / Düngebedarf / Sachkunde --
/api/bodenproben                GET(?schlagId,?kundeId), POST, DELETE?id=
/api/bodenproben/import         POST (multipart CSV/Excel mit Spalten: Schlag, Datum, ProbenNr, Labor, Tiefe, pH, P2O5, K2O, Mg, B, Humus, NMin, CN, Bodenart, Klasse)
/api/duengebedarf               GET(?schlagId|?fruchtarten=1), POST({...,speichern?}), DELETE?id=
/api/sachkundenachweise         GET(?kundeId,?abgelaufen=1,?ablaufendIn=90), POST, PUT?id=, DELETE?id=

-- Sortenversuche / Demoflächen --
/api/sortenversuche             GET(?jahr,?kultur,?kundeId,?sorte), POST (inkl. positionen[])
/api/sortenversuche/[id]        GET, PUT (mit positionen[] → full replace), DELETE

-- Vorbestellungen / Frühbezug --
/api/vorbestellungen            GET(?kundeId,?status,?saison), POST (auto Nummer VB-YYYY-NNNN + auto Frühbezugs-Staffel)
/api/vorbestellungen/[id]       GET, PUT({status?}|{aktion:"umwandeln"}), DELETE
/api/fruehbezugsstaffel         GET(?saison,?aktiv), POST, PUT?id=, DELETE?id=

-- HIT/VVVO --
/api/vvvo                       GET?nr= / POST{nr} — Format-Validierung der Betriebsnummer

-- Rationsberechnung / Tierhaltung --
/api/kunden/[id]/tiere          GET, POST, PUT?tierId=, DELETE?tierId= (Tierbestand je Kunde)
/api/rationsberechnung          GET(?meta=1 | ?kundeId | ?kundeTierId), POST({...,speichern?}), DELETE?id=
/api/rationsberechnung/export   GET?id= (gespeichert) | POST{ergebnis,eingabe} — XLS-Download
/api/futterwerte                GET (Standardtabelle + custom), PUT({custom[]}) — Einstellung-Key futterwerte.custom

-- Besuchstermine --
/api/besuchstermine             GET, POST

-- Finanzen --
/api/sammelrechnungen           GET, POST
/api/sammelrechnungen/[id]      GET, PUT, DELETE
/api/gutschriften               GET, POST
/api/gutschriften/[id]          GET, PUT, DELETE
/api/ausgaben                   GET(?kategorie,?von,?bis), POST
/api/ausgaben/[id]              GET, PUT, DELETE
/api/ausgaben/[id]/beleg        POST (Beleg-Upload)
/api/bankabgleich               GET(?status), POST (Kontoumsatz speichern)
/api/bankabgleich/[id]          PUT, DELETE
/api/bankabgleich/vorschlaege   GET — Zuordnungsvorschläge
/api/mahnwesen                  GET(?kundeId,?mahnstufe,?uberfaellig)
/api/mengenrabatte              GET(?artikelId=), POST, DELETE

-- Rechnungen (Druck/Export) --
/api/exporte/rechnung           GET?lieferungId= — Einzel-Rechnungs-PDF
/api/exporte/rechnung/mail      POST — Rechnung per E-Mail versenden
/api/exporte/sammelrechnung     GET?sammelrechnungId=
/api/exporte/lieferschein       GET?lieferungId=
/api/exporte/lieferschein/mail  POST — Lieferschein per E-Mail versenden
/api/exporte/kundenmappe        GET?kundeId=
/api/exporte/tour               GET(?tourname=)
/api/exporte/datev              GET(?von,?bis) — DATEV-Export CSV
/api/exporte/datev/archivieren  POST{von,bis} — DATEV-Export zusätzlich nach Nextcloud archivieren
/api/exporte/bulk               POST — Bulk-Export
/api/exporte/bestellvorschlag   GET — Bestellvorschlag CSV/PDF
/api/exporte/zugferd            GET?lieferungId= — ZUGFeRD/Factur-X XML

-- AFIG (Agraranträge) --
/api/agrarantraege              GET(search), PATCH(link), DELETE
/api/agrarantraege/import       POST (multipart|{action:"url"}|{action:"serverpath"})
/api/agrarantraege/pdf          GET?kundeId=

-- Agrarflächen --
/api/agrarflaechen              GET?lat=&lng=&radius=
/api/agrarflaechen/analyse      GET?kundeId= — Flächenanalyse mit Overpass

-- Marktpreise / MATIF --
/api/marktpreise                GET(?force=true) — Eurostat-Preisindex
/api/marktpreise/aktuell        GET — aktuellste Preise je Produkt
/api/marktpreise/spot           GET — MATIF Futures (Yahoo Finance via lib/matif.ts)

-- Kalkulation --
/api/kalkulation                GET(?artikelId,?lieferantId,?marge)
/api/kalkulation/naehrstoffe    POST — Nährstoffkalkulator

-- Kampagnen --
/api/kampagnen                  GET(?aktiv), POST
/api/kampagnen/[id]             GET, PUT, DELETE
/api/kampagnen/[id]/artikel     GET, POST, DELETE?artikelId=
/api/kampagnen/[id]/kunden      GET, POST
/api/kampagnen/[id]/potenzial   GET — nicht zugeordnete Kunden mit Umsatz

-- Reklamationen --
/api/reklamationen              GET(?kundeId,?status,?prioritaet), POST
/api/reklamationen/[id]         GET, PUT, DELETE

-- Kontrakte --
/api/kontrakte                  GET(?kundeId,?status), POST
/api/kontrakte/[id]             GET, PUT, DELETE

-- PSM-Ausbringung --
/api/psm                        GET(?kundeId,?von,?bis), POST
/api/psm/[id]                   GET, PUT, DELETE

-- Zertifizierungen --
/api/zertifizierungen           GET(?kundeId,?abgelaufen), POST
/api/zertifizierungen/[id]      GET, PUT, DELETE

-- Anbauplanung --
/api/anbauplanung               GET(?kundeId,?saison,?schlagId), POST
/api/anbauplanung/[id]          GET, PUT, DELETE

-- Bodenanalyse (Albrecht) --
/api/bodenanalyse               GET(?schlagId,?kundeId), POST
/api/bodenanalyse/[id]          GET, PUT, DELETE

-- DüV / Nährstoffbilanz --
/api/duev/sperrfristen          GET(?kundeId,?schlagId,?datum) — Sperrfristampel
/api/duev/bilanz                GET(?kundeId,?jahr) — Nährstoffbilanz

-- Einkauf / Lieferantenbestellungen --
/api/bestellungen               GET(?lieferantId,?status), POST (auto Nummer)
/api/bestellungen/[id]          GET, PUT({aktion:"bestätigen"|"abschliessen"|"stornieren"}|{positionen[]}), DELETE
/api/eingangsrechnungen         GET(?lieferantId,?status), POST
/api/eingangsrechnungen/[id]    GET, PUT, DELETE
/api/eingangsrechnungen/[id]/beleg  POST (Beleg-Upload, spiegelt nach Nextcloud Buchhaltung/), DELETE
/api/einkaufszettel             GET, POST, PUT?id=, DELETE?id=
/api/anlieferungen              GET(?lieferantId), POST
/api/anlieferungen/[id]         GET, PUT, DELETE

-- Offene Posten --
/api/offene-posten              GET(?mahnstufe) — aggregiert aus Lieferungen

-- Finanzen / Cashflow --
/api/finanzen/cashflow          GET(?von,?bis) — monatliche Ein-/Ausgaben + Trend

-- Analyse --
/api/analyse/abc                GET(?von,?bis) — ABC-Analyse Kunden + Artikel
/api/analyse/deckungsbeitrag    GET(?von,?bis,?kundeId,?artikelId)
/api/analyse/saisonal           GET(?von,?bis,?gruppeNach)
/api/statistik                  GET(?von,?bis,?granularitaet)
/api/statistik/budget           GET, POST — Budgetplanung
/api/statistik/reklamationen    GET(?von,?bis) — Reklamations-KPIs

-- Audit / Änderungshistorie --
/api/audit                      GET(?entitaet,?entitaetId,?aktion,?von,?bis,?limit)

-- Nextcloud --
/api/nextcloud/status            GET — Verbindungsstatus
/api/nextcloud/zentral           GET — zentrale Ablage
/api/nextcloud/kunden/[id]       GET, POST — Kunden-Ordner-Inhalt + Direkt-Upload
/api/nextcloud/artikel/[id]      GET — Artikel-Ordner-Inhalt (nur Lesezugriff, Uploads laufen über ArtikelDokument/ChargenZertifikat)
/api/nextcloud/dokumente         GET, POST — Rechnung/Lieferschein/Angebot/Gutschrift in Kunden-Unterordner
/api/nextcloud/backfill          POST — einmaligen Backfill-Job starten
/api/nextcloud/backfill/status   GET — Backfill-Fortschritt (Polling)

-- KI --
/api/ki/analyze                 POST({image?,text?,feature}) — Bild-/Text-Analyse (wareneingang|lieferung|crm)
/api/ki/inhaltsstoffe           POST({name,kategorie?}) — KI-Recherche Produktzusammensetzung
/api/ki/beleg                   POST — Beleg per KI erkennen (OCR)
/api/ki/churn                   GET?kundeId= — Churn-Risiko-Analyse
/api/ki/test                    POST — Verbindungstest API-Key
/api/ki/statistik               GET(?tage=30) — Nutzungsstatistik
/api/ki/preis-empfehlung        POST — KI-basierte Preisempfehlung (intern)

-- System --
/api/dashboard                  GET (inkl. wiedervorlagen, keinKontakt, lieferungenOhneRechnung, matif)
/api/tagesansicht               GET (offeneAufgaben, faelligeAnrufe, keinKontakt30, heutigeTouren)
/api/telefonmaske               GET?q=X (max 5 Kunden mit Kontakten, Bedarfen, offenen Rechnungen)
/api/einstellungen              GET(?prefix=), PUT({key,value})
/api/einstellungen/smtp-test    POST — SMTP-Verbindung testen
/api/einstellungen/email-test   POST — Test-E-Mail senden
/api/einstellungen/artikel-import     GET/PUT — Artikel-Import-Konfiguration
/api/einstellungen/preisliste-import  GET/PUT — Preislisten-Import-Konfiguration
/api/suche                      GET(?q=) — Kunden/Artikel/Lieferungen/Inhaltsstoffe, min 2 Zeichen
/api/suche/rebuild              POST — FTS5-Index neu aufbauen
/api/backup                     GET — DB-Backup-Status
/api/backup/download            GET — SQLite-Datenbank herunterladen
/api/db-check                   GET — DB-Verbindungscheck (Health-Check)
/api/preislisten-import         POST — Preislisten-EK-Update
```

---

## Schlüsselkomponenten

### `components/SearchableSelect.tsx`
Wiederverwendbarer Combobox (ersetzt alle `<select>`):
```tsx
<SearchableSelect
  options={[{ value: "1", label: "Name" }]}
  value={selectedId}
  onChange={setSelectedId}
  placeholder="Suchen…"
/>
```

### `components/Nav.tsx`
- Lädt `system.logo` aus DB, zeigt es im Header
- Gruppen: Dashboard | Kunden (Kundenliste, Karte, Import, CRM, Besuchstermine, Gebietsanalyse,
  AFIG, Mailverteiler, Kundenbewertung, Telefonmaske, Preisauskunft, Tagesansicht) |
  Artikel (Artikelstamm, Lieferanten, Lager, Umbuchungen, Inventur, Preiskalkulation) |
  Lieferungen (Angebote, Aufgaben/TODO, Lieferungen, Fahrer-Cockpit, Bestellliste, Tourenplanung) |
  Finanzen (Rechnungen, Sammelrechnungen, Gutschriften, Ausgabenbuch, Bankabgleich, Mahnwesen,
  Mengenrabatte, Export) | Analyse (Statistik, Prognose, Marktpreise, ABC-Analyse, Saisonal,
  Deckungsbeitrag, Änderungshistorie) | KI | Einstellungen

### `components/Card.tsx`
`<Card>` und `<KpiCard label="" value="" color="" sub="" />`

### `components/ServiceWorkerRegistration.tsx`
Client-Komponente, registriert `/sw.js` für PWA-Offline-Support.

### `components/SearchPalette.tsx`
Globale Cmd+K / Ctrl+K Suche (Overlay). In `app/layout.tsx` eingebunden.
- Sucht via `GET /api/suche?q=...` (min. 2 Zeichen)
- Schnellaktionen: CRM erfassen, Neue Lieferung, Neues Angebot, Neuer Kunde
- Inline-CRM-Formular (view="crm") — POST zu `/api/kunden/aktivitaeten`
- Kunden-Aktionsbuttons: 📦 → `/lieferungen/neu?kundeId=X`, 📝 → CRM inline

### `components/Badge.tsx`
`<StatusBadge status="OFFEN|GELIEFERT|ABGERECHNET" />` und `<MargeBadge />`

---

## Drucken / PDF

- Seiten: `window.print()` + Tailwind `print:hidden` / `print:block`
- `@media print { @page { margin: 1.5cm; size: A4; } }`
- Firmendaten für Drucklayout: `GET /api/einstellungen?prefix=firma.`
- Kundenmappe: `/kunden/[id]/mappe/page.tsx` (HTML-Druck, alle Daten)
- Lieferschein: `/lieferungen/[id]/lieferschein/page.tsx` (keine Preise, Unterschriftsfeld)
- Rechnung: `/lieferungen/[id]/rechnung/page.tsx` (MwSt gruppiert, IBAN/BIC)
- Angebots-Druck: `/angebote/[id]/druck/page.tsx`
- Tour-PDF: `GET /api/exporte/tour?tourname=X` (jsPDF)
- AFIG-PDF: `GET /api/agrarantraege/pdf?kundeId=X` (jsPDF)

---

## Einstellungen-Architektur (Pflichtprinzip)

**Regel: Alle Einstellungen/Konfigurationen IMMER als Kachelseite + Unterseiten aufbauen.**

| Kachel | Seite | Inhalt |
|--------|-------|--------|
| Firma | /einstellungen/firma | Name, Adresse, Kontakt |
| Erscheinungsbild | /einstellungen/erscheinungsbild | Logo (DB: system.logo) |
| Lager | /einstellungen/lager | Mindestbestände |
| Adressen | /einstellungen/adressen | Batch-Geocoding |
| Tour-Namen | /einstellungen/tournamen | system.tournamen JSON-Array |
| System | /einstellungen/system | Version, DB |
| Stammdaten | /einstellungen/stammdaten | Kategorien, Einheiten, Unterkategorien je Kategorie, Lagerorte, Fruchtarten |
| Lieferanten | /einstellungen/lieferanten | Zahlungskonditionen, MwSt |
| Agraranträge (AFIG) | /einstellungen/agrarantraege | CSV-Import UI |
| KI / AI | /einstellungen/ki | API-Keys, Modell, Prompt-Verwaltung, Statistik |
| Benutzer | /einstellungen/benutzer | Multi-User, Passwort-Reset, Rollen |
| E-Mail | /einstellungen/email | SMTP/Resend-Konfiguration + Test |
| Backup | /einstellungen/backup | DB-Backup herunterladen |
| Nextcloud | /einstellungen/nextcloud | Server-URL/App-Passwort, Root-Ordner, Zentrale Ordner, Backfill-Job |
| Bankkonten | /einstellungen/bankkonten | IBAN/BIC für Rechnungen + Bankabgleich |
| Nummernkreis | /einstellungen/nummernkreis | Artikelnummer-Prefix + Startnummer |
| Ausgaben-Kategorien | /einstellungen/ausgaben | Ausgabenkategorien für Ausgabenbuch |
| DATEV | /einstellungen/datev | DATEV-Kontenrahmen-Mapping |
| Artikelkategorien | /einstellungen/artikelkategorien | Kategorien verwalten |
| Import | /einstellungen/import | Kunden-Import + Preislisten-Import Konfiguration |
| Frühbezug | /einstellungen/fruehbezug | Saison-Rabattstaffeln für Vorbestellungen |
| Futterwerte | /einstellungen/futterwerte | Eigene Futtermittel für die Rationsberechnung pflegen |

---

## Bekannte Bugs / Fallstricke

| Problem | Ursache | Fix |
|---------|---------|-----|
| Rechnungsdatum null → "55 Jahre überfällig" | `new Date(null)` = 1970 | `rechnungDatum ?? datum` |
| LieferhistorieTab: false "Überfällig" ohne Rechnung | `l.datum` statt Rechnungsdatum | `basisDatum = l.rechnungDatum ?? l.datum`; guard `if (!l.rechnungNr) return Offen` |
| Multi-Lieferung bekommt verschiedene Rechnungsnummern | Jedes PATCH erzeugt neue Nr. | Erste Lieferung PATCH, Rest PUT mit gleicher Nr. |
| React-Key-Warnung bei expandierbaren Zeilen | `key` auf `<>` statt `<React.Fragment>` | `<React.Fragment key={id}>` |
| Stale bestand in Inventur-Transaktion | `findMany` außerhalb `$transaction` | `tx.artikel.findMany` INNERHALB Callback |
| N+1 bei wiederkehrenden Lieferungen | `findFirst` in Loop | Bulk `findMany` + `Map<"artikelId|kundeId", Date>` |
| AFIG CSV "Keine Datensätze extrahiert" | `Readable.from(text.split("\n"))` | `Readable.from([text])` |
| AFIG Dezimalwerte falsch (2634.8→26348) | Punkt als Tausender gestrippt | Nur strippen wenn Komma auch vorhanden |
| Angebotsnummer Race Condition (2 parallele POSTs) | TOCTOU auf `letzte_angebotsnummer` | Nummer-Vergabe innerhalb `$transaction`; `Angebot.nummer` hat `@unique` Constraint |
| useSearchParams ohne Suspense → Build-Fehler | Next.js 16 erfordert Suspense-Boundary | Innere Komponente + `export default` wraps in `<Suspense>` |
| Unbounded DB-Query (full table scan) | Kein `take` Limit | Immer `take:` setzen; dashboard aktivKunden: DB-Filter + take:200 |
| Stack Trace im Client bei DB-Fehler | Kein try/catch in API-Route | Alle prisma-Calls in try/catch, P2025 → 404 |
| err.message in Produktion sichtbar | Keine dev-Guard | `const isDev = process.env.NODE_ENV === "development"; const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";` |
| `s.map is not a function` im Frontend | API gibt `{error:"…"}` zurück statt Array | Immer `Array.isArray(data) ? data : []` als Fallback nach fetch |
| `liefposArtikelSelect` / `artikelSafeSelect` "Cannot find name" | Import fehlt in Route-Datei | `import { artikelSafeSelect, liefposArtikelSelect } from "@/lib/artikel-select"` ergänzen |
| Artikel-Import Race Condition bei Artikelnummern | `naechsteArtikelnummer()` außerhalb Transaktion | Nummer-Vergabe + `artikel.create` innerhalb `$transaction` |
| Unterkategorie wird nicht gespeichert | `unterkategorie` aus body destructured als `_uk` | Nur `const { lieferanten, inhaltsstoffe, ...data } = body` – kein weiteres Destructuring |
| Stammdaten-Einheiten unvollständig | Lokale DEFAULT_EINHEITEN statt Import aus lib | `import { DEFAULT_EINHEITEN } from "@/lib/auswahllisten"` in stammdaten/page.tsx |
| PDF-Notiz doppelt gerendert | Zwei identische Hinweis-Blöcke in pdfGenerator.ts | Zweites Vorkommen entfernen (nach der Zahlungsbox) |
| Checkbox nicht anwählbar, Bulk-Delete fehlt | `<td onClick>` rief `toggleSelect` zusätzlich zu `onChange` des Inputs auf → doppelter Toggle = netto 0 | `<td onClick={(e) => e.stopPropagation()}>` — nur Navigation blocken, Selektion nur über `onChange` |
| Artikelimport: EK + Lieferant gehen verloren | Export-Spalte heißt "Bevorzugter Lieferant", Alias kannte nur "Lieferant" | "Bevorzugter Lieferant" als erstes Element in `ARTIKEL_ALIAS.lieferant` in `lib/import-utils.ts` |
| Gefilterte Ansicht geht bei Zurück-Navigation verloren | Zustand nur im React-State, geht bei Unmount verloren | Filter in `sessionStorage("artikel-filters")` persistieren; beim Remount wiederherstellen |
| Artikelliste: Bulk-Delete ohne Multi-Select | — | Checkboxen + Bulk-Delete-Button in `app/artikel/page.tsx` (PR #108) |
| Preisliste-Import erstellt Duplikate | Kein Duplikat-Check vor `prisma.artikel.create` | `findFirst({ where: { name: { equals: name } } })` vor Create; bei Treffer EK/Lieferant updaten statt erstellen |
| Lieferschein/Rechnung: kein Kategorie-Präfix | Positionen zeigten nur Artikelname | `kategorie`/`unterkategorie` in `Position`/`ArtikelInfo` Interface aufnehmen, Präfix im Druck voranstellen |
| Saatgut-Unterkategorie: Grünland fehlte | DEFAULT_SAATGUT_KULTUREN unvollständig | "Grünland" in Liste ergänzt, "Kartoffeln" → "Pflanzkartoffeln" umbenannt |
| Kategorie "Pflege" fehlte | DEFAULT_ARTIKEL_KATEGORIEN unvollständig | "Pflege" in Liste ergänzt |
| Unterkategorien nur für Saatgut verwaltbar | `system.saatgut_kulturen` war einziger Key | Generisches Key-Schema `system.unterkategorien_<Kategorie>` eingeführt; `getUnterkategorienKey()` in `lib/auswahllisten.ts`; `SubkategorienSection` Komponente in Stammdaten |
| Lagerorte nicht konfigurierbar | Hardcoded leere Liste | `DEFAULT_LAGERORTE` + `system.lagerorte` Einstellung; `<datalist>` Autocomplete in Artikel-Formularen |
| Fruchtarten nicht konfigurierbar | Hardcoded in Schlagkartei | `DEFAULT_FRUCHTARTEN` + `system.fruchtarten` Einstellung; `<datalist>` Autocomplete in Schlagkartei |
| Lieferant von Artikel nicht löschbar | Kein Delete-Endpunkt | `DELETE /api/artikel/[id]/lieferanten/[lieferantId]` + Löschen-Button im Lieferanten-Tab |
| Mail-Log "Erneut senden" ohne PDF-Anhang (Rechnung/Gutschrift/Angebot kommt beim Kunden ohne Anhang an) | `MailLog` speichert nur `anhangNamen` (Dateinamen), nie die Binärdaten; Resend-Route hat nur Text/HTML erneut verschickt | `MailLog.entityId` ergänzt (Referenz auf Lieferung/Gutschrift/Angebot); `sendEmail()` speichert `entityId` mit; Resend-Route (`/api/einstellungen/mail-log/[id]/resend`) erzeugt den PDF-Anhang aus `feature`+`entityId` frisch neu, statt ihn wegzulassen; alte Log-Einträge ohne `entityId` liefern verständlichen Fehler statt stillem Anhangsverlust |
| Lieferschein konnte trotz `KundeKontakt.lieferscheinEmail`-Flag nie per E-Mail versendet werden | Kein Mail-Endpunkt/Button für Lieferschein (nur Rechnung/Gutschrift/Angebot hatten Versand) | `POST /api/exporte/lieferschein/mail` + `lieferscheinEmail()`-Template + "E-Mail"-Button/`EmailVersandModal` auf `/lieferungen/[id]/lieferschein`; `Lieferung.lieferscheinVersendetAm` für "bereits versendet"-Anzeige |
| KI-Modell konnte per Freitext (`<input list>`/Datalist) auf jeden beliebigen, ungültigen Modellnamen gesetzt werden | Kein zentraler Katalog, kein Whitelisting beim Speichern | `lib/ki-modelle.ts` als einzige Quelle der Wahrheit (Katalog + Standardwert je Kategorie); `/einstellungen/ki` nutzt `SearchableSelect`-Dropdown statt Freitext; `PUT /api/einstellungen` lehnt Werte außerhalb des Katalogs ab; `getAiConfig()` fällt bei ungültigem/veraltetem DB-Wert sauber auf den Standardwert zurück |
| Rechnungen/Lieferscheine: kein Überblick, welche noch nicht per E-Mail versendet wurden | `rechnungVersendetAm`/`lieferscheinVersendetAm` existierten nur als Einzel-Anzeige auf der jeweiligen Druckseite, keine Liste/Filter | `/api/lieferungen` Query-Parameter `lieferscheinOffen=true`/`rechnungOffen=true`; Filter-Dropdown in `/lieferungen`, Toggle-Button "✉ Nicht versendet" in `/rechnungen`; ✉-Badge je Zeile wenn `*VersendetAm` leer |
| KI-Batch-Erkennung: Menge als "18 x 25 kg" (Gebindeanzahl × Gebindegröße) wurde nicht multipliziert | Prompt (`PROMPTS.wareneingang`/`PROMPTS.lieferung` in `lib/ai.ts`) enthielt keine Regel für Mengen-Multiplikation | Anweisung ergänzt: bei "Anzahl x Gebindegröße" das Produkt beider Zahlen als `menge` setzen (18 × 25 = 450), nicht nur eine Zahl übernehmen |
| Nextcloud-Client warnte bei jedem Kunden-/Artikelordner: "Ordnernamen, die das Zeichen ':' enthalten, werden von diesem Dateisystem nicht unterstützt" | `kundenOrdnerPfad`/`artikelOrdnerPfad` hängten `(ID:${id})` mit Doppelpunkt an — von manchen Nextcloud-Speicher-Backends (externe Windows-/exFAT-Dateisysteme) nicht unterstützt | Format auf `(ID-${id})` geändert; `kundenOrdnerPfadLegacy`/`artikelOrdnerPfadLegacy` in `lib/nextcloud.ts` für die alten Pfade; einmalige Umbenennungs-Migration (`verschiebeOrdner`) als Schritt 0 in `lib/nextcloud-backfill.ts`, läuft automatisch bei jedem Backfill/Auto-Sync mit |
| Standard-Zahlungsziel (`firma.zahlungszielStandard`) wurde bei neu angelegten Lieferungen/Rechnungen nie gezogen | `Lieferung.create()` setzte `zahlungsziel` nirgends explizit → Prisma-Schema-`@default(30)` griff immer, unabhängig von der Einstellung (betraf manuelle Lieferungserfassung, Vorbestellung→Lieferung, Angebot→Sammelrechnung, wiederkehrende Lieferungen) | `ladeStandardZahlungsziel(tx)` in `lib/lieferung.ts` als zentrale Quelle; wird jetzt in `erstelleLieferungMitPreisberechnung()` sowie in `app/api/angebote/[id]/route.ts`, `app/api/vorbestellungen/[id]/route.ts` und `app/api/lieferungen/wiederkehrend/route.ts` beim `create` explizit gesetzt statt sich auf den Schema-Default zu verlassen |

## Schemata: Wichtige Felder

- `Artikel.mwstSatz Float @default(19)` — 0 | 7 | 19
- `Artikel.aktuellerBestand Float` + `Artikel.mindestbestand Float`
- `ArtikelInhaltsstoff.name String` + `menge Float?` + `einheit String?` — 1:N pro Artikel
- `AntragEmpfaenger.steuerNr String?`
- `Lieferung.rechnungNr String?` + `rechnungDatum DateTime?`
- `Lieferposition.chargeNr String?` — bis 2026 immer Kannfeld; ab 2027-01-01 Pflichtfeld bei Artikel-Kategorie "Futter" (Rückverfolgbarkeit Tierfutter). Enforcement: `istChargeNrPflichtFuerLieferschein()` in `lib/lieferung.ts`, geprüft beim Statuswechsel geplant→geliefert in `app/api/lieferungen/[id]/route.ts` (PUT + PATCH/QR). Unabhängig vom allgemeinen, konfigurierbaren `Artikel.chargePflicht`-Hinweisflag (das zusätzlich Saatgut abdeckt, aber nie blockiert).
- `Lieferung.rechnungVersendetAm DateTime?` / `Lieferung.lieferscheinVersendetAm DateTime?` — Zeitpunkt E-Mail-Versand; Filter dafür in `/api/lieferungen` (`rechnungOffen`/`lieferscheinOffen`)
- `Artikel.notiz String?` — freie Notiz/Hinweis; wird beim Hinzufügen zu einer Lieferung in `Lieferposition.notiz` durchgeschleift und auf Lieferschein/Rechnung gedruckt (Abpackungshinweise bei gleichem kg-Preis)
- `Kunde.lat Float?` + `lng Float?`
- `Aufgabe.prioritaet` — "niedrig"|"normal"|"hoch"|"kritisch" (JSON-validiert)
- `Aufgabe.typ` — "aufgabe"|"anruf"|"besuch"|"email" (JSON-validiert)
- `Aufgabe.tags String @default("[]")` — JSON array
- `Angebot.status` — "OFFEN"|"ANGENOMMEN"|"ABGELEHNT"|"ABGELAUFEN" (Whitelist in API)
- `KundeNotiz.thema` — "Wichtig"|"Info"|"Offener Punkt"|"Wettbewerber"|…
- `Kunde.vvvoNr` — 12-stellige Betriebsnummer (DE 276 + 2 BL + 7 Betrieb); normalisiert auf Server beim PUT
- `Sachkundenachweis.typ` — "PSM-Sachkunde"|"Spritzgeraetekontrolle"|"Duengerschulung"|"Sprengstoff-Sachkunde"|"Mais-Beize-Sachkunde"|"Wildlebensmittel-Schulung"|"Sonstige"
- `Vorbestellung.status` — "OFFEN"|"BESTAETIGT"|"UMGEWANDELT"|"STORNIERT"
- `Sortenversuch.status` — "LAUFEND"|"ABGESCHLOSSEN"

## Auswahllisten-Architektur (`lib/auswahllisten.ts`)

Alle Dropdown/Autocomplete-Daten kommen aus `lib/auswahllisten.ts` + `Einstellung`-Tabelle. Nie lokal duplizieren.

| Export | DB-Key | Inhalt |
|--------|--------|--------|
| `DEFAULT_ARTIKEL_KATEGORIEN` | — | Futter, Duenger, Saatgut, Analysen, Beratung, Pflege |
| `DEFAULT_SAATGUT_KULTUREN` | `system.saatgut_kulturen` | Saatgut-Unterkategorien (Mais, Raps…) |
| `DEFAULT_UNTERKATEGORIEN` | via `getUnterkategorienKey(kat)` | Unterkategorien je Kategorie |
| `DEFAULT_LAGERORTE` | `system.lagerorte` | Lagerorte (leer by default) |
| `DEFAULT_FRUCHTARTEN` | `system.fruchtarten` | Fruchtarten für Schlagkartei |
| `DEFAULT_EINHEITEN` | `system.einheiten` | Mengeneinheiten |

**`getUnterkategorienKey(kategorie)`**: Gibt `"system.saatgut_kulturen"` für Saatgut zurück (Rückwärtskompatibilität), sonst `"system.unterkategorien_<Kategorie>"`.

**`<datalist>` Muster** (freie Eingabe + Vorschläge):
```tsx
<input list="lagerorte-list" value={lagerort} onChange={...} />
<datalist id="lagerorte-list">
  {lagerorte.map(o => <option key={o} value={o} />)}
</datalist>
```

**`parseListSetting(settings, key, defaults)`**: Liest JSON-Array aus `Einstellung`-Key, fällt auf `defaults` zurück.

---

## Artikel-Verfügbarkeitsampel (Lager-Indikator)

Wird in Lieferung/Angebot-Formularen bei Artikelauswahl angezeigt:
```tsx
function lagerAmpel(artikel: {aktuellerBestand: number; mindestbestand: number; einheit: string} | undefined) {
  if (!artikel) return null;
  if (artikel.aktuellerBestand <= 0) return <span className="text-red-600 text-xs">● Kein Lager</span>;
  if (artikel.aktuellerBestand < artikel.mindestbestand) return <span className="text-amber-600 text-xs">● Gering ({artikel.aktuellerBestand} {artikel.einheit})</span>;
  return <span className="text-green-600 text-xs">● Auf Lager ({artikel.aktuellerBestand} {artikel.einheit})</span>;
}
```
Nutzt bereits geladene Artikel-Liste — keine zusätzlichen API-Calls.

## Artikel-Inhaltsstoffe

- **Modell:** `ArtikelInhaltsstoff` — 1:N pro Artikel (name, menge Float?, einheit String?)
- **Tab:** Eigener Tab "Inhaltsstoffe" auf der Artikel-Detailseite
- **KI-Button:** "🤖 KI-Suche" auf Artikel-Detail + Artikel-Neu Seite
  - Ruft `POST /api/ki/inhaltsstoffe` mit Artikelname + Kategorie
  - Nutzt `analyzeText()` aus `lib/ai.ts` mit Prompt `PROMPTS.inhaltsstoffe`
  - Ergebnis: Array von `{name, menge, einheit}` → wird ins Formular eingefügt
- **Suche:** Inhaltsstoffe durchsuchbar via:
  - Artikelliste: `GET /api/artikel?search=Schwefel` (Prisma `inhaltsstoffe.some.name.contains`)
  - Globale Suche (Cmd+K): FTS5 + Fallback `contains`
  - FTS5 `artikel_fts` hat Spalte `inhaltsstoffe` (group_concat der Namen)
  - Trigger auf `ArtikelInhaltsstoff` INSERT/DELETE halten FTS aktuell
- **Stammdaten:** BvG-Produkte in `lib/artikel-stammdaten.ts` haben strukturierte Inhaltsstoffe

## KI-Integration — zentraler Service, ausschließlich Mistral AI

Ein Provider, ein Service (`lib/ai.ts`). Kein OpenAI/Anthropic mehr — Texterkennung,
Dokument-OCR und Diktieren laufen alle über Mistral, konfigurierbar unter `/einstellungen/ki`.

- **Lib:** `lib/ai.ts` — zentraler Service, alle KI-Aufrufe laufen ausschließlich hierüber:
  - `getAiConfig(category)` — lädt Modell + Mistral-Key aus `Einstellung` je Kategorie
    (`language | ocr | transcription | tts`)
  - `analyzeDocument(base64, prompt, feature, config?)` — Bild/PDF-Erkennung: Schritt 1 OCR via
    `client.ocr.process()` (Modell `mistral-ocr-latest`, funktioniert für Bild UND PDF gleichermaßen
    über `image_url`/`document_url`-Chunks mit `data:`-URLs), Schritt 2 JSON-Strukturierung via
    Sprachmodell (`client.chat.complete()`)
  - `analyzeDocumentFile(file, prompt, feature, opts?)` — dünner Adapter für multipart-Uploads
  - `analyzeText(text, prompt, feature, config?)` — reine Text-Analyse (z.B. transkribierte Sprache)
  - `transcribeAudio(audio, feature, config?)` — Diktieren/Spracherkennung via Mistral Voxtral
    (`client.audio.transcriptions.complete()`, Modell `voxtral-mini-latest`)
  - `textToSpeech(text, config?, voiceId?)` — Sprachausgabe via `client.audio.speech.complete()`
  - `testConnection()`, `logError()`, `PROMPTS` (12 Feature-Prompts)
- **Modelle:** Sprachmodell `mistral-large-latest` (Standard, auch `mistral-medium-3`/`mistral-small-latest`/
  `open-mistral-nemo` wählbar), OCR fix `mistral-ocr-latest`, Transkription `voxtral-mini-latest`
- **DB-Keys:** `ki.mistral_key`, `ki.modell_language`, `ki.modell_transcription`, `ki.modell_tts`,
  `ki.tts_voice`, `ki.prompt.<feature>`
- **Prompt-Verwaltung:** Benutzerdefinierte Prompts in `ki.prompt.<feature>` (Einstellung), alle 12
  Features editierbar unter `/einstellungen/ki` (Akkordeon-Layout)
  - Leerer Wert → Standard-Prompt aus `PROMPTS` in `lib/ai.ts`
- **Kostentracking:** `KiNutzung`-Tabelle (provider immer `"mistral"`, modell, feature, tokens, kostenCent)
- **KI-Seiten:**
  - `/ki/wareneingang` — Lieferschein-Erkennung per Foto (OCR)
  - `/ki/lieferung` — Bestellungs-Erkennung (OCR)
  - `/ki/crm` — CRM-Notizen aus Bild (OCR) oder Sprache (Diktieren via Voxtral)
  - `/ki/sprache` — Sprachmemo → CRM-Notiz (Diktieren via Voxtral, ohne KI-Nachbearbeitung)
  - `/ki/erkennung` — universeller Dokument-Router (OCR + Klassifizierung)
- **Diktieren:** `components/AudioRecorder.tsx` nimmt Audio via `MediaRecorder`/`getUserMedia({audio:true})`
  auf und sendet es an `POST /api/ki/transcribe` (multipart, Felder `audio` + `feature`), das
  `transcribeAudio()` aufruft. Ersetzt die frühere rein client-seitige Browser-`SpeechRecognition`
  (browserabhängig, ohne KI-Beteiligung).
- **Weitere KI-Endpunkte:**
  - `POST /api/ki/beleg` — Beleg-OCR (Ausgaben-Erkennung)
  - `POST /api/ki/transcribe` — Audio-Transkription (Diktieren) via Voxtral
  - `GET /api/ki/churn?kundeId=` — Churn-Risiko-Score (kein KI-Aufruf, reiner Algorithmus)
  - `POST /api/ki/preis-empfehlung` — KI-Preisempfehlung (intern, kein KI-Aufruf, reine Statistik)

## Fehler-Reporting (Sentry/GlitchTip, `lib/sentry.ts`)

**Regel: Jeder abgefangene Fehler wird an Sentry gemeldet — ohne Filter, ohne Ausnahme.**

- `onRequestError` (`instrumentation.ts`) erfasst nur *unbehandelte* Exceptions. Sobald eine
  Route/Funktion einen eigenen `try/catch` hat (Standardfall laut Checkliste), muss der
  `catch`-Block selbst `Sentry.captureException(err)` aufrufen — sonst verschwindet der Fehler
  spurlos in `console.error`.
- **Jeder neue `try/catch`-Block** (API-Route, `lib/*.ts`, Hintergrund-Job) bekommt
  `Sentry.captureException(err)` als erste Anweisung im `catch`. Import: `import { Sentry } from "@/lib/sentry";`.
- **Kein Filtern nach "wichtig genug" oder "zu erwarten".** Auch vermeintlich harmlose Fallbacks
  (z.B. Encoding-Fallback UTF-8→Latin1, KI-Retry, Cache-Miss) werden gemeldet. Mehr Rauschen in
  GlitchTip ist ausdrücklich erwünscht — lieber zu viele Events als einen unsichtbaren Fehler.
  Es werden keine Schweregrad-Filter, Sampling-Ausnahmen oder "non-critical, skip" Sonderfälle
  für neue Catches eingebaut.
- Einzige zulässige Ausnahme: Kontrollfluss, der explizit **kein Fehler** ist (z.B. abgelehnte
  Session/JWT-Verifikation in `middleware.ts` bei fehlendem/abgelaufenem Login — das ist normales
  Nutzerverhalten, kein Anwendungsfehler).
- Bestehende Infrastruktur: `sentry.client.config.ts` / `sentry.server.config.ts` /
  `sentry.edge.config.ts` (Init + DSN), `app/error.tsx` + `app/global-error.tsx` (React-Error-
  Boundaries, melden bereits automatisch), `components/SentryUserContext.tsx` (Sentry-User-Kontext
  aus Session).

## Authentifizierung (`lib/auth.ts`)

- **JWT-Sessions** via `jose` + `bcryptjs` — Cookie `kundefutter_session` (7 Tage)
- **Env-Var:** `SESSION_SECRET` (mind. 32 Zeichen) — Dev-Fallback wird geloggt
- **Exports:** `getSessionSecret()`, `createSession()`, `validateSession()`, `SessionPayload`
- **Login-Seite:** `/login/page.tsx` — POST zu `/api/auth/login`
- **Middleware:** Prüft Cookie auf geschützten Routen; `/login` und `/qr/[id]` sind öffentlich
- **Rollen:** Gespeichert im JWT-Payload; `rolle: "admin" | "benutzer"`

## Neue Lib-Module

| Datei | Zweck |
|-------|-------|
| `lib/auth.ts` | JWT-Session (jose + bcryptjs), Login/Logout, Session-Validierung |
| `lib/audit.ts` | `auditLog()` + `auditChanges()` — schreibt in `AuditLog`-Tabelle |
| `lib/bankimport.ts` | Parser für CSV-Kontoauszüge (MT940-ähnlich, deutsche Formate) |
| `lib/email.ts` | E-Mail-Versand via SMTP (nodemailer) oder Resend, `loadEmailConfig()` |
| `lib/email-templates.ts` | HTML-E-Mail-Templates (Rechnung, Mahnung, Angebot) |
| `lib/firma.ts` | `loadFirmaDaten()` — lädt Firmen-Einstellungen aus DB (Interface `FirmaDaten`) |
| `lib/girocode.ts` | EPC-QR-Code / GiroCode Generator (SEPA-Überweisungs-QR auf Rechnungen) |
| `lib/nextcloud.ts` | Nextcloud-Dokumentenabgleich via WebDAV (Ordnerstruktur, Upload, Verbindungstest) |
| `lib/nextcloud-backfill.ts` | Einmaliger Backfill-Job: überträgt Altbestand nach Nextcloud (batched, idempotent) |
| `lib/matif.ts` | MATIF/Euronext Futures via Yahoo Finance (Crumb-Auth, Symbols EBM/ERO/EMA) |
| `lib/overpass.ts` | OpenStreetMap Overpass API — Abfrage von Landwirtschaftsflächen |
| `lib/upload.ts` | `getUploadBase()` — Upload-Verzeichnis (Docker: `/data/uploads`, Dev: `./uploads`) |
| `lib/weather.ts` | Open-Meteo Wetter-API — 7-Tage-Forecast mit WMO-Codes als Emojis |
| `lib/zugferd-xml.ts` | Factur-X / ZUGFeRD BASIC-WL XML-Generator (kein externe Dep.) |
| `lib/duengebedarf.ts` | DüV Anlage 4 Tabellenwerte (N/P/K/Mg) + Berechnung mit Vorfrucht-/Nmin-/Zwischenfrucht-Abzug + automatische Versorgungsklassen aus Bodenprobe (VDLUFA-Grenzwerte) |
| `lib/vvvo.ts` | VVVO/HIT-Betriebsnummer Format-Validierung (12-stellig, Bundesland-Map 01–16) |
| `lib/futterwerte.ts` | Futterwerttabelle (~45 Futtermittel, LfL-/DLG-orientiert, Werte je kg TM: ME/NEL, XP/nXP/DP, XF/aNDFom, Lysin/Methionin, Ca/P/Mg/Na) |
| `lib/tierbedarf.ts` | Ernährungs-Zielwerte je Tierart + Nutzungsart (Rind/Schwein/Geflügel/Pferd/Schaf/Ziege); `berechneTierbedarf()` + `NUTZUNGSARTEN` |
| `lib/rationsberechnung.ts` | Reiner Rationsrechenkern: Aufnahme vs. Bedarf → Bilanz, Ca:P-Verhältnis, limitierende Aminosäuren, Magnesium, RNB (Wiederkäuer), simple/detail-Modus mit GF/AF/LF-Stufen |
| `lib/ki-modelle.ts` | Zentraler KI-Modell-Katalog (einzige Quelle der Wahrheit): auswählbare Mistral-Modelle + Standardwert je Kategorie (language/transcription), von `lib/ai.ts` (Fallback/Validierung) und `/einstellungen/ki` (Dropdown) genutzt |

## Wettbewerber-Notizen

Werden als `KundeNotiz` mit `thema: "Wettbewerber"` gespeichert.
- API: bestehende `/api/kunden/[id]/notizen` (kein Schema-Change nötig)
- Anzeige im StammdatenTab unter "Wettbewerber-Info"

## Rationsberechnung (Futterration)

Aufbau angelehnt an die LfL-Rationsrechner (Pferd, Milchvieh, wachsende Rinder),
erweitert auf Schwein, Geflügel, Schaf, Ziege.

- **Tierarten** (`lib/tierbedarf.ts` `NUTZUNGSARTEN`): Rind, Schwein, Geflugel, Pferd, Schaf, Ziege —
  je Tierart mehrere Nutzungsarten (z.B. Milchkuh laktierend/trockenstehend, Zuchtsau tragend/laktierend,
  Mastschwein Anfangs-/Endmast, Pferd Warmblut/Vollblut/Pony + Arbeitsstufen).
- **Modell:** Eine Ration ist eine Liste von Futterpositionen. Je Position: Frischmasse-kg +
  Nähr-/Mineralstoffwerte je kg TM. Rechenkern (`lib/rationsberechnung.ts`): TM-kg = FM × TM-Gehalt/1000,
  Nährstoff-Beitrag = TM-kg × Wert je kg TM; Summe → Vergleich mit `berechneTierbedarf()` → Bilanz.
- **Qualitätsindikatoren:** Ca:P-Verhältnis (tierartspezifischer Sollbereich), limitierende Aminosäuren
  (Lysin, Methionin — v.a. Schwein/Geflügel), Magnesium-Bilanz, RNB für Wiederkäuer ((XP−nXP)/6,25),
  Rohfaser-/aNDFom-Anteil der TM.
- **3 Futterwert-Quellen** (Auflösung in `/api/rationsberechnung` POST):
  `standard` = `lib/futterwerte.ts` + Custom aus `Einstellung[futterwerte.custom]`,
  `artikel` = `Artikel.inhaltsstoffe` (toleranter Namens-Alias → NaehrstoffWerte, Einheiten-Normalisierung),
  `manuell` = Werte direkt aus dem Formular.
- **Modus:** `simple` (eine Ration → Bilanz) und `detail` (zusätzlich Stufen-Zwischensummen
  Grundfutter/Ausgleichsfutter/Leistungsfutter über `position.stufe` GF/AF/LF).
- **Speichern:** `Rationsberechnung` mit vollständigem JSON-Snapshot in `parameter`; `kundeId` und
  `kundeTierId` optional → frei rechenbar oder an hinterlegtes `KundeTier` gebunden.
- **XLS-Export:** `/api/rationsberechnung/export` (Sheets Ration/Bilanz/Rechenweg) via `xlsx`-Paket.
- **Hinweiswert-Charakter:** Bedarfswerte sind GfE-/LfL-orientierte Orientierungswerte — wie bei
  `duengebedarf` werden Hinweise/Disclaimer mitgeführt.

## Mobile-Responsive-Muster

- `hidden sm:table-cell` — auf Mobile ausblenden (≥640px zeigen)
- `hidden md:table-cell` — ab Tablet (≥768px)
- `hidden lg:table-cell` — ab Desktop (≥1024px)
- Mobile Unterzeile: `<div className="sm:hidden text-xs text-gray-500">{info}</div>` in erster `<td>`
- Filter-Bar: immer `flex flex-wrap gap-3`
- Suchfelder: `w-full sm:w-72`
- Buttons in Formularen: `w-full sm:w-auto`

## Datenquellen

### Eurostat (Marktpreise)
- **Input-Preisindex:** `apri_pi15_inq` — Codes 201000/203xxx/206xxx
- **Output-Preisindex:** `apri_pi15_outq` — Codes C0000/C1110…/D0000/D1100…
- Lib: `lib/eurostat.ts` — `fetchEurostatQuarterly()`, `fetchEurostatOutput()`, `PRODUKT_BAUM`
- Cache in `MarktpreisCache`, 7-Tage-Gültigkeit

### AFIG — agrarzahlungen.de
- Keine API, nur CSV-Download (impdata2024.csv, ~250MB)
- Import via `/api/agrarantraege/import` (multipart | url | serverpath)
- Streaming via Node.js `readline` — kein RAM-Overflow
- **Kritisch: `Readable.from([text])`**, NICHT `Readable.from(text.split("\n"))`
- Streaming-Insert: max. 200 Einträge gleichzeitig
- AFIG CSV nutzt `.` als Dezimaltrennzeichen

### Geocoding
- Nominatim (OpenStreetMap) für Adressen
- OSRM für Routing in Tourenplanung

---

## PWA

- Manifest: `app/manifest.ts`
- Service Worker: `public/sw.js` (cache-first)
- Icons: `public/icons/icon-192x192.png`, `icon-512x512.png`
- Registration: `<ServiceWorkerRegistration />` in `app/layout.tsx`

---

## Deployment

- Docker Image: `merlin2539/kundefutter:latest` (Docker Hub)
- CI: `.github/workflows/docker.yml` — baut auf Push zu `main` und `claude/**`
- Watchtower: zieht automatisch neue Images und startet Container neu
- Entrypoint: `./docker-entrypoint.sh` → `prisma migrate deploy` → `node server.js`
- Daten-Volume: `kundefutter_data:/data` (SQLite-Datei)

---

## Entwicklungs-Checkliste

Vor jedem Code-Schreiben:
1. Lese `node_modules/next/dist/docs/01-app/` (Route Handlers, Server Components etc.)
2. Lese die betroffenen Dateien vor dem Bearbeiten
3. `await ctx.params` verwenden (nicht direkt destructuren)
4. Keine Modals für Formulare — eigene Seite anlegen
5. `npx prisma generate` nach Schema-Änderungen
6. `npx prisma migrate dev --name beschreibung` für neue Migrationen
7. Responsive: `hidden sm:table-cell` für nicht-essentielle Tabellenspalten
8. Sicherheit: Input validieren an API-Grenzen, keine Stack Traces exponieren
9. Immer `take:` Limit setzen bei `findMany` ohne explizite Filterung
10. `useSearchParams()` immer in eigener Komponente + `<Suspense>` im default export
11. API-Validierung: Enums whitelisten, numerische IDs mit `parseInt(..., 10)` + `isNaN`-Check
12. try/catch um alle prisma-Calls in API-Routes; P2025 → 404 zurückgeben
13. **isDev-Guard**: `const isDev = process.env.NODE_ENV === "development"` vor jedem `err.message` in API-Response
14. **artikelSafeSelect Import**: immer `import { artikelSafeSelect, liefposArtikelSelect } from "@/lib/artikel-select"` wenn diese verwendet werden
15. **Frontend fetch**: Nach `fetch()` immer `if (!res.ok) { ... return; }` vor `.json()` — verhindert `s.map is not a function`
16. **Array-Guard**: `Array.isArray(data) ? data : []` als Fallback bei allen API-Responses die Arrays erwarten
17. **Auswahllisten**: Einheiten, Kategorien etc. kommen aus `lib/auswahllisten.ts` + DB (`system.*`); nie lokal duplizieren
18. **POST-Whitelist**: Bei `prisma.X.create({ data: body })` immer explizite Feldliste statt `data: body` (Mass-Assignment-Schutz)
19. **sessionStorage für Filter**: `useSearchParams` + Suspense vermeiden → Filter-Zustand in `sessionStorage` persistieren; beim Remount (Back-Navigation) wiederherstellen
20. **Checkbox-Toggle-Bug**: `<td onClick>` NIEMALS `toggleSelect` aufrufen wenn das `<input type="checkbox">` denselben Handler im `onChange` hat — doppelter Toggle = Netto-Null
21. **Import-Spalten testen**: Immer Export-Spaltenname gegen `ARTIKEL_ALIAS` in `lib/import-utils.ts` prüfen; bei Mismatch wird der gesamte Block (inkl. EK/Lieferant) übersprungen
