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
LieferantKontakt    — 1:N weitere Ansprechpartner je Lieferant (typ telefon/mobil/email/fax, label z.B.
                      "Verkauf"/"Buchhaltung") — analog KundeKontakt, aber ohne rechnungsEmail/lieferscheinEmail-
                      Rollen; erscheinen als Auswahl im "An"-Dropdown beim E-Mail-Versand einer Bestellung
KundeNotiz          — 1:N Notizen mit thema (Wichtig/Info/Offener Punkt/Wettbewerber…)
KundeAktivitaet     — CRM-Aktivitäten (typ, betreff, inhalt, datum, faelligAm, erledigt)
Lieferant           — Lieferantenstamm
Artikel             — Lagerartikel mit Preis, Mindestbestand
ArtikelInhaltsstoff — 1:N Inhaltsstoffe je Artikel (name, menge Float?, einheit String?)
ArtikelDokument     — Dateianlagen an Artikel
ArtikelLieferant    — Einkaufspreise je Lieferant
ArtikelLieferantJahrespreis — expliziter Einkaufspreis je Kalenderjahr und Lieferant; fehlt ein
                      Jahr, wird auf das nächstgelegene bekannte Jahr interpoliert (lib/jahrespreis.ts)
ArtikelLieferantPreis — datumsgenauer Einkaufspreis-Verlauf je Lieferant (Preise ändern sich
                      oft innerhalb der Saison, nicht nur zwischen Jahren); genau ein Eintrag
                      wird per aktiv-Flag manuell als aktuell gültig markiert, keine
                      automatische Auflösung/Interpolation wie bei Jahrespreisen (lib/einkaufspreisverlauf.ts)
ArtikelJahrespreis  — expliziter Verkaufspreis (Artikel.standardpreis) je Kalenderjahr, gleiches
                      Interpolationsprinzip wie ArtikelLieferantJahrespreis
ArtikelPreisHistorie— Preishistorie (jede Änderung an Artikel.standardpreis wird automatisch versioniert)
KundeArtikelPreis   — Sonderpreise je Kunde+Artikel
KundeArtikelPreisJahr — expliziter Kunden-Sonderpreis je Kalenderjahr, gleiches Interpolationsprinzip
KundeBedarf         — Bedarfspläne (aktiv Boolean)
Lieferung           — Lieferscheine (status: geplant/geliefert/storniert)
Lieferposition      — Positionen einer Lieferung (chargeNr String?)
Wareneingang        — Wareneingänge
WareineingangPosition
Lagerbewegung       — alle Lagerbuchungen
Inventur            — Inventur-Kopf (datum, status: offen/abgeschlossen, bezeichnung)
InventurPosition    — Positionen einer Inventur (artikel, gezaehlt, erwartet)
Mengenrabatt        — Mengenstaffeln (absoluter Preis ab einer Menge, `preis`; `rabattProzent` nur Legacy für
                      vor der Umstellung angelegte prozentbasierte Staffeln, siehe lib/utils.ts)
Sammelrechnung      — Rechnungen mit zahlungsstatus
Rechnungsuebersicht — Reines Übersichtsdokument über bereits ausgestellte Einzelrechnungen eines Kunden (Titel, Notiz);
                      vergibt KEINE neue Rechnungsnummer, im Unterschied zu Sammelrechnung nicht-exklusiv (M:N)
RechnungsuebersichtEintrag — M:N-Verknüpfung Rechnungsuebersicht↔Lieferung (eine Rechnung darf in mehreren Übersichten stehen)
Gutschrift          — Gutschriften (nummer, status: OFFEN/VERBUCHT/STORNIERT/ERSTATTET — ERSTATTET = Bankabgleich-Doppelzahlung, per Überweisung zurückgezahlt statt automatisch verrechnet, wird wie STORNIERT NICHT von injiziereOffeneGutschriften() erfasst; positionen, verbuchtBeiLieferungId — Rechnung, in die eine offene Gutschrift automatisch eingerechnet wurde, analog KundeForderung.erledigtBeiLieferungId)
GutschriftPosition
Ausgabe             — Ausgabenbuch (datum, betrag, kategorie, belegpfad)
Kontoumsatz         — Bankabgleich-Buchungen (buchungsdatum, betrag, verwendungszweck, gutschriftId? — gesetzt bei
                      einer über den Doppelzahlungs-Flow erzeugten Gutschrift, weiche ID ohne @relation analog
                      lieferungId/sammelrechnungId, siehe lib/gutschrift.ts)
KontoumsatzWeitereZuordnung — weitere Rechnungen (Lieferung/Sammelrechnung), die mit DERSELBEN Zahlung
                      wie die Haupt-Zuordnung eines Kontoumsatzes beglichen wurden (Kunde begleicht mehrere
                      offene Rechnungen in einer Sammelüberweisung); die Haupt-Rechnung bleibt weiterhin über
                      Kontoumsatz.lieferungId/sammelrechnungId zugeordnet, keine feste Prisma-Relation zu
                      Lieferung/Sammelrechnung (analog zu Kontoumsatz.lieferungId/sammelrechnungId selbst)
Bestellliste        — Bestellpositionen (artikel, menge, lieferant, status); kundeId/lieferungId/angebotId
                      optional (gesetzt bei automatischer Entstehung durchs Annehmen eines Angebots, null
                      beim manuellen/diktierten Erfassen über "+ Position hinzufügen"); bestellungId? — gesetzt,
                      sobald die Position zu einer formellen Bestellung gebündelt wurde (siehe Bestellung unten)
Besuchstermin       — Besuchsplanung (datum, kundeId, status, notiz)
Benutzer            — Multi-User (benutzername, passwortHash, rolle, aktiv, mobil? — erscheint als
                      "Ihr Ansprechpartner" auf Mahnungs-PDFs, die dieser Benutzer erzeugt)
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
Bestellung          — Lieferantenbestellungen (nummer, datum, status OFFEN/BESTAETIGT/TEILGELIEFERT/ABGESCHLOSSEN/STORNIERT, lieferantId, versendetAm?/versendetAn? — Nachweis, dass sie per E-Mail rausgeschickt wurde)
BestellungPosition  — Positionen je Bestellung (artikel, menge, mengeGeliefert, preis)
AngebotVorlage      — Wiederverwendbare Angebotsvorlagen (name, positionen)
AngebotVorlagePosition
Anlieferung         — Erzeugerbis-/Abrechnung (erzeuger, datum, artikel, menge, preis)
ChargenZertifikat   — Zertifikate je Charge (chargeNr, typ, datei)
Benachrichtigung    — System-Alerts (typ, text, gelesen, faelligAm)
KundePortalZugang   — Login-Daten fürs Kunden-Portal (username, passwortHash)
Teilzahlung         — Teilzahlungen zu Lieferungen (betrag, datum, notiz, kontoumsatzId? — gesetzt wenn aus
                      dem Bankabgleich erzeugt, z.B. Kunde zahlt eine Rechnung in zwei Überweisungen;
                      weiche ID ohne @relation, wird beim Aufheben der Zuordnung automatisch entfernt)
KundeForderung      — Alte Forderung eines Kunden (Restdifferenz z.B. aus Unterzahlung im Bankabgleich); auf Kunde statt Lieferung verankert, damit sie über die Ursprungslieferung hinaus bestehen bleibt; wird automatisch als Position ("Alte Forderung", Artikelnr. ALTE-FORDERUNG, mwstSatz 0) in die nächste Rechnung dieses Kunden übernommen und dabei als erledigt markiert (injiziereAlteForderungen() in lib/lieferung.ts, aufgerufen bei rechnung_erstellen)
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
│       GRUPPEN-TABS: Vertrieb (Bedarfe, Sonderpreise, Statistik, Vorgangskette, Reklamationen, Forderungen)
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
│   ├── verschmelzen/page.tsx   Zwei Artikel zusammenführen (analog /kunden/verschmelzen)
│   └── [id]/page.tsx           Artikeldetail (Inhaltsstoffe-Tab, KI-Suche, Lieferanten-Tab, Mengenstaffeln-Tab)
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
│       ├── rechnung/page.tsx      HTML-Druckseite
│       └── auftragsbestaetigung/page.tsx  HTML-Druckseite (nur solange status "geplant" — Preise/MwSt, ohne Signatur/Chargen)
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
├── rechnungsuebersicht/        Übersichtsdokument über bereits ausgestellte Rechnungen (kein neues Rechnungsnr.)
│   ├── page.tsx                Liste
│   ├── neu/page.tsx            Kunde wählen + dessen bestehende Rechnungen auswählen
│   └── [id]/page.tsx           Detail (Tabelle + Gesamtsumme, PDF-Download, Löschen)
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
├── bestellliste/page.tsx       Bestellliste (offene Bestellpositionen je Lieferant; manuelles/diktiert
│                               vorbereitetes Erfassen, Lieferant-Umschlüsseln, Bündeln zu Bestellung)
├── bestellungen/               Lieferantenbestellungen (OFFEN→BESTAETIGT→TEILGELIEFERT→ABGESCHLOSSEN;
│                               E-Mail-Versand mit Nachweis, Umschlüsseln auf anderen Lieferanten)
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
│   └── datev-vorschau/page.tsx Buchungsvorschau für den DATEV-Export (Tabelle Datum/Herkunft/Beleg/
│                               Konto/Gegenkonto/Betrag/S-H/MwSt + Saldo je Konto), bevor die CSV
│                               heruntergeladen wird; Nav unter Finanzen → Konditionen
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
│   ├── loeschzentrum/page.tsx  Duplikate, Kategorien bereinigen, Datenbereinigung, FTS-Rebuild, Bankabgleich zurücksetzen
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
/api/kunden/[id]/vcard          GET — Stammdaten (Name, Firma, Telefon(e), E-Mail(s), Adresse) als vCard
                                 (.vcf) zum Download; iOS/Android bieten beim Öffnen automatisch "Zu
                                 Kontakten hinzufügen" an. Genutzt vom "📇 Kontakt speichern"-Button auf
                                 /kunden/[id]
/api/kunden/[id]/kontakte       GET, POST, DELETE
/api/kunden/[id]/notizen        GET, POST, DELETE?notizId= (thema: Wichtig/Info/Wettbewerber/…)
/api/kunden/[id]/preise         GET, POST, DELETE (Sonderpreise, ehemals /sonderpreise)
/api/kunden/[id]/bedarfe        GET, POST, DELETE
/api/kunden/[id]/forderungen    GET(?offen=true), POST(betrag,grund,quelleLieferungId?), DELETE?forderungId= (nur solange nicht erledigt)
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
/api/artikel/[id]/lieferanten/[lieferantId]/jahrespreise    GET, POST(jahr,einkaufspreis,notiz?), DELETE(jahr)
/api/artikel/[id]/lieferanten/[lieferantId]/einkaufspreise  GET, POST(datum,einkaufspreis,notiz?,aktiv?) — datumsgenauer Preisverlauf
/api/artikel/[id]/lieferanten/[lieferantId]/einkaufspreise/[preisId]  PATCH({aktion:"aktivieren"}|{datum?,einkaufspreis?,notiz?}), DELETE
/api/artikel/[id]/jahrespreise  GET, POST(jahr,preis,notiz?), DELETE(jahr) — Jahresgültigkeiten Verkaufspreis
/api/artikel/[id]/preishistorie GET
/api/artikel/[id]/dokumente     GET, POST (Dateianlage)
/api/artikel/[id]/dokumente/[docId]  DELETE
/api/artikel/import             POST (multipart CSV/Excel)
/api/artikel/dedup              POST — Duplikat-Bereinigung
/api/artikel/kategorien-bereinigen  GET — Vorschau (Artikel mit ungültiger Kategorie + Korrektur-Vorschlag),
                                 POST{confirm:true} — korrigiert kategorie/unterkategorie (nicht chargePflicht);
                                 genutzt von der "Artikel-Kategorien bereinigen"-Kachel in /einstellungen/loeschzentrum
/api/artikel/merge               GET(?zielId=&quelleId=) — Merge-Vorschau (Stammdaten, Anzahl verknüpfter
                                 Datensätze je Relation, Konflikte bei unique-constraint-Relationen wie
                                 ArtikelLieferant/ArtikelJahrespreis/KundeArtikelPreis/KundeBedarf/KampagneArtikel),
                                 POST{zielId,quelleId,felder} — führt Quell- in Ziel-Artikel zusammen (alle
                                 ~20 Relationen umgehängt, Lagerbestand immer summiert, chargePflicht anhand der
                                 finalen Kategorie neu erzwungen) und löscht den Quell-Artikel; analog
                                 /api/kunden/merge, genutzt von /artikel/verschmelzen
/api/artikel/kategorien         GET — Kategorien + Unterkategorien aus DB;
                                 POST{aktion:"umbenennen",von,zu} — Top-Level-Kategorie umbenennen (aktualisiert
                                 Artikel + Mengenrabatt), genutzt von /einstellungen/artikelkategorien;
                                 POST{aktion:"unterkategorie_umbenennen",kategorie,von,zu} — Unterkategorie-Wert
                                 explizit zusammenführen (nur Artikel, Mengenrabatt kennt keine Unterkategorie),
                                 genutzt vom "Nicht registrierte Unterkategorien"-Bereich in /einstellungen/stammdaten
/api/artikel/unterkategorien-unregistriert  GET — je Kategorie die auf Artikeln verwendeten, aber nicht unter
                                 /einstellungen/stammdaten registrierten Unterkategorie-Werte samt Artikel-Anzahl
                                 (z.B. "Einzelkomponenten" statt "Einzelkomponente" aus einem ungeprüften Import)

-- Lieferanten --
/api/lieferanten                GET, POST
/api/lieferanten/[id]           GET(inkl. kontakte), PUT({...,kontakte?:[{typ,wert,label?,vorname?,nachname?}]} —
                                 volle Ersetzung wie bei Kunde-Kontakten: deleteMany+create), DELETE

-- Lieferungen --
/api/lieferungen                GET, POST
/api/lieferungen/[id]           GET, PUT, DELETE, PATCH(aktion: rechnung_erstellen | teilrechnung_erstellen(positionIds[]) — nur ausgewählte Positionen abrechnen, Rest bleibt in dieser offenen Lieferung | rechnung_stornieren | rechnung_storno_aufheben | rechnung_postversand_markieren — manuell für auf Papier/per Post verschickte Rechnungen (kein Auto-Trigger wie beim E-Mail-Versand), setzt dieselbe Positions-Sperre (rechnungVersendetAm) wie der E-Mail-Versand, rechnungVersandKanal="post" nur für die Anzeige | …; PATCH{status:"geliefert"} für QR-Mobilerfassung)
/api/lieferungen/[id]/positionen         GET, POST
/api/lieferungen/[id]/positionen/[posId] PUT, DELETE
/api/lieferungen/[id]/restdifferenz      POST({gutschriftId?,modus?:"forderung"|"neue_rechnung"}) — verrechnet den
                                 nach Teilzahlungen noch offenen Betrag einer bereits gestellten Rechnung (z.B. Kunde
                                 hat eine Gutschrift falsch/zu viel abgezogen und zu wenig überwiesen): optional eine
                                 OFFENE Gutschrift des Kunden gegenbuchen (VERBUCHT, ohne neue Position — Rechnung
                                 steht bereits); ein danach verbleibender Restbetrag wird je nach `modus` entweder
                                 (Standard "forderung") als KundeForderung angelegt und automatisch in die nächste
                                 Rechnung dieses Kunden übernommen, oder (modus "neue_rechnung") als eigenständige
                                 neue Lieferung MIT sofort vergebener Rechnungsnummer und genau einer Position
                                 (Artikelnr. RESTDIFFERENZ, mwstSatz 0, Notiz = Rechenweg) angelegt — Antwort enthält
                                 dann `neueRechnung:{id,rechnungNr}` statt `forderung` (siehe
                                 verrechneOffeneRestdifferenz() in lib/lieferung.ts); 400 falls die gewählte
                                 Gutschrift den offenen Betrag übersteigt
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
/api/bestellliste               GET(?status,?lieferantId), POST({artikelId,menge,einheit?,lieferantId?,notiz?} — manuelles/diktiertes
                                 Erfassen unabhängig von einem Kundenangebot; ohne lieferantId automatischer
                                 Vorschlag via vorschlagLieferantFuerArtikel(), 422 wenn kein Lieferant zugeordnet)
/api/bestellliste/[id]          PATCH({status?,notiz?,lieferantId?} — lieferantId nur solange die Position noch
                                 nicht zu einer Bestellung gebündelt ist, sonst 409), DELETE
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
/api/rechnungsuebersicht        GET(?kundeId=), POST({kundeId,titel?,notiz?,lieferungIds[]}) — nur Lieferungen mit gesetzter rechnungNr
/api/rechnungsuebersicht/[id]   GET, DELETE
/api/gutschriften               GET, POST
/api/gutschriften/[id]          GET, PUT({status?,notiz?,grund?,datum?} nur solange status OFFEN ist |
                                 {aktion:"wieder_oeffnen"} — setzt eine VERBUCHTE Gutschrift zurück auf OFFEN,
                                 entfernt dabei eine ggf. vorhandene Ausgleichsposition aus der verrechneten
                                 Rechnung, ohne den Datensatz zu löschen), DELETE
/api/ausgaben                   GET(?kategorie,?von,?bis), POST
/api/ausgaben/[id]              GET, PUT, DELETE
/api/ausgaben/[id]/beleg        POST (Beleg-Upload)
/api/bankabgleich               GET(?status), POST (Kontoumsatz speichern)
/api/bankabgleich/[id]          PUT({...,alsBezahltMarkieren?:boolean=true,differenzAktion?:"gutschrift"|"forderung"} — bei Zuordnung zu lieferungId/sammelrechnungId erfasst serverseitig berechnete Differenz Bankbetrag↔Rechnungsbrutto als Gutschrift/KundeForderung, atomar in derselben Transaktion; alsBezahltMarkieren:false legt stattdessen eine Teilzahlung über den Bankbetrag an — Rechnung bleibt offen und weiterhin als Kandidat für eine zweite Teilzahlung auffindbar, idempotent bei wiederholtem PUT), DELETE (hebt auch alle weitereZuordnungen sowie eine ggf. angelegte Teilzahlung dieses Kontoumsatzes auf)
/api/bankabgleich/[id]/weitere  POST({lieferungId?|sammelrechnungId?}) — weitere Rechnung DESSELBEN Kunden zu einem bereits zugeordneten Kontoumsatz hinzufügen (Kunde begleicht mehrere offene Rechnungen in einer Überweisung); markiert sie ebenfalls als bezahlt; erfordert bestehende Haupt-Zuordnung, lehnt Rechnungen anderer Kunden ab. DELETE?zuordnungId= — einzelne weitere Zuordnung entfernen, macht deren Bezahlt-Markierung rückgängig
/api/bankabgleich/vorschlaege   GET(?umsatzId,?q) — Zuordnungsvorschläge (Top 8, Betragsabweichungen werden NICHT verworfen sondern niedriger gerankt); ?q= durchsucht stattdessen alle offenen Kandidaten (manuelle Zuordnung zu einer anderen Rechnung)
/api/bankabgleich/reset         GET — Vorschau (Anzahl betroffener Datensätze), POST{confirm:true} — setzt Bankabgleich für Verkaufsrechnungen komplett zurück (Lieferung/Sammelrechnung.bezahltAm, Kontoumsatz-Zuordnungen, dabei verbuchte Gutschriften/Forderungen); erfordert P.EINSTELLUNGEN_BEARBEITEN; betrifft NICHT Ausgaben/EingangsRechnungen; genutzt vom "Bankabgleich zurücksetzen"-Kachel in /einstellungen/loeschzentrum
/api/bankabgleich/doppelzahlung-suche  GET(?q=) — sucht Lieferungen/Sammelrechnungen für den Doppelzahlungs-Flow, bewusst OHNE bezahltAm-Filter (anders als jede andere Kandidatensuche) — findet also auch bereits bezahlte Rechnungen; liefert je Treffer zielTyp/zielId/kundeId/kundeName/rechnungNr/betrag/bezahlt
/api/bankabgleich/[id]/doppelzahlung   POST({kundeId,zielTyp:"lieferung"|"sammelrechnung",zielId,modus:"erstatten"|"verrechnen"}) — wandelt einen Kontoumsatz (Doppelzahlung einer bereits bezahlten Rechnung) in eine Gutschrift des Kunden um (grund "Doppelzahlung"); modus "erstatten" → status ERSTATTET (wird NICHT automatisch verrechnet, für per Überweisung zurückgezahlte Beträge), "verrechnen" → status OFFEN (wird wie üblich in die nächste Rechnung eingerechnet); erfordert unzugeordneten Kontoumsatz mit betrag>0 sowie zielId gehört zu kundeId; Rückgängigmachen über das normale DELETE /api/bankabgleich/[id] (löscht die Gutschrift inkl. Nebenwirkungen mit)
/api/mahnwesen                  GET — alle überfälligen Rechnungen (kein Query-Filter server-seitig; Suche nach Kunde/Rechnungsnr. sowie Mahnstufen-Filter laufen clientseitig in app/mahnwesen/page.tsx); je Eintrag `mahnstufe` (effektiv, ggf. manueller Override), `automatischeMahnstufe` (aus Tagen überfällig berechnet) und `mahnstufeManuell` (Boolean)
/api/mengenrabatte              GET(?artikelId=), POST, DELETE

-- Rechnungen (Druck/Export) --
/api/exporte/rechnung           GET?lieferungId= — Einzel-Rechnungs-PDF
/api/exporte/rechnung/mail      POST — Rechnung per E-Mail versenden
/api/exporte/gutschrift         GET?gutschriftId= — Gutschrift-PDF (spiegelt zusätzlich nach Nextcloud Kunden- + Buchhaltungs-Ordner)
/api/exporte/angebot            GET?angebotId= — Angebot-PDF (spiegelt nach Nextcloud Kunden-Ordner "Angebote")
/api/exporte/angebot/mail       POST{angebotId,empfaenger?,cc?} — Angebot per E-Mail versenden
/api/exporte/bestellung         GET?bestellungId= — Lieferantenbestellung-PDF (generiereBestellungPdf() in
                                 lib/pdfGenerator.ts); bei Streckengeschäft (alle Bestellliste-Einträge dieser
                                 Bestellung eindeutig demselben Kunden zugeordnet) zusätzlich hervorgehobener
                                 Versandhinweis mit Endkunden-Adresse ("Bitte Ware direkt an unseren Kunden
                                 versenden")
/api/exporte/mahnung            GET?lieferungId=&mahnstufe=1|2|3 — Mahnung/Zahlungserinnerung als PDF (DIN-5008-Geschäftsbrief, "Ihr Ansprechpartner"-Feld = aktuell angemeldeter Benutzer statt Firmenzentrale; spiegelt nach Nextcloud Kunden-Ordner "Mahnungen")
/api/exporte/mahnung/mail       POST — Mahnung per E-Mail versenden
/api/exporte/sammelrechnung     GET?sammelrechnungId=
/api/exporte/rechnungsuebersicht GET?id= — Übersichtstabelle (Rechnungsnr./Datum/Status/Nettobetrag) + Gesamtsumme
/api/exporte/lieferschein       GET?lieferungId=
/api/exporte/lieferschein/mail  POST — Lieferschein per E-Mail versenden
/api/exporte/auftragsbestaetigung       GET?lieferungId= — Auftragsbestätigung-PDF (nur sinnvoll solange status "geplant"; MIT Preisen/MwSt, OHNE Signatur/Chargen)
/api/exporte/auftragsbestaetigung/mail  POST — Auftragsbestätigung per E-Mail versenden
/api/exporte/kundenmappe        GET?kundeId=
/api/exporte/tour               GET(?tourname=)
/api/exporte/datev              GET(?von,?bis) — DATEV-Export CSV
/api/exporte/datev/vorschau     GET(?von,?bis) — Buchungsvorschau als JSON (Datum/Herkunft/Beleg/Konto/
                                 Gegenkonto/Betrag/S-H/MwSt je Zeile + Saldo je Konto), nutzt dieselbe
                                 Kontierung wie der CSV-Export (`sammleDatevBuchungen()` in lib/datev.ts);
                                 zeigt VOR dem eigentlichen Download, was gebucht würde
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
/api/bestellungen               GET(?lieferantId,?status), POST (auto Nummer BES-YYYY-NNNN; entweder frei
                                 {lieferantId,positionen[]} oder gebündelt aus der Bestellliste
                                 {lieferantId,bestellpositionIds[]} — markiert die Quell-Bestellliste-Positionen
                                 dabei als "bestellt" und verknüpft sie per bestellungId)
/api/bestellungen/[id]          GET, PUT({aktion:"bestätigen"|"abschliessen"|"stornieren"}|{positionen[]}), DELETE
/api/bestellungen/[id]/mail     POST({empfaenger?,cc?}) — sendet die Bestellung per E-Mail an den Lieferanten
                                 (bestellungEmail()-Template in lib/email-templates.ts), setzt versendetAm/
                                 versendetAn als Nachweis; Versand muss im Frontend über EmailVersandModal
                                 bestätigt werden, kein automatischer Versand beim Bündeln
/api/bestellungen/[id]/umschluesseln  POST({positionId,lieferantId}) — verlegt eine bereits gebündelte Position
                                 auf einen anderen Lieferanten (z.B. weil der ursprüngliche Lieferant den Artikel
                                 nicht liefern kann); legt dafür immer eine neue Bestellung an (statt eine
                                 evtl. offene zusammenzuführen) und zieht einen verknüpften Bestellliste-Eintrag
                                 mit um
/api/lieferungen/[id]/streckenbestellung  POST — Streckengeschäft (Direktlieferung Lieferant→Kunde):
                                 erzeugt aus einer als Streckengeschäft markierten Lieferung (kundeId,
                                 istStreckengeschaeft, streckenLieferantId gesetzt) in einem Schritt eine formelle
                                 Bestellung beim hinterlegten Direktlieferanten — je Lieferposition eine
                                 Bestellposition (kundeId/lieferungId gesetzt, EK aus ArtikelLieferant für genau
                                 dieses Artikel/Lieferant-Paar, sonst 0) und direkt zu einer neuen Bestellung
                                 gebündelt (gleiche Transaktion/Nummernvergabe wie POST /api/bestellungen);
                                 409 mit {bestellungId} wenn für diese Lieferung schon eine Bestellung existiert
                                 (Schutz vor Doppel-Bestellung bei mehrfachem Klick). "→ Bestellung beim
                                 Lieferanten anlegen"-Button auf /lieferungen/[id] navigiert danach zu
                                 /bestellungen/[id]
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
/api/einstellungen/sentry-test  GET (DSN gesetzt?) / POST (echten Test-Event an GlitchTip senden, eventId zurückgeben)
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

### `components/MultiSelectDropdown.tsx`
Checkbox-Mehrfachauswahl im Dropdown (analoges Öffnen/Schließen-Verhalten wie `SearchableSelect`,
aber mehrere Werte statt einem). `values.length === 0` bedeutet "alle" — Interpretation liegt beim
Aufrufer (z.B. kein Filter). Optionen als `string[]` oder `{value,label,hint?}[]` (hint = grauer
Zusatztext, z.B. um nicht in den Stammdaten registrierte Werte zu markieren):
```tsx
<MultiSelectDropdown
  options={["A", "B"]}
  values={selected}
  onChange={setSelected}
  allLabel="Alle"
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
- Auftragsbestätigung: `/lieferungen/[id]/auftragsbestaetigung/page.tsx` (nur solange status "geplant"; MIT Preisen/MwSt-Aufschlüsselung, `GET`/`POST .../mail` analog Lieferschein, `generiereAuftragsbestaetigungPdf()`)
- Rechnung: `/lieferungen/[id]/rechnung/page.tsx` (MwSt gruppiert, IBAN/BIC)
- Angebots-Druck: `/angebote/[id]/druck/page.tsx`
- Tour-PDF: `GET /api/exporte/tour?tourname=X` (jsPDF)
- AFIG-PDF: `GET /api/agrarantraege/pdf?kundeId=X` (jsPDF)
- Bestellung (Lieferantenbestellung): `GET /api/exporte/bestellung?bestellungId=X` (jsPDF, `generiereBestellungPdf()`)

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
| System | /einstellungen/system | Version, DB, GlitchTip-Diagnose (DSN-Status + Server-/Browser-Test-Event) |
| Stammdaten | /einstellungen/stammdaten | Kategorien, Einheiten, Unterkategorien je Kategorie, Lagerorte, Fruchtarten, nicht registrierte Unterkategorien zusammenführen |
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
| Ordner-Migration (Schritt 0) schlägt bei einem großen Teil der Artikel-/Kundenordner dauerhaft mit "409 Ordner konnte nicht verschoben werden" fehl, obwohl der Zielordner laut PROPFIND gar nicht existiert | Bei externen Speicher-Backends (Windows-/exFAT-Freigaben) kann Nextclouds Datei-Cache (`oc_filecache`) kurzzeitig veraltet sein: `MOVE` prüft den echten Speicher und meldet einen Konflikt, den die anschließende PROPFIND-Prüfung (befragt nur den Cache) noch nicht sieht | `verschiebeOrdner()` in `lib/nextcloud.ts` versucht `MOVE` bei 409/412 bis zu 3× erneut; dazwischen erzwingt ein `PROPFIND (Depth 1)` auf den Elternordner einen Re-Scan des externen Mounts, dann kurze Backoff-Pause vor dem nächsten Versuch |
| Standard-Zahlungsziel (`firma.zahlungszielStandard`) wurde bei neu angelegten Lieferungen/Rechnungen nie gezogen | `Lieferung.create()` setzte `zahlungsziel` nirgends explizit → Prisma-Schema-`@default(30)` griff immer, unabhängig von der Einstellung (betraf manuelle Lieferungserfassung, Vorbestellung→Lieferung, Angebot→Sammelrechnung, wiederkehrende Lieferungen) | `ladeStandardZahlungsziel(tx)` in `lib/lieferung.ts` als zentrale Quelle; wird jetzt in `erstelleLieferungMitPreisberechnung()` sowie in `app/api/angebote/[id]/route.ts`, `app/api/vorbestellungen/[id]/route.ts` und `app/api/lieferungen/wiederkehrend/route.ts` beim `create` explizit gesetzt statt sich auf den Schema-Default zu verlassen |
| "Wer hat diesen Artikel bekommen?" öffnete überall (Lieferung/Vorbestellung/Angebot/Bestellliste/Kunde-Lieferhistorie) ein Modal-Popup (`ArtikelKundenModal`) statt einer echten Seite | Popup-Pattern verstößt gegen die "keine Modals für Formulare/Ansichten"-Regel dieses Projekts | `ArtikelKundenModal` entfernt; die 👥-Icons an Artikelpositionen sind jetzt `Link`s auf `/artikel/[id]?tab=kunden` — Artikel-Detailseite liest den Tab per `useSearchParams` (Suspense-Boundary), Tab-Klicks schreiben ihn per `router.push` zurück in die URL; `ArtikelKundenUebersicht` selbst (Tab-Inhalt) unverändert |
| `Buffer` an `new NextResponse(buffer, …)` bzw. `fetch(url, {body: buffer})` → `next build` bricht mit `Type 'Buffer<ArrayBufferLike>' is not assignable to type 'BodyInit'` (TS2345/TS2322) | Aktuelle `@types/node`-Version macht `Buffer` strukturell nicht mehr direkt kompatibel zu `BodyInit`; `tsc --noEmit` fängt das zwar auch ab, wird aber leicht übersehen weil `next build` es erst in der abschließenden TypeScript-Prüfung nach dem Webpack-Kompilieren meldet | Buffer explizit zu `Uint8Array` wandeln: `new NextResponse(new Uint8Array(pdfBuffer), {…})` bzw. `body: new Uint8Array(buffer)` — betroffen u.a. `app/api/exporte/gutschrift/route.ts`, `lib/nextcloud.ts` (`uploadDatei`/`davFetch`-PUT) |
| Sentry-Rollout brach den Docker-Build: "You're importing a module that depends on next/headers... but you are using it in the Pages Router" | `lib/appinfo.ts`/`lib/matif.ts` importierten `@/lib/sentry` (zieht `lib/auth.ts` → `next/headers` nach), wurden aber direkt von `"use client"`-Seiten importiert (`app/gebietsanalyse/page.tsx`, `app/marktpreise/page.tsx` u.a.) — reine `tsc --noEmit`-Prüfung findet das NICHT, nur der echte Webpack-Build (`npm run build`) | Beide auf `import * as Sentry from "@sentry/nextjs"` umgestellt (siehe "Bekannte client-sichere `lib/*.ts`-Module" oben); **Lehre:** vor jedem `@/lib/sentry`-Import in einem `lib/*.ts`-Modul mit `npm run build` (nicht nur `tsc --noEmit`) verifizieren, ob das Modul von Client-Code erreichbar ist — bereits vorhandene server-only Importe (z.B. `prisma`) im selben Modul sind dafür KEIN verlässliches Signal |
| Rechnung/Lieferschein auf iPhone ("Chrome" = WebKit): Fußzeile (`DokumentFooter`) fehlte komplett auf Seite 1 mehrseitiger Ausdrucke | `<tfoot>{display:table-footer-group}` wiederholt sich zwar in Chrome/Firefox auf jeder gedruckten Seite (CSS2.1), ist in WebKit/Safari aber seit Jahren nicht implementiert (WebKit-Bugs #34218, #17205) — dort erscheint der tfoot-Inhalt gar nicht zuverlässig. `position: fixed` als Alternative funktioniert in Safari beim Drucken ebenfalls nicht (Apple-Support bestätigt) | Fußzeile in `app/lieferungen/[id]/rechnung/page.tsx` und `app/lieferungen/[id]/lieferschein/page.tsx` ist kein `<tfoot>` mehr, sondern eine ganz normale letzte `<tbody>`-Zeile (`className="no-break"`) — sie druckt dadurch garantiert genau einmal, exakt am Ende des Inhalts, identisch in Chrome/Firefox/Safari. Kompromiss: keine Wiederholung auf JEDER Seite (dafür gibt es browserübergreifend keine zuverlässige Lösung); `<thead>` bleibt unverändert (Spaltenköpfe wiederholen sich weiterhin nur in Chrome/Firefox, nicht in Safari — bekannte, akzeptierte Einschränkung) |
| KI-Belegerkennung (`POST /api/ki/analyze`) crashte bei jeder Analyse mit `SyntaxError: Unexpected token '\`'` (Glitchtip AGRI-K), obwohl das Ergebnis am Ende trotzdem korrekt war | Mistral verpackt JSON-Antworten regelmäßig in einen Markdown-Codeblock (` ```json … ``` `), obwohl der Prompt reines JSON verlangt — `parseJsonFromText()`s erster `JSON.parse(text)`-Versuch scheiterte dadurch garantiert und meldete den (abgefangenen) Fehler trotzdem per `Sentry.captureException` | Neue Hilfsfunktion `stripMarkdownJsonFence()` in `lib/ai.ts` entfernt die Codeblock-Hülle **vor** dem ersten Parse-Versuch — greift für alle Aufrufer von `parseJsonFromText()` (einziger Choke-Point für KI-JSON-Parsing), die bestehenden Regex-Fallbacks bleiben unverändert |
| Teilrechnung (`aktion: teilrechnung_erstellen`): Gefahr einer doppelten Lagerbuchung, wenn die Ursprungslieferung bereits Status "geliefert" war (Lagerausgang für ALLE Positionen inkl. der jetzt abgespaltenen bereits gebucht) | Die neue Lieferung, die die ausgewählten Positionen aufnimmt, würde bei erneutem Aufruf von `markiereLieferungGeliefertFallsGeplant()` den Lagerausgang für dieselben Positionen ein zweites Mal buchen | In `app/api/lieferungen/[id]/route.ts` übernimmt die neue Lieferung den Status 1:1 vom Original; `markiereLieferungGeliefertFallsGeplant()` wird nur aufgerufen, wenn das Original noch "geplant" war (dort ist es idempotent-sicher, da die Funktion selbst nur bei Status "geplant" bucht) |
| Häkchen-Auswahl "welche Positionen in Rechnung stellen" (Teilrechnung) erschien nicht, wenn man über den Kunden eine Lieferung anlegt und direkt danach in Rechnung umwandelt | `app/lieferungen/[id]/lieferschein/page.tsx` (Landing-Page nach `/lieferungen/neu`) hatte einen eigenen "In Rechnung umwandeln"-Button, der `PATCH {aktion:"rechnung_erstellen"}` direkt aufrief statt über die Positions-Checkboxen auf der Lieferungs-Detailseite zu gehen | Button navigiert jetzt nur noch zu `/lieferungen/[id]` (`inRechnungUmwandeln()`); dort greift die bestehende Häkchen-Auswahl (alle vorausgewählt, Abwahl = Teilrechnung) aus `rechnungErstellen()` |
| Teilrechnung: War die Ursprungslieferung schon "geliefert" (z.B. weil zuerst die ganze Lieferung als geliefert markiert und erst danach nur ein Teil abgerechnet wurde), blieb die zurückbleibende, noch nicht abgerechnete Position ebenfalls auf "geliefert" stehen statt als offen zu erscheinen | Bewusst so gebaut, um keinen doppelten Lagerausgang zu buchen (Lagerausgang für ALLE Positionen war beim ersten "geliefert" bereits gebucht) — der Lagerbuchungsstatus hing 1:1 am `Lieferung.status`, es gab keine Möglichkeit, "schon geliefert" von "schon abgebucht" zu trennen | Neues Feld `Lieferposition.lagerBereitsGebucht` entkoppelt beides. `teilrechnung_erstellen` markiert beim Abspalten zunächst alle (auch altbestehende) Positionen der Ursprungslieferung als bereits gebucht und setzt die Ursprungslieferung dann auf "geplant" zurück, statt sie auf "geliefert" zu belassen; `markiereLieferungGeliefertFallsGeplant()` und das PUT-Statuswechsel-Handling (geplant→geliefert **und** geliefert→storniert, beide Pfade dupliziert die Logik) bebuchen/entbuchen nur noch Positionen, deren Flag das jeweils erlaubt — end-to-end mit Lagerbestands-Vorher/Nachher-Vergleich verifiziert (kein Doppel- oder Fehlbuchen über mehrere Statuswechsel hinweg) |
| Rechnungen-/Sammelrechnungen-Liste, Mahnwesen und Kunde-Detail ("Offener Betrag", Lieferhistorie) zeigten den Rechnungsbetrag ohne MwSt (netto) statt des tatsächlich fälligen Brutto-Betrags | Lokale `berechneBetrag()`/`lieferungTotal()`-Funktionen summierten nur `menge × verkaufspreis × (1-Rabatt%)`, ohne `artikel.mwstSatz` einzurechnen; `lieferungTotal()` in `_shared.tsx` ließ zusätzlich den Rabatt komplett unter den Tisch fallen; der bereits vorhandene, für genau diesen Zweck gebaute Helper `lib/lieferung-brutto.ts` wurde dort schlicht nicht verwendet | `app/rechnungen/page.tsx`, `app/sammelrechnungen/page.tsx`, `app/api/mahnwesen/route.ts` und `lieferungTotal()` in `app/kunden/[id]/_shared.tsx` nutzen jetzt `berechneLieferungBrutto()`/`berechneSammelrechnungBrutto()` aus `lib/lieferung-brutto.ts`; dafür mussten die jeweiligen API-Selects um `artikel.mwstSatz` ergänzt werden (`/api/sammelrechnungen`, `/api/mahnwesen`, `/api/kunden/[id]`) |
| Bankabgleich: Zuordnungsvorschläge (`/api/bankabgleich/vorschlaege`) zeigten bei echten Fehlbeträgen/Überzahlungen (Abweichung >0,50€) GAR KEINEN Vorschlag mehr an — Panel behauptete "Manuelle Zuordnung über die Rechnungsansicht möglich", obwohl es dort gar keine gab; Betragsabweichungen (Über-/Unterzahlung) wurden beim Zuordnen zudem nirgends erfasst, `alsBezahltMarkieren` setzte `bezahltAm` blind unabhängig davon, ob der Betrag überhaupt passte | `runNormalMatch()` (für den Bulk-Auto-Abgleich gedacht) verwirft Kandidaten hart außerhalb `amountTolerance` (Default 0,50€) — für eine einzelne manuelle Zuordnung ungeeignet, da genau die Fälle mit echter Abweichung am meisten Zuwendung brauchen | Neue `rankCandidatesForBank()` in `lib/bankabgleich-matching.ts` verwirft keine Betragsabweichung mehr, sondern gewichtet Text-/Belegnummer-Treffer stärker als Betragsnähe (für `/api/bankabgleich/vorschlaege`, NICHT für den Bulk-Matcher `auto-match`); `?q=`-Parameter dort ermöglicht zusätzlich freie Suche nach einer beliebigen anderen offenen Rechnung; `ZuordnungsVorschlagCard` bietet bei Abweichung >0,50€ zusätzliche Buttons "Gutschrift erfassen" (Überzahlung) / "Forderung erfassen" (Fehlbetrag) — beides fließt automatisch in die nächste Rechnung des Kunden ein (`injiziereOffeneGutschriften()`/`injiziereAlteForderungen()` in `lib/lieferung.ts`); `PUT /api/bankabgleich/[id]` wickelt Zuordnung + Bezahlt-Markierung + Differenzbuchung jetzt atomar in einer `$transaction` ab |
| Kunden-Picker (z.B. Sammelrechnung → Kunde auswählen) zeigte bei vielen Kunden nicht alle an | `GET /api/kunden` hatte ohne `?page=` (SearchableSelect braucht die volle Liste fürs clientseitige Filtern) eine harte Obergrenze `Math.min(1000, …)` — bei mehr als 1000 Kunden fielen die alphabetisch hinteren einfach weg; einzelne Seiten wie `sammelrechnungen/neu` fragten zusätzlich nur `?limit=500` an, was schon bei über 500 Kunden zu wenig war | Obergrenze in `app/api/kunden/route.ts` auf `Math.min(5000, …)` angehoben; `app/sammelrechnungen/neu/page.tsx` fragt jetzt `?limit=2000` an (gleiches Muster wie `duengebedarf`, `bodenproben/neu`, `sortenversuche/neu`, `sachkundenachweise/neu`, `vorbestellungen/neu`, `rationsberechnung`) |
| Angebot: Auf der Druckansicht (`/angebote/[id]/druck`) gab es keine Möglichkeit, das Angebot als PDF herunterzuladen — nur "Drucken" (Browser-Druckdialog) und ein Nextcloud-Hochladen-Button (client-seitig via html2canvas/jsPDF gerendert, landet nur in Nextcloud, kein Download) | Anders als Rechnung/Lieferschein/Gutschrift/Sammelrechnung fehlte für Angebot ein `GET /api/exporte/angebot`-Endpunkt komplett — es gab nur `POST /api/exporte/angebot/mail` (E-Mail-Versand), der bereits intern `generiereAngebotPdf()` aus `lib/pdfGenerator.ts` nutzt | Neue Route `app/api/exporte/angebot/route.ts` (`GET ?angebotId=`) nach dem Muster von `app/api/exporte/gutschrift/route.ts`: ruft die bereits vorhandene `generiereAngebotPdf()` auf, spiegelt das PDF fire-and-forget nach Nextcloud (Kunden-Unterordner "Angebote", wie in `app/api/nextcloud/dokumente/route.ts` bereits verwendet) und liefert es als `Content-Disposition: attachment`; `/angebote/[id]/druck/page.tsx` bekommt einen "PDF"-Download-Link neben "Drucken" (gleiches Muster wie auf der Lieferschein-Druckseite) |
| Rechnung: Artikelname in der Positionstabelle war im ausgedruckten/als PDF gespeicherten Dokument unterstrichen | Der Artikelname ist ein `Link` auf `/artikel/[id]` (Bildschirm-Komfort); die Verlinkung nutzte `textDecoration: "underline"` als Inline-Style. Sowohl der Browser-Druckdialog ("Als PDF speichern") als auch der html2canvas-basierte "PDF"-Button (`downloadVorschauPdf()`) rendern exakt den Bildschirm-DOM — eine `@media print`-Regel hätte deshalb nur den Druckdialog erfasst, nicht den Screenshot-Export | `textDecoration` in `app/lieferungen/[id]/rechnung/page.tsx` von `"underline"` auf `"none"` geändert (statt eines print-only Overrides), damit alle drei PDF-Wege (echtes Server-PDF via `/api/exporte/rechnung`, Browser-Druckdialog, html2canvas-Vorschau-PDF) konsistent ohne Unterstreichung erscheinen; der Link bleibt weiterhin klickbar |
| Bei Erfassung einer Lieferung/eines Auftrags erkennt `ChargeInput` eine neue, noch nie im Wareneingang gebuchte Charge (⚠ "Neue Charge (kein Wareneingang)"), bot aber keine Möglichkeit, direkt aus diesem Kontext einen passenden Wareneingang nachzutragen — Nutzer musste manuell zu `/lager/wareneingang` wechseln und Artikel/Charge erneut eintippen | `ChargeInput.tsx` konnte den Wareneingang-Kontext (Artikel, Chargennummer) nicht an eine andere Seite übergeben; `/lager/wareneingang` unterstützte zudem kein Vorbefüllen der Chargennummer per URL (nur `artikelId`/`lieferantId`/`bestellpositionId`), und es gab keine Möglichkeit, die Menge über eine Gebinde-/Tütenanzahl statt direkt in kg einzugeben | `ChargeInput.tsx` zeigt bei unbekannter Charge zusätzlich einen Link "→ Wareneingang jetzt erfassen" (`target="_blank"`, damit das laufende Lieferungs-Formular nicht verloren geht) zu `/lager/wareneingang?artikelId=X&chargeNr=Y`; die Wareneingang-Seite übernimmt `chargeNr` jetzt in die erste Position; neues Feld "Anzahl (Gebinde)" erscheint zusätzlich zur Menge, sobald `Artikel.liefergroesse` ein `<Zahl> kg`-Muster enthält (`parseGebindegroesseKg()` in `lib/utils.ts`, z.B. "25 kg Sack" → 25) und berechnet die Menge automatisch aus Anzahl × Gebindegröße |
| "Wer hat diesen Artikel bekommen?" (`ArtikelKundenUebersicht`, `/artikel/[id]?tab=kunden`) zeigte pro Kunde/Lieferung keine Rechnungsnummer und keine Absprungmöglichkeit zur Rechnung | `GET /api/artikel/[id]/kunden` selektierte `Lieferung.rechnungNr` gar nicht erst | Route liefert `rechnungNr` jetzt je Lieferungs-Vorgang mit; Tabelle hat neue Spalte "Rechnung(en)" (Badges/Links auf `/lieferungen/[id]/rechnung`, wie die bestehende Charge(n)-Spalte aufgebaut) und die aufgeklappte Einzelvorgänge-Liste zeigt die Rechnungsnummer ebenfalls als Link; Vorbestellungen/Angebote bleiben unverändert (haben keine eigene Rechnung, `rechnungNr` dort `null`) |
| Neue Lieferung (`/lieferungen/neu`): VK-Preis wurde bei vielen Artikeln nicht korrekt vorbelegt — es erschien immer der allgemeine `Artikel.standardpreis`, obwohl für den gewählten Kunden ein individueller Sonderpreis (`KundeArtikelPreis`) hinterlegt war; zusätzlich zeigte der EK-Preis bei Artikeln mit 2+ Lieferanten ohne "bevorzugt"-Markierung teils 0,00 € statt des tatsächlich gepflegten Preises | VK: `updatePosition()` setzte beim Artikel-Wechsel blind `art.standardpreis`, ohne die Kunden-Sonderpreise abzufragen — der dafür vorhandene Helper `berechneVerkaufspreis()` (bereits für wiederkehrende Lieferungen genutzt) kam hier nie zum Einsatz. EK: `resolveEK()`/`bevorzugterEK()` fielen ohne "bevorzugt"-Flag auf `lieferanten[0]` zurück — die Rückgabereihenfolge von Prisma ist nicht garantiert die des tatsächlich gepflegten Preises; stand zufällig ein Lieferant mit EK 0 (nie gepflegt) an erster Stelle, wurde dessen 0 statt des echten Preises eines anderen Lieferanten angezeigt | Neuer Fetch von `/api/kunden/[id]/preise` bei Kundenwahl (`kundePreise`-State in `app/lieferungen/neu/page.tsx`); VK nutzt jetzt `berechneVerkaufspreis(artikel, kundePreis)` bei Artikelauswahl, mit "✓ Sonderpreis"-Hinweis unter dem VK-Feld. `resolveEK()` (`lieferungen/neu/page.tsx`) und `bevorzugterEK()` (`artikel/page.tsx`) bevorzugen jetzt zusätzlich irgendeinen Lieferanten MIT gepflegtem EK (`> 0`), bevor auf einen ungeprüften `lieferanten[0]` zurückgefallen wird |
| Lieferungs-Detailseite (`/lieferungen/[id]`) zeigte "Überfällig (N Tage)" und ein "Fällig: …"-Datum, obwohl die Lieferung noch gar nicht in Rechnung gestellt war — verwirrte Nutzer glaubten, die Lieferung ließe sich deshalb nicht in eine Rechnung umwandeln (Button funktionierte tatsächlich einwandfrei) | `basisDatum` fiel ohne `rechnungDatum` auf `lieferung.datum` (Lieferdatum) zurück und rechnete die Fälligkeit ab Lieferdatum + Zahlungsziel — exakt derselbe Fehler, der für `LieferhistorieTab` bereits früher gefixt wurde (siehe Zeile weiter oben), hier aber in der Haupt-Detailseite nie behoben worden war | `faelligkeitsDatum` ist jetzt `null`, solange `lieferung.rechnungDatum` nicht gesetzt ist; `istUeberfaellig` prüft zusätzlich `!!lieferung.rechnungNr`; die "Fällig: …"-Anzeige (Bildschirm) erscheint nur noch wenn `faelligkeitsDatum` vorhanden ist, der Druck-Rechnungskopf zeigt "Fällig am" ohnehin nur wenn `isRechnung` |
| Derselbe "erster Lieferant statt tatsächlich gepflegtem EK"-Bug (siehe Zeile weiter oben zu `/lieferungen/neu` und `artikel/page.tsx`) steckte noch an 5+ weiteren Stellen: `preisauskunft/page.tsx`, `api/lieferungen/[id]/positionen/route.ts` (Position zu bestehender Lieferung hinzufügen — dort zusätzlich verschärft: die Prisma-Query lud per `take:1` von vornherein nur EINEN Lieferanten, unabhängig von `bevorzugt`), `lager/page.tsx`, `retouren/neu/page.tsx`, `artikel/[id]/page.tsx` (Marge-Berechnung + Lieferanten-Karte) | Die Fallback-Logik "bevorzugt, sonst `lieferanten[0]`" war in jeder Datei separat dupliziert — Korrekturen zogen dadurch nie automatisch nach | Zentraler Helper `resolveBevorzugtenLieferanten()`/`resolveBevorzugtenEK()` in `lib/utils.ts` (bevorzugt mit Preis > 0, sonst irgendeiner mit Preis > 0, sonst bevorzugt/erster auch ohne Preis) — alle o.g. Stellen sowie `lieferungen/neu/page.tsx` und `artikel/page.tsx` nutzen jetzt ausschließlich diesen einen Helper; die Positionen-Route lädt jetzt alle Lieferanten statt nur den ersten |
| `filterArtikelFelder()` (`lib/permissions.ts`) soll den EK-Preis vor Nutzern ohne `FELD_ARTIKEL_EINKAUFSPREIS`-Berechtigung verstecken, löschte dabei aber die nicht existierenden Feldnamen `einkaufsPreis`/`einkaufsPreisNetto` (großes "P") statt `einkaufspreis` (Artikel/ArtikelLieferant-Schema nutzt durchgehend Kleinschreibung) — die Filterung war seit Einführung der Berechtigung komplett wirkungslos, jeder angemeldete Nutzer sah den EK unabhängig von seiner Rolle über `/api/artikel` und `/api/artikel/[id]` | Tippfehler bei den zu löschenden Feldnamen; das clientseitige `canSeeEk`-Gating (`usePermission(P.FELD_ARTIKEL_EINKAUFSPREIS)` in `artikel/[id]/page.tsx`) versteckte zwar die UI-Elemente korrekt, die Rohdaten waren aber trotzdem im Netzwerk-Response sichtbar | Feldnamen auf `einkaufspreis` korrigiert; die zwei toten Top-Level-Deletes (`einkaufsPreis`/`einkaufsPreisNetto` — Artikel hat gar kein eigenes EK-Feld, das lebt ausschließlich auf `ArtikelLieferant`) entfernt; verifiziert mit einem Testnutzer ohne die Berechtigung, dass `einkaufspreis` jetzt tatsächlich aus jedem `lieferanten[]`-Eintrag entfernt wird |
| Bankabgleich (Auto-Match): eine Zahlung, deren Verwendungszweck die Rechnungsnummer nur als bloße laufende Nummer ohne Präfix/Jahr enthielt (z.B. "Rechnung 361" statt "RE-2026-0361" — in der Praxis der Regelfall bei Banküberweisungen), wurde vom Rechnungsnummer-Abgleich gar nicht erkannt; bei zwei offenen Rechnungen desselben Kunden mit identischem Betrag gewann verlässlich die zeitlich nähere statt der per Nummer tatsächlich referenzierten | `receiptNumberHit()` prüfte nur, ob die VOLLSTÄNDIGE normalisierte Rechnungsnummer als Teilzeichenkette im Verwendungszweck steckt — keine Erkennung der oft allein angegebenen laufenden Nummer. Zusätzlich gewichtete Pass 2 von `runNormalMatch()` (`amountDiff*1000 + dayDiff - textScore*10`) einen Rechnungsnummer-Treffer viel zu schwach gegenüber dayDiff: ein typisches Zahlungsziel von mehreren Wochen erzeugte leicht 20–40 Tage Differenz, die den max. 10-Punkte-Textbonus deutlich übertraf | `receiptNumberHit()` (`lib/bankabgleich-matching.ts`) erkennt jetzt zusätzlich die letzte Ziffernfolge der Rechnungsnummer (mit und ohne führende Nullen) als eigenständiges Zahlen-Token im Verwendungszweck (Token-Grenze statt roher Teilzeichenkette, damit z.B. "361" nicht zufällig in einer IBAN trifft) — Konfidenz 0,85 statt 1 für den Volltreffer. Pass-2-Gewichtung von `textScore*10` auf `textScore*500` angehoben, damit ein "nahezu sicherer" Rechnungsnummer-Treffer wie dokumentiert tatsächlich Datumsnähe schlägt; mit echten End-to-End-Testdaten (zwei offene Rechnungen gleichen Betrags, nur laufende Nummer im Verwendungszweck) über die reale `/api/bankabgleich/auto-match`-Route verifiziert, plus neue Testfälle in `__tests__/lib/bankabgleich-matching.test.ts` |
| Bankabgleich: keine Möglichkeit, EINE Zahlung mehreren offenen Rechnungen zuzuordnen — ein Kunde, der z.B. zwei offene Rechnungen in einer Sammelüberweisung begleicht (Verwendungszweck nennt beide Rechnungsnummern), konnte im Bankabgleich nur mit EINER der beiden verknüpft werden; die zweite blieb dauerhaft fälschlich als "offen" stehen, obwohl sie längst bezahlt war | `Kontoumsatz.lieferungId`/`sammelrechnungId` waren als singuläre Felder angelegt — 1:1-Zuordnung fest im Schema verankert, keine M:N-Möglichkeit | Neues Modell `KontoumsatzWeitereZuordnung` (additiv, ohne die bestehenden Felder/Konsumenten anzufassen): die Haupt-Rechnung bleibt weiterhin über `Kontoumsatz.lieferungId`/`sammelrechnungId` zugeordnet, jede weitere Rechnung DESSELBEN Kunden landet in der neuen Tabelle; `POST/DELETE /api/bankabgleich/[id]/weitere` markiert/entmarkiert sie ebenso als bezahlt wie die Haupt-Rechnung (`markiereAlsBezahlt`/`macheBezahltRueckgaengig`); neues Panel `WeitereRechnungenPanel` (Button "+ weitere Rechnung" bei bereits zugeordneten Umsätzen in `/bankabgleich`) bietet offene Rechnungen desselben Kunden zur Auswahl an und markiert per `receiptNumberHit()` (bereits vorhandene Matching-Logik) diejenigen, deren Nummer im Verwendungszweck vorkommt, als "✓ … erkannt" — rein ein Sortier-/Hervorhebungshinweis, das Hinzufügen bleibt ein expliziter Klick; volles Un-Zuordnen (`DELETE /api/bankabgleich/[id]`) sowie der Bankabgleich-Reset (`/api/bankabgleich/reset`) räumen die neue Tabelle konsistent mit auf |
| Ein per "Löschen" entfernter Artikel (setzt nur `aktiv:false`, kein echtes Löschen — siehe `app/artikel/[id]/page.tsx` `handleDelete()`) verschwand für Nutzer UNWIDERRUFLICH aus der Artikelliste — kein Filter/keine Ansicht zeigte inaktive Artikel je wieder an, obwohl `GET /api/artikel` bereits `?aktiv=false`/`?aktiv=alle` unterstützte | `app/artikel/page.tsx` hatte überhaupt keinen `aktiv`-Filterzustand; das API-Feature existierte, war im Frontend aber nicht verdrahtet | Neuer "Status"-Dropdown (Aktive Artikel [Standard] / Inaktive Artikel / Alle) in der Artikel-Filterleiste, persistiert wie die übrigen Filter in `sessionStorage("artikel-filters")`; inaktive Zeilen zeigen zusätzlich ein "Inaktiv"-Badge neben dem Namen. Reaktivieren weiterhin über die bestehende "Aktiv"-Checkbox auf der Artikel-Detailseite |
| Mahnwesen (`/mahnwesen`) hatte keine Möglichkeit, gezielt nach einem Kunden oder einer Rechnungsnummer zu suchen (nur der Mahnstufen-Filter existierte), und die Mahnstufe war ausschließlich automatisch aus den Tagen überfällig berechnet — es gab keinen Weg, z.B. aus Kulanz einen Brief ohne die für Stufe 2/3 konfigurierte Mahngebühr zu schreiben, ohne die Rechnung erst als bezahlt zu markieren | Kein Suchfeld im Frontend vorhanden; `Lieferung` hatte kein Feld für einen manuellen Mahnstufen-Override, `mahnstufe` kam ausschließlich aus `tageUeberfaellig` + den in `system.mahnwesen` konfigurierten Fristen | Neues Suchfeld in `app/mahnwesen/page.tsx` filtert clientseitig nach Kunde/Firma/Rechnungsnr. (Daten sind ohnehin bereits vollständig geladen, kein zusätzlicher Request nötig); neues Feld `Lieferung.manuelleMahnstufe Int?` (Override 1\|2\|3, null = automatisch) setzbar über die editierbare Mahnstufen-Badge je Zeile (`PUT /api/lieferungen/[id]`, whitelist-validiert 1–3), mit "↺"-Button zum Zurücksetzen auf automatisch; `/api/mahnwesen` liefert die effektive `mahnstufe` (Override hat Vorrang) sowie zusätzlich `automatischeMahnstufe`/`mahnstufeManuell` — Druck, E-Mail-Versand, KI-Brief und Mahngebühr-Berechnung nutzen bereits durchgehend `e.mahnstufe`, übernehmen den Override also ohne weitere Änderung |
| Bankabgleich: bezahlt ein Kunde eine Rechnung in zwei Teilbeträgen (zwei Überweisungen), verschwand die Rechnung nach Zuordnung der ERSTEN Teilzahlung komplett aus der Kandidatenliste — die zweite Überweisung konnte die Rechnung dadurch weder automatisch noch über die manuelle Suche ("Andere Rechnung suchen") finden und zuordnen | Die Checkbox "Als bezahlt markieren" (abwählbar seit der ursprünglichen Differenzbuchungs-Funktion, Kommentar erwähnte bereits "z.B. Teilzahlung/Anzahlung") setzte bei Abwahl zwar korrekt kein `bezahltAm`, legte aber NIE eine tatsächliche `Teilzahlung` an — der erhaltene Teilbetrag war nirgends festgehalten, und `ladeVerkaufsKandidaten()` filtert ohnehin nur nach `bezahltAm`, nicht nach Teilzahlungen; das eigentliche Symptom trat erst auf, wenn die ERSTE Teilzahlung versehentlich MIT angehakter Checkbox (voll bezahlt) zugeordnet wurde, wodurch `bezahltAm` gesetzt war und die Rechnung dauerhaft aus den Kandidaten fiel | `PUT /api/bankabgleich/[id]` legt bei `alsBezahltMarkieren:false` (Ziel lieferungId/sammelrechnungId) jetzt automatisch eine `Teilzahlung` über den Bankbetrag an (`kontoumsatzId` verknüpft) — die Rechnung bleibt `bezahltAm:null` und taucht für die nächste Überweisung weiterhin als Kandidat auf; idempotent (vorherige, von diesem Kontoumsatz erzeugte Teilzahlung wird bei jedem PUT zuerst entfernt, bevor neu entschieden wird); `DELETE /api/bankabgleich/[id]` (Zuordnung aufheben) entfernt die Teilzahlung wieder mit. `ZuordnungsVorschlagCard` zeigt bei abgewählter Checkbox jetzt einen Hinweistext ("Wird stattdessen als Teilzahlung über X € erfasst") |
| Bankabgleich-Vorschlagsliste: deckt eine Zahlung mehrere offene Rechnungen desselben Kunden ab (alle korrekt als Einzel-Vorschläge angezeigt), ließ sich nur EINE davon übernehmen — die Summe der ausgewählten Vorschläge war zudem nirgends sichtbar, man musste selbst nachrechnen, ob mehrere Rechnungen zusammen zur Zahlung passen | Jede `ZuordnungsVorschlagCard` hatte nur einen eigenen "Übernehmen"-Button ohne Bezug zu den anderen Karten; die bereits vorhandene Mehrfach-Zuordnung (`KontoumsatzWeitereZuordnung`/`POST .../weitere`) war ausschließlich über das separate "+ weitere Rechnung"-Panel erreichbar (nur für bereits zugeordnete Umsätze, erfordert erneutes Suchen) | `ZuordnungsVorschlagCard` bekommt optionale `selected`/`onToggleSelect`-Props — bei lieferung/sammelrechnung-Kandidaten erscheint eine Checkbox zur Mehrfachauswahl; sobald mind. eine Karte ausgewählt ist, zeigt `app/bankabgleich/page.tsx` eine Zusammenfassungsleiste (Anzahl, Summe, Differenz zur Zahlung bzw. "passt genau zur Zahlung ✓") mit Button "N Rechnungen zuordnen" — nutzt intern dieselbe Haupt-Zuordnung (`PUT`) für die erste Auswahl und `POST .../weitere` für den Rest, keine neue Backend-Logik nötig |
| KI-Mahnungstext (`PROMPTS.mahnungstext` in `lib/ai.ts`) klang auf Stufe 2/3 zu hart/drohend ("bestimmt", "Hinweis auf gerichtliches Mahnverfahren/Inkasso") für den B2B-Landwirtschaftskontext mit oft langjährigen Kundenbeziehungen | Prompt-Anweisung je Mahnstufe war zu stark auf Nachdruck statt auf Freundlichkeit ausgelegt | Prompt überarbeitet: durchgehend freundlicher, wertschätzender Ton auch auf höheren Stufen vorgeschrieben ("NIE scharf, drohend oder kalt"), Stufe 3 erwähnt mögliche nächste Schritte nur noch als sachliche Information statt als Drohung — betrifft ausschließlich die KI-generierten Briefe (`/mahnwesen` → "🤖 Brief"), nicht den statischen Druck-/E-Mail-Text |
| Mahnwesen: die statische Stufe-1-Formulierung ("Zahlungserinnerung") in Druck/PDF/E-Mail klang unpersönlich/generisch (Kundenwunsch: eigene, wärmere Formulierung als Standard); zudem gab es keinen echten PDF-Export für Mahnungen (nur `window.print()` im Browser) | Kein Downloadbare PDF-Route für Mahnungen (`generiereRechnungPdf`/`generiereGutschriftPdf`/`generiereAngebotPdf` existierten, `generiereMahnungPdf` fehlte); Stufe-1-Text war fest verdrahtet | Neuer `generiereMahnungPdf()` in `lib/pdfGenerator.ts` (DIN-5008-Geschäftsbrief wie `generiereRechnungPdf`, aber ohne Positions-Tabelle) + `GET /api/exporte/mahnung`; "PDF"-Button in `/mahnwesen` neben "Drucken"/"E-Mail". Stufe-1-Text in Druck (`druckeZahlungserinnerung()`), PDF und E-Mail (`mahnungEmail()`) einheitlich auf die vom Kunden vorformulierte, freundliche Version umgestellt (personalisierte Anrede "Sehr geehrtes Team von {Firma}!" wenn `Kunde.firma` gesetzt ist). `berechneVerzugszinsen()`/`mahngebuehr()` aus `app/mahnwesen/page.tsx` nach `lib/mahnwesen-config.ts` verschoben (client-sicher, dort bereits gelistet), damit Frontend und die neue Server-PDF-Route dieselbe Berechnung nutzen. Neues Feld `Benutzer.mobil` + "Ihr Ansprechpartner"-Feld oben rechts auf der PDF (Name/Mobil/Mail des anmeldeten Sachbearbeiters statt der allgemeinen Firmenzentrale) — Spaltenbreite dynamisch schriftgrößenreduzierend, damit lange E-Mail-Adressen nicht mit dem Label kollidieren. Neuer Ordnertyp `"Mahnungen"` in `KundeDokumentTyp` (`lib/nextcloud.ts`) für den Nextcloud-Spiegel |
| Bankabgleich "Automatischer Abgleich" (Bulk-Review): wählt der Algorithmus bei mehreren offenen Rechnungen mit identischem Betrag die falsche (Buchungstext nennt eine andere/nicht existierende Rechnungsnummer), gab es innerhalb dieser Karten keine Möglichkeit, stattdessen eine andere Rechnung auszuwählen — die manuelle Suche ("Andere Rechnung suchen") existierte nur im Inline-Panel der Haupttabelle auf `/bankabgleich`, nicht im Bulk-Review. Außerdem fehlte über dem Buchungstext der Name des Überweisenden (Gegenpartei), was das Erkennen von Fehlzuordnungen erschwerte | `AbgleichPaar.bank` (sowohl `/api/bankabgleich/auto-match` als auch `/api/ki/bankabgleich`) transportierte kein `gegenpartei`-Feld, obwohl `zuBankBuchung()` es längst liefert (`b.name`); die Bulk-Review-Karten in `AutomatischerAbgleich.tsx` waren reine `ZuordnungsVorschlagCard`s ohne Such-UI | Neue `gegenpartei`-Property in beiden Routen ergänzt (`toBankInfo()`/`antwort`-Mapping); neue Komponente `components/bankabgleich/AutoMatchKarte.tsx` zeigt die Gegenpartei jetzt über dem Buchungstext UND bietet einen "Andere Rechnung suchen"-Link, der dieselbe `/api/bankabgleich/vorschlaege?umsatzId=&q=`-Suche wie das Haupt-Panel nutzt; Auswahl eines Treffers ersetzt den Kandidaten der Karte clientseitig (`kandidatWechseln()` in `AutomatischerAbgleich.tsx`, ersetzt `kandidat`/`amountDiff`/`dayDiff`/`textScore`, verwirft eine ggf. vorhandene KI-Konfidenz/Begründung) — "Übernehmen" verwendet danach den manuell gewählten statt des ursprünglich algorithmisch vorgeschlagenen Kandidaten |
| "Andere Rechnung suchen" (`/api/bankabgleich/vorschlaege?q=`) fand eine gesuchte, tatsächlich noch offene Rechnung teils gar nicht — auch beim exakten Suchen nach ihrer eigenen Rechnungsnummer keine Treffer | `GET /api/bankabgleich/vorschlaege` filterte den Suchtext (`receiptNumber`/`counterparty`/`description` `.includes(q)`) ausschließlich IM SPEICHER auf dem von `ladeKandidatenFuerBetrag()` gelieferten Pool — der ist aber selbst schon nach `rechnungDatum desc` auf `MAX_KANDIDATEN=300` gedeckelt (analog zum früheren Kunden-Picker-Bug, siehe Zeile weiter oben zu `GET /api/kunden`); bei >300 offenen Rechnungen/Sammelrechnungen insgesamt fiel eine ältere gesuchte Rechnung schon VOR dem Textfilter aus dem geladenen Pool heraus, unabhängig vom Suchbegriff | Neue `sucheVerkaufsKandidaten()`/`sucheEinkaufsKandidaten()`/`sucheKandidatenFuerBetrag()` in `lib/bankabgleich-kandidaten.ts` suchen bei gesetztem `q` direkt per Prisma-`WHERE…OR…contains` in der DB (Rechnungsnr./Kundenname bzw. Belegnr./Beschreibung/Lieferantenname), unabhängig vom Datum, mit eigenem, pro Beleg-Typ geltendem `SEARCH_LIMIT=20` statt des globalen 300er-Deckels; `ladeLieferungKandidaten()`/`ladeSammelrechnungKandidaten()`/`ladeAusgabeKandidaten()`/`ladeEingangsrechnungKandidaten()`-Helfer teilen sich Query+Mapping zwischen "alle offenen laden" (unverändert, weiterhin 300er-Deckel für Ranking/Bulk-Abgleich) und "gezielt suchen"; `/api/bankabgleich/vorschlaege/route.ts` ruft bei `q.length>=2` jetzt `sucheKandidatenFuerBetrag()` statt `ladeKandidatenFuerBetrag()`+In-Memory-Filter. Bewusst kein `mode:"insensitive"` (SQLite-Provider unterstützt das nicht — `contains` ist auf SQLite für ASCII bereits nativ case-insensitiv) |
| Mahnwesen: Stufe-1-Zahlungserinnerung (PDF, Druckansicht, Listenspalte in `/mahnwesen`) wies Verzugszinsen aus, obwohl Stufe 1 als unverbindliche, freundliche Erinnerung gedacht ist und keine rechtliche Verzugswirkung entfaltet | `berechneVerzugszinsen()` in `lib/mahnwesen-config.ts` berechnete taggenaue Zinsen rein aus Betrag/Tagen überfällig/Zinssatz — ohne Bezug zur Mahnstufe. Anders als `mahngebuehr()` (die schon immer je Stufe unterschiedliche Werte liefert, Stufe 1 defaultmäßig 0) kannte die Zinsfunktion `mahnstufe` gar nicht als Parameter | `berechneVerzugszinsen()` bekommt einen verpflichtenden 4. Parameter `mahnstufe` und liefert bei `mahnstufe<=1` immer `0`, unabhängig von Tagen überfällig; alle 4 Call-Sites (`lib/pdfGenerator.ts` `generiereMahnungPdf()`, `app/mahnwesen/page.tsx` `druckeZahlungserinnerung()`, Listenspalte, Fußzeilen-Summe) übergeben jetzt die jeweilige Mahnstufe. Die "Verzugszinsen"/"Gesamtforderung"-Zeilen in PDF und Druckansicht waren bereits auf `zinsen > 0` gegatet und verschwinden dadurch automatisch bei Stufe 1; KI-Brief (`/api/ki/mahnungstext`) bekam ohnehin nie Zinsdaten übergeben, nur `mahngebuehr` (dort schon länger auf `stufe > 1` begrenzt) — keine Änderung nötig |
| Mahnung-PDF (`generiereMahnungPdf`): der große 18pt-Titel oben rechts ("Freundliche Zahlungserinnerung"/"1. Mahnung"/"2. Mahnung / Letzte Mahnung") wirkte neben dem darunter gestapelten "Ihr Ansprechpartner"-Block (Name/Mobil/Mail) zu dominant und war reine Dopplung — derselbe Text steht bereits als Betreffzeile im Brieftext (`${MAHNUNG_BETREFF[mahnstufe]} – Rechnung …`, für alle 3 Stufen gleichermaßen) | Titel und Ansprechpartner-Block waren beide auf den oberen ~40mm der Seite gestapelt (Titel bei y=20 fontSize 18, Ansprechpartner-Zeilen ab y=27 mit 4,5mm Abstand) — optisch der dominanteste Bereich der Seite, während das Anschriftfeld (Fensterkuvert-Position) direkt darunter bei y=49 begann, kaum Luft zum Kopfbereich | Titel-Zeile komplett entfernt; verbleibender Ansprechpartner-Block rutscht auf y=20 hoch (füllt die freigewordene Höhe), Schriftgröße 9→8,5pt und Zeilenabstand 4,5→4mm für ein kompakteres Erscheinungsbild; Anschriftfeld (Absenderzeile + Kundenadresse) um 6mm nach unten verschoben (y=49→55 bzw. Kundenname-Start 57→63) für mehr Abstand zum Kopfbereich. Betrifft nur `generiereMahnungPdf()` — die separate Browser-Druckansicht (`druckeZahlungserinnerung()` in `app/mahnwesen/page.tsx`) hatte diesen Titel/Ansprechpartner-Block nie und ist unverändert |
| Rechnungs-Vorschau (`/lieferungen/[id]/rechnung`) auf dem Handy: Kopfzeilen-Meta-Tabelle (Rechnungsnr./-datum/…) überlappte die Absenderzeile, Tabellen-Spaltenköpfe liefen zu einem einzigen verschmolzenen Wort zusammen — UND der "PDF"-Button (`downloadVorschauPdf()`) erzeugte auf dem Handy deutlich mehr Seiten (Testfall: 15 statt 2) als bei identischem Aufruf am Desktop | `[data-print-area]` hatte nur `maxWidth: "210mm"`, kein festes `width` — auf Bildschirmen schmaler als ~794px (jedes Handy-Viewport) schrumpfte das Element dadurch auf Viewport-Breite statt A4-Breite. Der Briefkopf hat aber eine feste Höhe (`height: "25mm"`, `overflow` default `visible`) — bricht die schmaler gewordene Meta-Tabelle dadurch auf mehr Zeilen um als hineinpasst, ragt der überschüssige Text sichtbar in die darunterliegende Absenderzeile hinein. Dieselbe Verengung ließ auch die (bewusst NICHT `table-layout:fixed` gesetzte, siehe Zeile weiter oben zu iOS/WebKit-Spaltenbreiten) Positionstabelle so eng werden, dass Spaltenköpfe kaum noch sichtbaren Abstand hatten. Der ursprüngliche Fix (erste Version dieser Zeile) erzwang die A4-Breite nur clientseitig kurz vor jeder `html2canvas`-Aufnahme — behob zwar die PDF-Seitenzahl, ließ die eigentliche BILDSCHIRM-Vorschau auf dem Handy aber weiterhin überlappend/unlesbar | `[data-print-area]` bekommt jetzt dauerhaft `width: "210mm"` statt nur `maxWidth` — das Dokument ist dadurch IMMER A4-breit, unabhängig vom Viewport (kein Sonderfall mehr fürs PDF nötig, die zwischenzeitliche JS-`A4_BREITE_PX`-Zwangsbreite vor den `html2canvas`-Aufrufen wurde wieder entfernt). Da `html, body { overflow-x: hidden }` global gesetzt ist (`app/globals.css`, verhindert versehentliches horizontales Scrollen auf anderen Seiten), bekommt `[data-print-area]` einen neuen Wrapper `<div className="rechnung-scroll-wrapper" style={{overflowX:"auto"}}>` — auf dem Handy scrollt man die Rechnung dadurch horizontal wie eine echte A4-Seite an, statt dass sie zusammengequetscht wird; `.rechnung-scroll-wrapper { overflow: visible !important; }` in der `@media print`-Regel verhindert, dass echter Browserdruck nur den sichtbaren Scroll-Ausschnitt druckt. Per Playwright mit mobilem Viewport (390px) end-to-end verifiziert: Bildschirm-Screenshot zeigt keine Überlappung mehr (Kopfzeile UND Tabelle sauber lesbar, horizontal scrollbar), PDF-Export liefert 1 Seite auf Handy UND Desktop identisch. Betrifft nur `/lieferungen/[id]/rechnung`; derselbe `maxWidth:"210mm"`-ohne-`width`-Mustercode existierte auch in `app/angebote/[id]/druck/page.tsx`, `app/lieferungen/[id]/lieferschein/page.tsx` und `app/vorbestellungen/[id]/auftragsbestaetigung/page.tsx` — siehe Zeile weiter unten, dort mit demselben Muster nachgezogen |
| Lieferantenbestellungen waren auf drei unverbundene Insellösungen verteilt (Bestellliste ausschließlich aus Angebot-Annahme, Bestellungen nur manuell ohne Versand, Bestellvorschlag-PDF ganz ohne Persistenz) — dadurch kein Überblick, was bereits bestellt wurde, keine Möglichkeit, Positionen ad-hoc/diktiert zu erfassen, kein Nachweis über den tatsächlichen Versand an den Lieferanten, kein Weg, eine Position umzuschlüsseln, wenn ein Lieferant absagt | Die drei Bausteine teilten sich zwar dieselben Modelle (`Bestellposition`/`Bestellung`), aber `Bestellposition` ließ sich nur automatisch (Angebot-Annahme) erzeugen, `Bestellung` hatte keinen Bezug zurück zur erzeugenden Bestellliste und keine Versand-Felder | `Bestellliste` (`app/bestellliste`) verbindet jetzt alle drei: `POST /api/bestellliste` erlaubt manuelles/diktiertes Erfassen unabhängig von einem Angebot (kundeId/lieferungId/angebotId bleiben null), mit automatischem Lieferantenvorschlag über `vorschlagLieferantFuerArtikel()` (rein datenbasiert: `ArtikelLieferant.bevorzugt`, sonst günstigster Preis) — frei überschreibbar per `PATCH .../lieferantId`, solange die Position noch nicht gebündelt ist. "N zu Bestellung bündeln" (`POST /api/bestellungen` mit `bestellpositionIds[]`) erzeugt eine formelle `Bestellung` und verknüpft die Quell-Positionen per neuem Feld `Bestellposition.bestellungId` (Traceability: Bestellliste zeigt seitdem `→ BES-2026-NNNN` statt nur einem Status). `POST /api/bestellungen/[id]/mail` sendet die Bestellung per E-Mail (neues Template `bestellungEmail()` in `lib/email-templates.ts`, inkl. `ArtikelLieferant.lieferantenArtNr` falls hinterlegt) und setzt `versendetAm`/`versendetAn` als Nachweis — bewusst KEIN Auto-Versand beim Bündeln, das Frontend zeigt vorher `EmailVersandModal` zur Bestätigung/Korrektur der Empfänger-Adresse. `POST /api/bestellungen/[id]/umschluesseln` verlegt eine bereits gebündelte Position auf einen anderen Lieferanten (legt dafür immer eine neue Bestellung an, um mehrdeutiges Zusammenführen zu vermeiden) und zieht einen verknüpften Bestellliste-Eintrag mit um. Diktieren (Spracherkennung) war bewusst NICHT Teil dieser Änderung — siehe Zeile weiter unten für den Nachzieher |
| Rechnungsliste (`/rechnungen`) hatte keinen Filter für stornierte Rechnungen — stornierte Rechnungen tauchten nur versteckt unter "Alle" auf (durchgestrichen), ließen sich aber nicht gezielt isolieren | `FilterStatus`-Union kannte nur `"alle"\|"offen"\|"ueberfaellig"\|"bezahlt"`, obwohl `getRechnungStatus()` bereits `"storniert"` als eigenen Status berechnet (wird nur nie durch einen eigenen Filter-Tab erreichbar gemacht) | Neuer Filter-Tab "Storniert" (`FilterStatus` um `"storniert"` erweitert, `matchFilter`-Bedingung ergänzt) neben Alle/Offen/Überfällig/Bezahlt in `app/rechnungen/page.tsx` |
| Bildschirm-Vorschau + client-seitiger "PDF"-Button (`downloadVorschauPdf()`, html2canvas) einer stornierten Rechnung zeigten nur eine schlichte rote Umrandungsbox ("Storniert – Datum") statt eines auffälligen Wasserzeichens — der serverseitige "E-Rechnung"-Export (`generiereRechnungPdf()`) hatte mit `zeichneStornoWasserzeichen()` (`lib/pdfGenerator.ts`) längst ein diagonales, halbtransparentes "STORNO" über das ganze Blatt, dieses jsPDF-Zeichnen lässt sich aber nicht auf den HTML/html2canvas-Pfad übertragen | Kein CSS-Äquivalent zum jsPDF-Wasserzeichen vorhanden; ein einzelnes, einmalig positioniertes Wasserzeichen würde bei mehrseitigen Rechnungen ohnehin nur auf einer Seite erscheinen (kein `<tfoot>`/`position:fixed`-Repeat-Mechanismus verfügbar, siehe bekannte WebKit-Einschränkung weiter oben) | Neue gekachelte SVG-Datenurl (`STORNO_WASSERZEICHEN_URL`, `app/lieferungen/[id]/rechnung/page.tsx`) als `background-image` (repeat, 60mm-Kachel) auf einer `position:absolute; inset:0`-Ebene direkt in `[data-print-area]` — deckt dadurch automatisch die volle (ggf. mehrseitige) Dokumenthöhe ab und erscheint sowohl im echten Browserdruck als auch in jeder html2canvas-Slice des "PDF"-Buttons, ganz ohne Änderung an der Seiten-Slicing-Logik. Layer liegt mit `zIndex:-1` unter dem normalen Inhalt; **wichtig:** `[data-print-area]` selbst braucht dafür ein explizites `zIndex:0` (nicht nur `position:relative`) — sonst entsteht dort kein eigener Stacking-Context und das negative z-index der Wasserzeichen-Ebene bezieht sich auf einen Vorfahren weiter oben im Baum, wodurch das Wasserzeichen komplett unsichtbar hinter dem Seitenhintergrund verschwindet |
| Gutschrift-PDF (`generiereGutschriftPdf()`): Betreffzeile/Empfängeranschrift begannen zu weit oben und passten nicht mit dem Sichtfenster eines Fensterkuverts zusammen — anders als bei der Rechnung gab es zudem gar keine Absenderzeile im Fenster | `generiereGutschriftPdf()` nutzte (anders als `generiereRechnungPdf()`) kein festes DIN-5008-Anschriftfeld: die Empfänger-Adresse begann bei `sepYG + 10`, wobei `sepYG` von der Anzahl der Metazeilen (Gutschriftnummer/Rechnungsnummer/Datum/Grund) abhing — je nach Belegdaten rutschte der Block unterschiedlich weit nach oben/unten, ohne feste Verankerung am Kuvertfenster (45–90 mm) | Anschriftblock auf dasselbe feste mm-Schema wie `generiereRechnungPdf()` umgestellt: Absenderzeile fix bei 49 mm (mit Unterstreichung bei 50,5 mm), Empfängeranschrift fix ab 57 mm, Betreff auf `Math.max(eyG + 8, 95)` — identische Konstanten wie bei der Rechnung. Trennlinie + "EMPFÄNGER"-Label (beide nicht Teil des Rechnungs-Patterns) entfernt |
| Versehentlich beim falschen Kunden angelegte Gutschrift ließ sich nicht löschen | `DELETE /api/gutschriften/[id]` verweigerte das Löschen bei jedem Status außer OFFEN (`"Nur Gutschriften mit Status OFFEN können gelöscht werden"`) — sobald eine Gutschrift automatisch in eine spätere Rechnung des Kunden verrechnet wurde (`injiziereOffeneGutschriften()`, status→VERBUCHT), war sie über die UI dauerhaft nicht mehr entfernbar; der "Löschen"-Button war zudem im Frontend (Detail- und Listenseite) ebenfalls nur bei OFFEN gerendert | Löschen jetzt unabhängig vom Status möglich, macht dabei alle Nebenwirkungen der Gutschrift rückgängig statt sie nur zu verweisern: bei VERBUCHT wird die in `injiziereOffeneGutschriften()` angelegte negative Ausgleichsposition (eindeutig identifiziert über `notiz: startsWith("Gutschrift " + nummer)`) aus der Ziel-Lieferung entfernt; bei Positionen mit `ruecknahme:true` wird der bei Erstellung gutgeschriebene Lagerzugang wieder zurückgebucht (neue `Lagerbewegung` vom Typ `ausgang`, analog zur Buchung beim Anlegen in `app/api/gutschriften/route.ts`). "Löschen"-Button in `app/gutschriften/[id]/page.tsx` und `app/gutschriften/page.tsx` nicht mehr auf `status === "OFFEN"` beschränkt; `confirm()`-Text nennt vorab explizit, welche Rechnung betroffen ist und ob Lagerware zurückgebucht wird |
| Stornierte Rechnung: die PDF (server-seitiger "E-Rechnung"-Export UND Bildschirm-Vorschau/client-seitiger "PDF"-Button) zeigte oben rechts weiterhin nur "Rechnung" als Titel — auch mit dem diagonalen STORNO-Wasserzeichen war der Storno-Charakter beim schnellen Überfliegen (z.B. schwarz-weiß-Kopie, kleine Vorschau) nicht auf den ersten Blick eindeutig | Titel-Text in `generiereRechnungPdf()` (`lib/pdfGenerator.ts`) sowie im HTML-Titel-Block auf `app/lieferungen/[id]/rechnung/page.tsx` war hart auf `"Rechnung"` verdrahtet, ohne `lieferung.rechnungStorniert` abzufragen | Titel zeigt bei `lieferung.rechnungStorniert` jetzt `"Stornorechnung"` statt `"Rechnung"` — an beiden Stellen (PDF + Vorschau), damit html2canvas-Export und echter Browserdruck automatisch mitziehen; `generiereRechnungPdfMitZugferd()` ruft intern `generiereRechnungPdf()` auf und übernimmt den Titel dadurch ohne eigene Änderung. Textbreite (14 statt 8 Zeichen) bei 20pt bold rechtsbündig geprüft — kollidiert nicht mit dem links stehenden Firmennamen |
| Artikel mit MwSt-Satz 0% (z.B. "Umsatzsteuerdifferenz"-Ausgleichsposition für eine steuerfreie Steuerrückerstattung) ließ sich im MwSt-Dropdown zwar auf 0% setzen, wurde beim Speichern aber stillschweigend wieder auf 19% zurückgesetzt — sowohl beim Bearbeiten eines bestehenden Artikels als auch beim Neuanlegen und beim Schnell-Anlegen aus der KI-Wareneingangserkennung | Klassischer Falsy-Zero-Bug: `mwstSatz: Number(form.mwstSatz) || 19` (bzw. `Number(editForm.mwstSatz) || 19` / `parseFloat(createForm.mwstSatz) || 19`) — `Number("0")` bzw. `parseFloat("0")` ergibt `0`, und `0` ist in JS falsy, wodurch der `\|\| 19`-Fallback fälschlich griff, obwohl der Nutzer bewusst 0% gewählt hatte. Das MwSt-Dropdown bietet ausschließlich die drei validen Werte 0/7/19 an, ein Fallback war dafür nie nötig | `app/artikel/neu/page.tsx` und `app/ki/wareneingang/page.tsx`: `\|\| 19`-Fallback ganz entfernt (Select liefert ohnehin immer einen gültigen String). `app/artikel/[id]/page.tsx`: auf `Number(editForm.mwstSatz ?? 19)` umgestellt (Fallback nur noch bei echtem `null`/`undefined`, nicht bei `0`) — Backend (`app/api/artikel/route.ts`, `app/api/artikel/[id]/route.ts`) prüfte bereits korrekt auf `!== undefined` und musste nicht angepasst werden |
| Änderung des MwSt-Satzes an einem Artikel-Stammdatensatz wirkte sich rückwirkend auf bereits gestellte (und sogar bereits per E-Mail versendete) Rechnungen aus — Rechnung/Lieferschein/Sammelrechnung/ZUGFeRD/DATEV-Export/UStVA lasen den Satz nie von der Position, sondern immer live vom aktuell verknüpften `Artikel.mwstSatz`. Steuerrechtlich unzulässig, sobald eine Rechnung verschickt wurde | `Lieferposition` friert `verkaufspreis`/`einkaufspreis` beim Anlegen ein, hatte für `mwstSatz` aber nie ein eigenes Feld — jede Berechnung (`p.artikel.mwstSatz ?? 19`) las den zum Anzeigezeitpunkt aktuellen Artikel-Satz statt eines historischen Schnappschusses | Neues Feld `Lieferposition.mwstSatz Float @default(19)`, eingefroren bei Positionserstellung (`erstelleLieferungMitPreisberechnung()`/`injiziereAlteForderungen()`/`injiziereOffeneGutschriften()` in `lib/lieferung.ts`, `POST /api/lieferungen/[id]/positionen`); Migration mit Backfill aus dem jeweils aktuellen `Artikel.mwstSatz` für Altbestand. Alle Verbraucher (Rechnung/Lieferschein/Sammelrechnung-PDF, ZUGFeRD, DATEV, UStVA, Mahnwesen, Bankabgleich, Rechnungsliste, Kundenmappe, E-Mail-Vorschautexte) auf `p.mwstSatz ?? p.artikel.mwstSatz ?? 19` umgestellt — zentral in `berechneLieferungBrutto()` (`lib/lieferung-brutto.ts`). Betrifft nur `Lieferposition`; `AngebotPosition`/`GutschriftPosition` haben (noch) kein eigenes Snapshot-Feld |
| Bereits per E-Mail versendete Rechnungen ließen sich über `POST/PATCH/DELETE /api/lieferungen/[id]/positionen(/[posId])` weiterhin beliebig verändern (Menge/Preis/Rabatt) — `PATCH` auf eine einzelne Position hatte überhaupt keine Sperrprüfung; zusätzlich konnte `aktion: rechnung_loeschen` `rechnungVersendetAm` stillschweigend auf `null` zurücksetzen und damit jede neue Sperre unterlaufen | Keine der Routen kannte `Lieferung.rechnungVersendetAm` als Sperrkriterium — nur der allgemeinere `status !== "geplant"`-Check existierte (deckt POST/DELETE meist ab, sobald `rechnung_erstellen` den Status auf "geliefert" setzt, aber eben nicht PATCH) | Alle drei Routen prüfen jetzt explizit `rechnungVersendetAm`; bei `PATCH` nur für betragsrelevante Felder (`verkaufspreis`/`einkaufspreis`/`menge`/`rabattProzent`) — `chargeNr`/`notiz` bleiben bewusst weiter editierbar (reine Dokumentation, siehe bestehender Kommentar dazu). `aktion: rechnung_loeschen` lehnt jetzt ab, wenn `rechnungVersendetAm` gesetzt ist (Verweis auf Storno + neue Rechnung als korrekten Korrekturweg). Frontend (`app/lieferungen/[id]/page.tsx`: `canEditMenge()`/`startRabattEdit()`, `app/lieferungen/[id]/rechnung/page.tsx`: "Löschen"-Button) entsprechend nachgezogen, damit keine UI mehr angeboten wird, die der Server ohnehin ablehnt. Storno bleibt unabhängig vom Versand-Status weiterhin möglich — das ist der vorgesehene Korrekturweg für bereits verschickte Rechnungen |
| Nach obigem Fix ließen sich einer Rechnung gar keine neuen Positionen mehr hinzufügen — auch nicht, solange sie noch gar nicht versendet war (Kundenwunsch war ausdrücklich, das weiterhin zu erlauben) | `POST /api/lieferungen/[id]/positionen` blockte weiterhin über den viel älteren, gröberen `status !== "geplant"`-Check — und `rechnung_erstellen` setzt den Status IMMER synchron auf "geliefert" (least Lagerausgang mit), sobald überhaupt eine Rechnungsnummer vergeben wird, unabhängig vom Versand. Damit war "Rechnung gestellt, aber noch nicht verschickt" nie als eigener, noch offener Zustand erreichbar | Sperrkriterium für POST von `status !== "geplant"` auf `rechnungVersendetAm` (plus separat `rechnungStorniert` — ein Rechnungs-Storno setzt `status` NICHT auf "storniert") umgestellt. Da bei bereits "geliefert"-Status der Lagerausgang für die übrigen Positionen schon gebucht ist und für eine neu ergänzte Position sonst nie nachgeholt würde, bucht die Route das jetzt selbst mit (inkl. `istChargeNrPflichtFuerLieferschein()`-Prüfung, `istStreckengeschaeft`-Ausnahme, `lagerBereitsGebucht:true`), alles in einer `$transaction`. Frontend: neue `canAddPos()` (`app/lieferungen/[id]/page.tsx`) ersetzt die feste `status === "geplant"`-Bedingung um "Artikel hinzufügen"; Hinweisbanner unterscheidet jetzt zwischen "Positionen sind gesperrt" und "Menge/Preis/Rabatt bestehender Positionen gesperrt, neue können noch ergänzt werden". `DELETE`/`PATCH` auf einzelne Positionen bewusst unverändert (nicht Teil dieser Anfrage, Rückbuchung beim Löschen einer bereits gebuchten Position wäre ein größerer, ungefragter Umbau) |
| Gutschrift per E-Mail versenden: der Button war da, der Kunde hatte eine E-Mail hinterlegt — trotzdem zeigte das Versand-Modal keine Adresse zur Auswahl an | `GET`/`PUT /api/gutschriften/[id]` luden den Kunden mit `include: { kunde: true }` — anders als z.B. `app/api/lieferungen/[id]/route.ts` (`kunde: { include: { kontakte: true } }`) liefert das NUR die Skalarfelder von `Kunde`, keine Relationen; `gutschrift.kunde.kontakte` war dadurch immer `undefined`, `EmailVersandModal`s `(gutschrift.kunde.kontakte ?? []).filter(...)` also immer eine leere Liste | Beide Stellen in `app/api/gutschriften/[id]/route.ts` auf `kunde: { include: { kontakte: true } }` umgestellt — dieselben Kontakte (inkl. der für den Rechnungsversand hinterlegten E-Mail-Adresse), die auch auf der Rechnungs-Druckseite im Versand-Modal erscheinen |
| Nach dem Fix "Positionen zu Rechnungen ergänzen, solange nicht versendet" (Zeile weiter oben) ließ sich eine versehentlich falsch erfasste Position (z.B. Fracht mit falschem MwSt-Satz-Artikel) nicht mehr löschen, sobald die Rechnung gestellt war — auch nicht solange sie noch unversendet war | `DELETE /api/lieferungen/[id]/positionen/[posId]` blockte weiterhin hart über `status !== "geplant"`, ohne Rücksicht auf `rechnungVersendetAm`/`rechnungStorniert` — anders als der zeitgleich für POST gefixte Fall war DELETE bewusst unangetastet gelassen worden (siehe Kommentar in der Zeile darüber), der Kundenwunsch, auch Löschen symmetrisch zu erlauben, kam erst danach | Sperrkriterium für DELETE analog zu POST von `status !== "geplant"` auf `rechnungVersendetAm`/`rechnungStorniert`/`status === "storniert"` umgestellt (dieselbe dreiteilige Prüfung, identischer Kommentartext). War die zu löschende Position bereits mit `lagerBereitsGebucht:true` abgebucht (Status schon "geliefert"), bucht die Route den Lagerausgang beim Löschen transaktional zurück (`typ:"eingang"`, analog zur Storno-Rückbuchung im PUT-Statuswechsel geliefert→storniert in `app/api/lieferungen/[id]/route.ts`), respektiert dabei `istStreckengeschaeft` und `istLagerrelevant()`. Frontend: `canAddPos()` (`app/lieferungen/[id]/page.tsx`) steuert jetzt auch die Löschen-Spalte/den Löschen-Button (vorher `status === "geplant"`) — kein separates `canDeletePos()` nötig, identische Bedingung; Hinweisbanner-Text ergänzt "…oder gelöscht werden" |
| Bankabgleich: ein Kunde hat dieselbe, bereits bezahlte Rechnung ein zweites Mal überwiesen (Doppelzahlung) — keine Möglichkeit, den zweiten Kontoumsatz irgendeiner Rechnung zuzuordnen oder daraus eine Gutschrift zu erstellen, die per Überweisung zurückerstattet wird | Jede Kandidatensuche in `lib/bankabgleich-kandidaten.ts` (Zuordnungsvorschläge UND "Andere Rechnung suchen") filtert konsequent `bezahltAm: null` — die schon durch die ERSTE Zahlung beglichene Rechnung taucht als Ziel dadurch nirgends mehr auf, egal wonach gesucht wird. Selbst wenn man sie zuordnen könnte, würde eine normale OFFEN-Gutschrift automatisch in die nächste Rechnung des Kunden verrechnet (`injiziereOffeneGutschriften()`) — bei einer tatsächlich per Überweisung zurückgezahlten Doppelzahlung wäre das eine Doppel-Gutschrift | Neuer, bewusst eigenständiger Endpunkt `GET /api/bankabgleich/doppelzahlung-suche` sucht OHNE den `bezahltAm`-Filter (nicht an der geteilten Kandidaten-Suche geändert, die von Massen-Abgleich/normalen Vorschlägen genutzt wird). `POST /api/bankabgleich/[id]/doppelzahlung` wandelt den Kontoumsatz in eine Gutschrift um (`erstelleDoppelzahlungsGutschrift()` in neuem `lib/gutschrift.ts`, grund "Doppelzahlung"); neuer Gutschrift-Status **ERSTATTET** (modus "erstatten") wird bewusst NICHT von `injiziereOffeneGutschriften()` erfasst (die filtert nur `status:"OFFEN"`) — verhindert die Doppel-Gutschrift bei tatsächlicher Rücküberweisung; alternativ modus "verrechnen" legt eine normale OFFEN-Gutschrift an. Neues Feld `Kontoumsatz.gutschriftId` (weiche ID wie `lieferungId`/`sammelrechnungId`) verknüpft Zuordnung↔Gutschrift; `loescheGutschriftMitNebenwirkungen()` (aus der bestehenden `DELETE /api/gutschriften/[id]`-Logik extrahiert, jetzt geteilt) macht beim normalen "Zuordnung aufheben" (`DELETE /api/bankabgleich/[id]`) UND beim direkten Löschen über `/gutschriften` alle Nebenwirkungen rückgängig, inkl. Zurücksetzen des verknüpften Kontoumsatzes auf offen. Neues Panel `DoppelzahlungPanel` ("Kunde hat diese Zahlung doppelt überwiesen?"-Toggle unterhalb der normalen Zuordnungsvorschläge in `/bankabgleich`) — Suche findet gezielt auch bereits bezahlte Rechnungen (mit "✓ bereits bezahlt"-Badge), Radio-Auswahl Erstatten/Verrechnen. End-to-end mit echten API-Aufrufen verifiziert: Doppelzahlung→ERSTATTET-Gutschrift wird NICHT in nächste Rechnung verrechnet; Doppelzahlung→OFFEN-Gutschrift WIRD verrechnet (Status springt auf VERBUCHT); Aufheben über beide Lösch-Pfade setzt Kontoumsatz korrekt zurück und entfernt eine ggf. bereits verbuchte Ausgleichsposition wieder |
| Bankabgleich "Automatischer Abgleich": eine per Post (nicht per E-Mail) verschickte Rechnung wurde ohne jede Abweichungs-Warnung als "Hohe Übereinstimmung" gegen die eingegangene Zahlung gematcht, obwohl der tatsächlich gedruckte/verschickte Rechnungsbetrag nicht mehr mit dem heute im System berechneten Betrag übereinstimmte — Positionen konnten nach dem Ausdrucken unbemerkt weiter bearbeitet werden | `rechnungVersendetAm` (die Positions-Sperre, siehe Zeilen weiter oben zu "Positionen zu Rechnungen ergänzen"/"…löschen") wurde bisher AUSSCHLIESSLICH automatisch beim E-Mail-Versand gesetzt (`POST /api/exporte/rechnung/mail`) — für auf Papier gedruckte und per Post verschickte Rechnungen gab es keinerlei Trigger dafür, sie blieben also nach dem Ausdrucken komplett unversperrt bearbeitbar, ohne dass das System das bemerkt oder verhindert hätte. Der Bankabgleich vergleicht dabei immer nur den *aktuell live berechneten* Rechnungsbetrag (`berechneLieferungBrutto()`) gegen den Bankbetrag — es gibt keinen separat gespeicherten "Betrag zum Zeitpunkt des Versands", eine nachträgliche Änderung ist dadurch für den Matcher unsichtbar | Neue manuelle Aktion `PATCH {aktion:"rechnung_postversand_markieren"}` (`app/api/lieferungen/[id]/route.ts`) setzt bewusst dasselbe `rechnungVersendetAm` wie der E-Mail-Versand — sämtliche bestehenden Sperr-Checks (POST/PATCH/DELETE `/positionen`, `rechnung_loeschen`) greifen dadurch ohne jede Codeänderung an diesen Stellen automatisch auch für per Post versendete Rechnungen. Neues Feld `Lieferung.rechnungVersandKanal` ("email"\|"post", rein informativ) unterscheidet nur die Anzeige ("Per E-Mail versendet" vs. "Per Post versendet" auf `/lieferungen/[id]/rechnung`); alte Datensätze bleiben `null` und zeigen weiterhin "Per E-Mail versendet". Neuer Button "Als per Post versendet markieren" neben dem "E-Mail"-Button. Fehlermeldungen der Sperr-Checks von "…bereits per E-Mail versendet…" auf kanal-neutral "…bereits versendet…" umgestellt (waren sonst für postalisch versendete Rechnungen sachlich falsch); "Noch nicht versendet"-Tooltips in `/lieferungen` und `/rechnungen` ebenfalls kanal-neutral formuliert. `lieferscheinVersendetAm` bewusst NICHT angefasst — bleibt rein E-Mail-spezifisch, kein Post-Pendant angefragt |
| Bankabgleich: bei einer Sammelüberweisung, deren Verwendungszweck mehrere Rechnungsnummern nennt (z.B. "Rechnungen 0497+0583+0584+0553"), tauchte eine der referenzierten — noch offenen, nicht bezahlten — Rechnungen in den automatischen Zuordnungsvorschlägen gar nicht erst auf, obwohl die anderen drei korrekt erkannt wurden | Derselbe 300er-Kandidaten-Deckel wie beim früheren "Andere Rechnung suchen"-Bug (siehe Zeile weiter oben zu `sucheKandidatenFuerBetrag`) — der war damals NUR für die manuelle `q=`-Suche gefixt worden. Die automatischen Vorschläge (`GET /api/bankabgleich/vorschlaege` ohne `q`) laden weiterhin ungefixt über `ladeKandidatenFuerBetrag()` (max. 300 offene Rechnungen nach `rechnungDatum desc`) und ranken nur innerhalb dieses Pools — eine ältere offene Rechnung, die zufällig außerhalb der 300 neuesten liegt, kann dadurch gar nicht erst in die Rangliste gelangen, selbst wenn ihre Nummer im Verwendungszweck eindeutig referenziert ist und `receiptNumberHit()` ihr eigentlich einen hohen Score geben würde | Neue `extractRechnungsnummerKandidaten()` in `lib/bankabgleich-matching.ts` — Umkehrung von `receiptNumberHit()`: extrahiert alle wie Rechnungsnummern aussehenden Zahlen-Tokens aus dem Verwendungszweck (bare Jahreszahlen wie "2026" ausgeschlossen, zu unspezifisch). `GET /api/bankabgleich/vorschlaege` (Zweig ohne `q`) sucht für jedes gefundene Token zusätzlich per bereits vorhandenem, uncapped `sucheKandidatenFuerBetrag()` direkt in der DB und mischt neue Treffer (dedupliziert) zur normalen Top-8-Rangliste hinzu, statt sie zu ersetzen. End-to-end mit künstlich 305 "Füll"-Rechnungen verifiziert: eine absichtlich weit außerhalb der 300 neuesten platzierte, im Verwendungszweck referenzierte Rechnung erscheint jetzt korrekt als zusätzlicher Vorschlag |
| Mahnwesen: E-Mail-Versand-Modal ("Mahnung ... versenden") zeigte das "An"-Feld leer, obwohl beim Kunden eine E-Mail-Adresse hinterlegt war | `GET /api/mahnwesen` lud `kontakte` mit `select: { wert: true }` (nur den Wert, kein `typ`) — das Frontend (`app/mahnwesen/page.tsx`) filtert die geladenen Kontakte aber zusätzlich per `.filter(k => k.typ === "email")`, bevor es sie ans `EmailVersandModal` übergibt; da `typ` nie mitgeladen wurde, war es bei jedem Kontakt `undefined`, der Filter griff also NIE — `emailKontakte` war dadurch immer leer, unabhängig vom serverseitigen `where:{typ:"email"}`-Filter, der die Kontakte selbst korrekt vorselektierte. Zusätzlich fehlte `rechnungsEmail`, wodurch selbst nach einem reinen Typo-Fix die für Mahnungen vorgesehene Vorauswahl-Logik (`bestEmail()` in `EmailVersandModal.tsx`, bevorzugt eine als `rechnungsEmail` markierte Adresse) ins Leere gelaufen wäre; `take:1` begrenzte zudem auf höchstens eine E-Mail-Adresse, obwohl das Modal eine Auswahl aus mehreren anbietet | `kontakte`-Select in `app/api/mahnwesen/route.ts` von `{ where:{typ:"email"}, select:{wert:true}, take:1 }` auf `{ where:{typ:"email"} }` (voller Kontakt-Datensatz, kein Limit) umgestellt — liefert damit exakt die Felder, die `app/mahnwesen/page.tsx` und `EmailVersandModal` bereits erwarten, ohne dass an deren TypeScript-Interfaces etwas geändert werden musste |
| Mahnwesen: der Text der Mahnungs-E-Mail (`POST /api/exporte/mahnung/mail`) war komplett anders formuliert als der Brieftext der PDF (`generiereMahnungPdf`) — unterschiedliche Absätze je Mahnstufe (die E-Mail kannte sogar eine nie erreichbare `mahnstufe >= 4`-Variante), keine Mahngebühr-/Verzugszinsen-/Gesamtforderung-Aufstellung in der Mail (nur in der PDF), und selbst nach Angleichung der Formulierung wären Datumsangaben weiterhin unterschiedlich formatiert gewesen ("5.1.2026" in der PDF vs. "05.01.2026" in der Mail) | Beide Kanäle hatten ihren Brieftext komplett unabhängig voneinander hart codiert — `generiereMahnungPdf()` in `lib/pdfGenerator.ts` und `mahnungEmail()` in `lib/email-templates.ts` teilten sich keine gemeinsame Textquelle; die Mail-Route berechnete zudem `mahngebuehr`/`verzugszinsen`/`tageUeberfaellig` nie und übergab sie folglich auch nicht an `mahnungEmail()`. Für das Datum nutzte die PDF `formatDatum()` aus `lib/utils.ts` (ungepolstert), die Mail einen lokalen `fmtDatum()` mit `{year:"numeric",month:"2-digit",day:"2-digit"}` (gepolstert) | Neue `mahnungTextBausteine()` + `MAHNUNG_BETREFF` in `lib/mahnwesen-config.ts` (bereits client-sicher, dort saß schon `berechneVerzugszinsen()`/`mahngebuehr()`) sind jetzt die alleinige Quelle für Anrede+Absätze je Mahnstufe — `generiereMahnungPdf()` UND `mahnungEmail()` rufen exakt dieselbe Funktion auf, die alte lokale `MAHNSTUFEN_TEXT`-Konstante in `email-templates.ts` wurde entfernt. `MahnungMailData` um `tageUeberfaellig`/`mahngebuehr`/`verzugszinsen`/`ansprechpartnerName` erweitert; `app/api/exporte/mahnung/mail/route.ts` berechnet diese jetzt identisch zur PDF-Route (`parseMahnwesenConfig`+`mahngebuehr`+`berechneVerzugszinsen` aus `system.mahnwesen`) und setzt den Ansprechpartner auf den aktuell angemeldeten Benutzer (`getCurrentUser()`, analog zum "Ihr Ansprechpartner"-Feld der PDF) statt der bisherigen, jetzt entfernten Kontakt-basierten Anrede-Personalisierung. Die Mail zeigt Mahngebühr/Verzugszinsen/Gesamtforderung jetzt genauso wie die PDF nur bei Werten > 0. Datums-Mismatch behoben, indem `mahnungEmail()` gezielt `formatDatum` aus `@/lib/utils` importiert (als `formatDatumWiePdf`) — bewusst NUR dort, die unabhängigen `fmtDatum`/`fmtEuro`-Helfer der übrigen Templates (Rechnung/Angebot/Gutschrift/Lieferschein) in derselben Datei bleiben unverändert. Verifiziert per PDF-Download + `pdfjs-dist`-Textextraktion gegen den tatsächlichen `mahnungEmail()`-Output: Text stimmt zeichengenau überein (Absätze, Daten, Beträge, Zahlungssatz, Unterschrift) |
| Jeder "Lieferant hinzufügen"/EK-Inline-Edit/Bevorzugt-Toggle auf der Artikel-Detailseite löschte STILLSCHWEIGEND sämtliche `ArtikelLieferantJahrespreis`- (und potenziell künftige Preisverlauf-)Einträge ALLER Lieferanten dieses Artikels — reproduzierbar bei jeder einzelnen dieser drei Aktionen, nicht nur beim direkt bearbeiteten Lieferanten | `PUT /api/artikel/[id]` ersetzte die komplette `lieferanten`-Relation immer per `deleteMany: {} + create: lieferanten` (volle Ersetzung), sobald `lieferanten` im Body vorhanden war — das Frontend (`addLieferant()`/`toggleBevorzugt()`/`saveEditEk()` in `app/artikel/[id]/page.tsx`) sendet dafür IMMER die volle aktuelle Lieferantenliste, auch wenn nur ein Feld eines einzigen Lieferanten geändert wurde. `deleteMany` löschte dadurch jede Zeile (auch unveränderte) und `create` legte sie mit neuer autoincrement-ID neu an; `ArtikelLieferantJahrespreis.artikelLieferantId` hat `onDelete: Cascade` — verwaist damit bei jedem Zyklus komplett, unabhängig davon, welcher Lieferant tatsächlich bearbeitet wurde. Per Prisma-Testskript gegen die echte DB reproduziert, bevor der Fix geschrieben wurde | `PUT /api/artikel/[id]` (`app/api/artikel/[id]/route.ts`) ersetzt `lieferanten` nicht mehr per `deleteMany+create`, sondern diffed innerhalb derselben `$transaction` per `lieferantId` gegen die bestehenden `ArtikelLieferant`-Zeilen: unverändert vorhandene werden per `update` in-place geändert (ID bleibt erhalten, Jahrespreise/Preisverlauf überleben), neue werden angelegt, im Payload fehlende entfernt (dort ist die Cascade-Löschung korrekt, weil der Lieferant tatsächlich entfernt wurde). End-to-end gegen die echte DB verifiziert: EK-Inline-Edit + gleichzeitiges Hinzufügen eines zweiten Lieferanten lässt Jahrespreise UND Preisverlauf-Einträge des ersten Lieferanten unangetastet, `ArtikelLieferant.id` bleibt stabil |
| Häufige saisonale Einkaufspreis-Änderungen ließen sich nur grob je Kalenderjahr erfassen (`ArtikelLieferantJahrespreis`) — für "der EK hat sich im März geändert und nochmal im Juni" gab es keine datumsgenaue Erfassung, und keine Möglichkeit, bei mehreren Preisen desselben Lieferanten explizit auszuwählen, welcher gerade gilt | Kundenwunsch nach feinerer Granularität als Jahresgültigkeit, mit expliziter manueller Auswahl statt automatischer Nächstjahr-Interpolation | Neues Modell `ArtikelLieferantPreis` (Migration `20260827110000_artikel_lieferant_preisverlauf`): beliebig viele datierte Preise je Lieferant, keine automatische Auflösung — der Nutzer markiert genau EINEN Eintrag per Radio-Button als `aktiv`. `setAktiverEinkaufspreis()` (`lib/einkaufspreisverlauf.ts`) deaktiviert dabei alle anderen Einträge und synct sofort `ArtikelLieferant.einkaufspreis` (Single Source of Truth für Lieferungen/Kalkulation/Artikelliste/Bestellvorschlag). Da Jahrespreise UND Preisverlauf denselben Skalar schreiben, hat ein aktiver Preisverlauf-Eintrag Vorrang: `syncEinkaufspreis()` (`lib/jahrespreis.ts`) prüft per `hatAktivenEinkaufspreis()` zuerst, ob ein Preisverlauf-Eintrag aktiv ist, und bricht dann ab — sonst hätte z.B. das Löschen eines Jahrespreises einen bewusst gewählten Preisverlauf-Preis überschrieben. Löschen des aktiven Eintrags aktiviert NICHT automatisch einen anderen (bewusst explizit, kein interpolierender Ersatz wie bei Jahrespreisen) — `ArtikelLieferant.einkaufspreis` behält einfach seinen letzten Wert. Neue Routen unter `/api/artikel/[id]/lieferanten/[lieferantId]/einkaufspreise(/[preisId])`, neue Komponente `EinkaufspreisVerlaufManager.tsx`, eingebunden im (von "Jahre" auf "Preise" umbenannten) Aufklapp-Bereich der Lieferanten-Tabelle in `/artikel/[id]` oberhalb der bestehenden Jahresgültigkeiten. End-to-end über die echte API + Playwright-Screenshot verifiziert: Aktivieren eines neuen Eintrags aktualisiert EK-Spalte und Marge-KPI sofort |
| Skonto war bei Lieferung/Sammelrechnung erfassbar (`Lieferung.skontoProzent`/`skontoTage`, Skonto-Abschnitt auf `/lieferungen/[id]`), tauchte aber NIRGENDS im tatsächlichen Rechnungstext auf — weder in der Bildschirm-/PDF-Vorschau noch im server-seitigen "E-Rechnung"-PDF (`generiereRechnungPdf`) | `app/lieferungen/[id]/rechnung/page.tsx` und `lib/pdfGenerator.ts` kannten `skontoProzent`/`skontoTage` überhaupt nicht — die "Zahlungsinformationen"-Box zeigte ausschließlich den vollen Fälligkeitssatz, keine Skonto-Zeile | Beide Stellen berechnen jetzt einen Skonto-Satz ("Bei Zahlung bis zum … gewähren wir X% Skonto (Y €).", Frist = Rechnungsdatum + `skontoTage`, Betrag = Brutto × `skontoProzent`/100 — identische Basis wie der bestehende Skonto-Abschnitt auf der Lieferungs-Detailseite) und zeigen ihn nur, wenn beide Felder gepflegt sind. In `generiereRechnungPdf()` wird die Zahlungsinformationen-Box dafür NICHT mehr mit fixer Höhe (`boxH = 32`) gezeichnet, sondern GiroCode-Bilddaten + alle Textzeilen (Zahlungssatz, Skonto-Satz, Bank) werden vorab ermittelt und die Boxhöhe daraus berechnet — sonst hätte die zusätzliche Skonto-Zeile bei fixer Höhe über den Rahmen hinausgelaufen. `generiereRechnungPdfMitZugferd()` ruft intern `generiereRechnungPdf()` auf und übernimmt die Änderung ohne eigene Anpassung. Verifiziert per echtem PDF-Download + Textextraktion UND Playwright-Screenshot der Bildschirm-Vorschau: beide zeigen identisch "Bei Zahlung bis zum 6.9.2026 gewähren wir 2% Skonto (23,80 €)." bei einer 1.190€-Rechnung mit 2%/10 Tage |
| Bankabgleich erkannte eine legitime Skonto-Zahlung (Kunde überweist absichtlich weniger als den Rechnungsbetrag) nicht als solche — der reduzierte Betrag erschien wie ein Fehlbetrag: schwache/keine Zuordnungsvorschläge, "Abweichung"-Warnung, ein anklickbarer "+ Forderung erfassen"-Button hätte fälschlich eine `KundeForderung` über die Skonto-Differenz angelegt | `ReconCandidate`/`rankCandidatesForBank()`/`runNormalMatch()` (`lib/bankabgleich-matching.ts`) kannten nur den vollen Rechnungsbetrag — ein Skonto-reduzierter Zahlungsbetrag hätte selbst bei exakter Übereinstimmung nie Pass 1 (Toleranz 0,005€) und meist auch nicht Pass 2 (Standardtoleranz 0,50€) erreicht, sondern wäre als `deviation`/`bankOnly` gelandet | Neues optionales Feld `ReconCandidate.skontoAmount` (Brutto × (1 − `skontoProzent`/100)), von `lib/bankabgleich-kandidaten.ts` für Lieferung/Sammelrechnung-Kandidaten mitgeliefert (Skonto-Tage spielen bewusst keine Rolle — der Abgleich soll die Zahlung erkennen, nicht die Frist durchsetzen). Neue zentrale `bestimmeBetragsabweichung()` nutzt bei einem Kandidaten mit `skontoAmount` automatisch den näher liegenden der beiden möglichen Beträge (`amountDiff`) und markiert `skontoMatch:true` NUR, wenn dieser Betrag tatsächlich plausibel nah am Skonto-Betrag liegt (≤1€, nicht bloß "näher als der volle Betrag" — sonst hätte z.B. eine winzige, weit entfernte Teilzahlung fälschlich als Skonto-Treffer gegolten). Ersetzt alle direkten `Math.abs(candidate.amount - bankAmount)`-Vorkommen in `rankCandidatesForBank()`, `runNormalMatch()` (beide Pässe + `mergeAiMatches`), `hintScore()`/`computeBankHints()`/`computeCandidateHints()` sowie den beiden Ad-hoc-Stellen in `app/api/bankabgleich/vorschlaege/route.ts`. `skontoMatch` wird bis in `ZuordnungsVorschlagCard.tsx` durchgereicht (Inline-Panel `/bankabgleich` UND "Automatischer Abgleich"-Bulk-Review über `AutoMatchKarte.tsx`): zeigt statt der amber "Abweichung"-Warnung einen grünen "✓ entspricht Skonto"-Hinweis und unterdrückt den "+ Forderung erfassen"-Button. Serverseitig setzt `markiereSkontoGenutztFallsPassend()` (`lib/bankabgleich-differenz.ts`, `PUT /api/bankabgleich/[id]`) automatisch `Lieferung.skontoGenutzt`/`Sammelrechnung.skontoGenutzt`, sobald der zugeordnete Bankbetrag dem Skonto-Betrag entspricht (`istSkontoBetrag()`, 0,50€ Toleranz) — unabhängig davon, ob zusätzlich eine Differenzbuchung angefordert wurde. Als Schutz vor einer versehentlichen Forderung lehnt `erfasseBankabgleichDifferenz()` `art:"forderung"` mit einem erklärenden 400-Fehler ab, wenn die Abweichung dem Skonto entspricht (Defense-in-Depth zusätzlich zur UI-Ausblendung). End-to-end gegen die echte API verifiziert: Skonto-Zahlung wird mit `konfidenz:"hoch"`/`amountDiff:0` vorgeschlagen, Zuordnen setzt `bezahltAm` UND `skontoGenutzt` ohne Forderung, ein expliziter Forderung-Versuch wird abgelehnt, ein echter (nicht-Skonto-) Fehlbetrag erzeugt weiterhin normal eine Forderung |
| Artikelsuche (Artikelliste `/artikel`, Fallback-Zweig der globalen Suche `/api/suche` falls FTS5 nicht verfügbar) fand einen Artikel oft nur bei EXAKTER Groß-/Kleinschreibung — z.B. "Ölrettich" wurde bei Suche nach "ölrettich" (kleines ö) nicht gefunden, obwohl der Rest des Wortes (ASCII) bereits case-insensitiv funktionierte | SQLites LIKE-Operator (Basis von Prisma `contains` auf SQLite) faltet Groß-/Kleinschreibung nur für ASCII-Buchstaben (a–z) — deutsche Umlaute (ä/ö/ü) bleiben case-sensitiv. Per Prisma-Testskript gegen die echte DB verifiziert, bevor der Fix geschrieben wurde. Die primäre FTS5-basierte globale Suche (`unicode61`-Tokenizer) war davon NICHT betroffen — deren Case-Folding ist bereits Unicode-aware, verifiziert per Roh-FTS5-Testtabelle | Neue `umlautSchreibweisen()` in `lib/utils.ts`: erzeugt alle Groß-/Klein-Kombinationen der im Suchbegriff enthaltenen Umlaute (z.B. "ölrettich" → `["ölrettich","Ölrettich"]`), begrenzt auf 6 Umlaute gegen kombinatorische Explosion. `GET /api/artikel` (`where.OR`) und der FTS5-Fallback-Zweig in `GET /api/suche` bilden daraus einen `flatMap`-OR-Filter statt eines einzelnen `contains`. Bewusst NUR für Artikel-Suche gefixt (wie angefragt) — dieselbe Einschränkung besteht theoretisch auch bei anderen `contains`-Suchen (Kunden etc.), dort aber nicht angefasst. End-to-end gegen die echte API verifiziert: "ölrettich"/"Ö"/"öl" finden jetzt korrekt "Ölrettich Gelbsenf Mischung"; ein unpassender Suchbegriff liefert weiterhin 0 Treffer; Kombination mit anderen Filtern (z.B. `kategorie`) bleibt korrekt UND-verknüpft |
| Der EK (Einkaufspreis) wurde in den Bestellungen/Bestellliste häufig nicht angezeigt (0,00 €), obwohl er in den Artikel-Stammdaten bei einem Lieferanten gepflegt war — betraf mehrere unabhängige Stellen im gesamten Bestell-Workflow, nicht nur eine | Derselbe Bug-Typ wie der ältere "erster Lieferant statt tatsächlich gepflegtem EK"-Fix (siehe Zeilen weiter oben zu `resolveBevorzugtenLieferanten()`), aber diesmal NICHT beim ursprünglichen Rollout in `lib/utils.ts`-Konsumenten mitgezogen — steckte unabhängig an 6 Stellen: (1) `lib/bestellvorschlag-lieferant.ts` `gewaehlt = bevorzugt ?? guenstigste ?? aktive[0]` — `bevorzugt` gewann IMMER, auch mit `einkaufspreis:0`, nie der tatsächlich günstigste Lieferant mit Preis; (2) `app/api/einkaufszettel/route.ts` sortierte nur `bevorzugt desc, id asc` und nahm den ersten Treffer je Artikel ohne Preis-Check; (3) `app/api/prognose/route.ts` lud die `lieferanten`-Relation direkt mit `where:{bevorzugt:true}` (kein anderer Lieferant überhaupt geladen) und griff dann `a.lieferanten[0]`; (4) `app/api/bestellliste/[id]/route.ts` überschrieb beim Umschlüsseln auf einen anderen Lieferanten `einkaufspreis` bedingungslos, auch mit 0; (5) `app/api/bestellungen/[id]/umschluesseln/route.ts` nutzte `zuordnung?.einkaufspreis ?? position.preis` — `??` fängt nur null/undefined ab, nicht die 0 aus `ArtikelLieferant.einkaufspreis Float @default(0)`, wodurch Umschlüsseln auf einen Lieferanten ohne EK den bekannten alten Preis überschrieb statt ihn beizubehalten; (6) `app/bestellungen/neu/page.tsx` löste den EK zwar korrekt für den gewählten Lieferanten auf, aber nur beim Ändern des Artikel-Felds — wählte man (der natürlichere Workflow) erst die Artikel und danach/später den Lieferanten, blieb der EK der bereits gewählten Positionen leer | (1) `bevorzugt`-Priorität nur noch bei `einkaufspreis > 0`, sonst Fallback auf den günstigsten/ersten (Cheapest-Sortierung bewusst beibehalten, nicht durch den generischen Helper ersetzt). (2) Zuordnungen nach `artikelId` gruppiert und je Gruppe `resolveBevorzugtenLieferanten()` (`lib/utils.ts`) angewandt. (3) `where:{bevorzugt:true}`-Filter entfernt (lädt jetzt alle Lieferanten), `resolveBevorzugtenLieferanten()` statt `a.lieferanten[0]`. (4) Überschreiben nur noch bei `zuordnung.einkaufspreis > 0`. (5) `??` durch expliziten `> 0`-Check ersetzt (`neuerEk = zuordnung && zuordnung.einkaufspreis > 0 ? zuordnung.einkaufspreis : null`), sowohl für die neu angelegte Position als auch für den mitgezogenen `Bestellposition`-Eintrag (dort `undefined` statt 0 wenn kein neuer Preis, damit das Feld bei `updateMany` unangetastet bleibt). (6) Neuer `useEffect` auf `lieferantId` (+ `artikel`), der den EK aller bereits gewählten Positionen bei jedem Lieferantenwechsel neu auflöst; zusätzlich `> 0`-Check statt `!= null`, damit ein ungepflegter Preis (0) das Feld nicht mit sichtbarem "0" befüllt. Neue Unit-Tests für `resolveBevorzugtenLieferanten()`/`resolveBevorzugtenEK()` (vorher trotz zentraler Rolle ungetestet) sowie End-to-end-Verifikation aller 6 Stellen gegen die echte API/DB (inkl. Playwright für die Formular-Reaktivität in `bestellungen/neu`) |
| Rechnungs-Bildschirmvorschau (`/lieferungen/[id]/rechnung`): bei einer automatisch injizierten Ausgleichsposition (Gutschrift-Verrechnung/Alte Forderung, `einheit: "Pauschale"`) lief der Text der Einheit-Spalte ohne Leerzeichen direkt in die Einzelpreis-Spalte hinein ("Pauschale189,00 €") | Die Positionstabelle nutzt `table-layout: fixed` mit prozentualen Spaltenbreiten (einzige Seite im Projekt mit `table-layout:fixed`, siehe `lib/*.ts`-Modul-Liste an anderer Stelle nicht einschlägig) — die Einheit-Spalte ist mit 9 % (~17 mm) bewusst schmal für kurze Einheiten wie "kg"/"Stück" bemessen. `"Pauschale"` (9 Zeichen, kein Leerzeichen) hat keine Umbruchstelle; ohne `overflow-wrap` lässt der Browser ein einzelnes zu breites Wort einfach visuell über die Zellgrenze hinauslaufen statt es zu clippen. Die Charge-Spalte hatte für genau dieses Problem längst `wordBreak: "break-all"`, die Einheit-Spalte (und die Artikel-Zelle mit Kategorie/Name/Notiz) aber nicht | `overflowWrap: "anywhere"` auf die Einheit-`<td>` ergänzt (bricht "Pauschale" bei Bedarf mitten im Wort um, wie es die Charge-Spalte bereits vormacht) sowie defensiv auch auf die Artikel-`<td>` (Kategorie/Name/Notiz-Zeilen, z.B. lange automatisch generierte Notizen wie "Gutschrift GS-2026-0016: Sonstiges" oder lange Artikelnamen) — beide Zellen sind auf dieselbe schmale, feste Spaltenbreite angewiesen. Nur diese eine Seite betroffen (`lib/pdfGenerator.ts`s echter PDF-Export nutzt `jspdf-autotable`, das Zellinhalte bereits korrekt anhand der `cellWidth` umbricht; die Lieferschein-Seite hat keine `table-layout:fixed`-Spaltenbreiten und ist von diesem Bug-Mechanismus nicht betroffen). End-to-end nachgestellt (Gutschrift → Rechnung mit injizierter Gutschrift-Verrechnung-Position) und per Playwright-Screenshot verifiziert: "Pauschale" bricht jetzt sauber innerhalb seiner Spalte um, kein Überlappen mit dem Preis mehr |
| Lieferungsliste (`/lieferungen`): die Spalte "Positionen" zeigte nur die reine Anzahl der Positionen (`l.positionen.length`) — um zu sehen, WELCHE Artikel in einem Auftrag stecken, musste man jeden einzelnen Auftrag öffnen. Erste Version zeigte die Artikelnamen nur in dieser Spalte, die `hidden md:table-cell` ist — auf dem Handy (< 768px) blieb die Liste dadurch komplett unsichtbar, obwohl der Anwendungsfall (schneller Überblick ohne Klick) dort mindestens genauso relevant ist | Kundenwunsch: Übersicht ohne Klick-durch-jeden-Auftrag | Zelle zeigt jetzt die Artikelnamen aller Positionen (kommagetrennt) statt der Anzahl — `l.positionen` enthielt `artikel.name` bereits im Fetch, keine neue API nötig. Einzeiliges `truncate` (Tailwind: `overflow:hidden`+`text-overflow:ellipsis`+`white-space:nowrap`) mit `title`-Tooltip für die vollständige Liste bei vielen/langen Namen — kein Layoutumbau, da diese Tabelle (anders als die Rechnungsvorschau, siehe Zeile darüber) kein `table-layout:fixed` nutzt. Bewusst nur die Namen, keine Mengen/Preise (Spalte bleibt kompakt, Details bleiben einen Klick entfernt). Zusätzlich `md:hidden`-Unterzeile unter dem Kundennamen (gleiches Muster wie der bestehende `sm:hidden`-Umsatz-Zusatz direkt darüber), damit die Artikelliste auch auf dem Handy sichtbar ist, wo die Positionen-Spalte selbst ausgeblendet bleibt. End-to-end verifiziert (Desktop-Tabellenspalte UND mobiler Viewport 390px): Lieferung mit 3 Artikeln zeigt "Knaulgras (Dactylis glomerata), W…" mit vollem Namen dreier Artikel im Hover-Tooltip bzw. als Mobile-Unterzeile |
| Mengenrabatt (Mengenstaffeln) hatte zwar ein Datenmodell + Verwaltungs-UI (`/mengenrabatte`), wurde aber bei der manuellen Lieferungserfassung (`/lieferungen/neu`, der Hauptweg Aufträge zu erfassen) NIE angewendet — Eingabe der Menge zog nie automatisch den dafür hinterlegten Preis; schlimmer noch, WÄRE serverseitig sogar ein zweites Mal auf den vom Formular bereits übernommenen Preis angewendet worden, da `erstelleLieferungTransaktion()` den Mengenrabatt unabhängig davon berechnete, ob der Aufrufer schon einen `verkaufspreis` mitgab | `app/lieferungen/neu/page.tsx` setzte `verkaufspreis` nur einmalig beim Artikel-Wechsel (`berechneVerkaufspreis()`, nur Sonderpreis-bewusst) und sendete IMMER einen expliziten Preis ans `POST /api/lieferungen` — der serverseitige `pos.verkaufspreis ?? berechneVerkaufspreis(...)`-Fallback in `lib/lieferung.ts` griff dadurch nie, wendete den passenden Mengenrabatt aber TROTZDEM bedingungslos auf `basisVerkaufspreis` an (egal ob die Basis vom Aufrufer kam oder selbst berechnet wurde) — ein bei Gelegenheit potenzieller Doppel-Rabatt-Bug, der nur deshalb nie auffiel, weil das Feature in der UI schlicht unsichtbar war. Zusätzlich wollte der Kunde statt Prozent-Rabatt lieber direkt einen absoluten Staffelpreis je Menge hinterlegen ("ab X Stück Y €"), da das näher an der tatsächlichen Preisverhandlung ist als ein Rabattsatz | Neue Helper `bestMengenstaffel()`/`wendeMengenstaffelAn()`/`effektiverMengenstaffelRabatt()` in `lib/utils.ts` — einzige Quelle der Wahrheit für die Staffel-Auswahl (höchste erreichte `vonMenge`-Schwelle gewinnt, bei Gleichstand eine kundenspezifische vor einer allgemeingültigen; NICHT mehr "höchster Rabattsatz gewinnt" wie in der allerersten Version dieses Fixes, da bei absoluten Preisen "höher" keine sinnvolle Ordnung mehr ist), von Client (`app/lieferungen/neu/page.tsx`, Live-Vorschau bei Artikel-/Mengenänderung) UND Server (`erstelleLieferungTransaktion()` in `lib/lieferung.ts`, nur als Fallback ohne clientseitigen Preis, z.B. KI-Batch-Erkennung) genutzt. Neues Feld `Mengenrabatt.preis Float?` (Migration `20260828160000_mengenrabatt_absoluter_preis`) als primäre Eingabeart; `rabattProzent Float @default(0)` bleibt als Legacy-Pfad für vor der Umstellung angelegte prozentbasierte Staffeln bestehen (`wendeMengenstaffelAn()` fällt darauf zurück, wenn `preis` null ist). Den doppelten Rabatt verhindert `LieferungPositionInput.verkaufspreis`: ist er vom Aufrufer explizit gesetzt, gilt er als bereits final und wird NICHT nochmal rabattiert — das Frontend sendet zusätzlich das berechnete `rabattProzent` separat mit (nur zur Anzeige in der Rabatt-Spalte auf Lieferschein/Rechnung, `effektiverMengenstaffelRabatt()` gegen den Basispreis berechnet, auf 0 gekappt falls der Staffelpreis zufällig über dem Basispreis liegt). Neues `vkAuto`-Flag pro Formularposition schützt einen manuell überschriebenen VK-Preis davor, bei einer nachträglichen Mengenänderung stillschweigend wieder überschrieben zu werden. `/mengenrabatte/neu` fragt jetzt "Preis (€)" statt "Rabatt %" ab (mit Standardpreis-Referenzanzeige nach Artikelwahl), `/mengenrabatte`-Liste zeigt den Preis bzw. bei Legacy-Einträgen weiterhin "X % Rabatt". End-to-end gegen die echte API + Playwright verifiziert: Menge unterhalb der Schwelle → Standardpreis; Menge ab Schwelle → exakter Staffelpreis live im Formular UND unverändert in der gespeicherten `Lieferposition` (kein Doppel-Rabatt); manuelle VK-Preis-Eingabe übersteht eine nachträgliche Mengenänderung |
| `/statistik/kategorie-verlauf` ("Kategorie-Verlauf je Kunde", Fruchtfolge-Nachvollziehbarkeit) ließ sich nur nach ganzen Kalenderjahren filtern (Von Jahr/Bis Jahr) statt nach konkretem Datum, UND zeigte ausschließlich bereits ausgelieferte Lieferungen (`status:"geliefert"`) — ein Kunde, der eine Kategorie bereits bestellt, aber noch nicht geliefert bekommen hatte, tauchte in der Übersicht gar nicht auf, obwohl gerade das ("wer hat schon bestellt?") der Anwendungsfall war | `ladeKategorieVerlauf()` (`lib/kategorie-verlauf.ts`, gemeinsame Datenquelle für JSON-API + Excel-/PDF-Export) filterte `lieferung.status:"geliefert"` hart und rundete den Zeitraum über `jahrVon`/`jahrBis` auf volle Kalenderjahre statt echte Datumsgrenzen zuzulassen | `KategorieVerlaufParams` von `jahrVon`/`jahrBis` (Jahreszahlen) auf `von`/`bis` (ISO-Datumsstrings, `<input type="date">` im Frontend statt Jahres-`<select>`) umgestellt — `MAX_TAGE_SPANNE` (statt `MAX_JAHRE_SPANNE`) deckelt die Spanne weiterhin auf ~10 Jahre; die "Jahr"-Spalten der Pivot-Tabelle bleiben (aus dem Datumsbereich abgeleitet), auch bei einem Zeitraum, der nicht an Kalenderjahresgrenzen ausgerichtet ist. Status-Filter von `status:"geliefert"` auf `status:{in:["geliefert","geplant"]}` erweitert (storniert bleibt ausgeschlossen); `KategorieVerlaufEintrag.menge` in `mengeGeliefert`/`mengeOffen` aufgeteilt (statt eines einzelnen `menge`-Felds), befüllt je nach `lieferung.status` der zugrundeliegenden Position. Frontend zeigt gelieferte Mengen weiterhin als grünes Badge, offene (bestellte, aber noch nicht gelieferte) Mengen zusätzlich als eigenes gelb/amber-Badge mit "offen"-Suffix; Excel-/PDF-Export (`lib/kategorie-verlauf.ts`-Konsumenten) hängen "geliefert"/"offen" textuell an, da dort keine Farbgestaltung möglich ist. End-to-end gegen die echte API + Playwright verifiziert: enger Datumsbereich (10 Tage) grenzt korrekt ein (schließt einen Auftrag außerhalb aus), ein noch nicht ausgelieferter Auftrag erscheint als gelbes "offen"-Badge, ein ausgelieferter als grünes Badge, PDF-Export zeigt "Zeitraum: 1.8.2026–31.8.2026" (statt Jahreszahlen) sowie die Geliefert/Offen-Unterscheidung im Text |
| Mengenstaffeln (siehe Zeile weiter oben) ließen sich NIRGENDS direkt am Artikel anlegen — nur über die separate globale Übersicht `/mengenrabatte/neu`, die dort aber nicht verlinkt war; auf der Artikel-Detailseite gab es keinerlei Hinweis auf das Feature | Kein "Mengenstaffeln"-Tab auf `app/artikel/[id]/page.tsx` — Analogie zum bereits vorhandenen "Jahrespreise"-Tab wurde beim Bau des Features (siehe Zeile weiter oben) übersehen | Neuer Tab "Mengenstaffeln" auf der Artikel-Detailseite nach dem Vorbild von `JahrespreiseManager`: neue Komponente `components/MengenstaffelnManager.tsx` (Inline-Tabelle + Ein-/Ausklapp-Formular, nur Anlegen/Löschen — es gibt bewusst keinen PATCH-Endpunkt für `Mengenrabatt`, genau wie beim Jahrespreise-Pendant). `GET /api/mengenrabatte` akzeptiert jetzt optional `?artikelId=` (ungedeckelt, für den Tab) statt nur die global gedeckelte Liste (`take:200`, für `/mengenrabatte`) zu liefern. End-to-end gegen die echte API + Playwright verifiziert: Anlegen einer kundenspezifischen UND einer allgemeingültigen Staffel im neuen Tab, danach eine Lieferung mit ausreichender Menge ohne client-seitigen Preis angelegt — der Server zieht die im Tab hinterlegte Staffel korrekt (`verkaufspreis`/`rabattProzent` stimmen); Löschen über `DELETE /api/mengenrabatte?id=` verifiziert |
| Artikel-Import (`/api/artikel/import`, `/api/einstellungen/artikel-import`) übernahm die "Kategorie"-Spalte einer Importdatei UNGEPRÜFT als `Artikel.kategorie` — lieferte die Datei dort eine Fruchtart/Kultur statt einer der festen Top-Level-Kategorien (z.B. "Getreide" statt "Saatgut"), legte das einen Artikel mit einem nirgends konfigurierten Kategorie-Wert an. Die Kategorie-/Unterkategorie-`<select>`-Felder auf der Artikel-Detailseite kennen dafür keine passende `<option>` und zeigten dadurch lautlos den jeweils ERSTEN Listeneintrag an ("Futter" bzw. "— keine —") — ein Speichern der Seite OHNE das Feld zu berühren hätte den echten (nur im DB-Rohwert noch vorhandenen) Wert überschrieben; der zweite Import-Pfad legte bei fehlender Kategorie zudem hart "Sonstiges" an, was ebenfalls keine gültige Kategorie ist | `pickCol(row, ...ARTIKEL_ALIAS.kategorie) \|\| "Futter"` (bzw. `"Sonstiges"`) wurde ungeprüft direkt als `Artikel.kategorie` gespeichert — keine der drei Import-Routen validierte den Wert gegen die konfigurierte Kategorie-/Unterkategorie-Taxonomie (`DEFAULT_ARTIKEL_KATEGORIEN`/`system.artikelkategorien` + `DEFAULT_UNTERKATEGORIEN`/`system.unterkategorien_<Kategorie>`) | Neue `resolveKategorie()` (`lib/auswahllisten.ts`, pure Funktion) + `loadKategorieTaxonomie()` (`lib/artikel-kategorie.ts`, lädt die Taxonomie aus `Einstellung`): erkennt einen als Kategorie gelesenen Wert, der eigentlich eine konfigurierte Unterkategorie ist (z.B. "Getreide"), und ordnet ihn automatisch der richtigen Top-Level-Kategorie zu (Kategorie=Saatgut, Unterkategorie=Getreide) statt eine ungültige Kategorie anzulegen; ein völlig unbekannter Wert fällt auf "Futter" zurück. Eingesetzt in `app/api/artikel/import/route.ts`, `app/api/artikel/import/vorschau/route.ts` (zeigt die Auflösung schon in der Vorschau an, z.B. "Kategorie: Saatgut · Getreide (erkannt aus Spaltenwert "Getreide")") und `app/api/einstellungen/artikel-import/route.ts`; der hart codierte "Sonstiges"-Fallback in `app/api/einstellungen/preisliste-import/route.ts` (legt bei unbekanntem Artikelnamen einen neuen Artikel an) auf "Futter" korrigiert. Zusätzliche Absicherung in `app/artikel/[id]/page.tsx`: Kategorie-/Unterkategorie-`<select>` zeigen einen bereits gespeicherten, nicht konfigurierten Wert jetzt als eigene, mit ⚠️ markierte Option an, statt lautlos auf den ersten Listeneintrag zu springen. Neue Kachel "Artikel-Kategorien bereinigen" in `/einstellungen/loeschzentrum` (`GET`/`POST{confirm:true} /api/artikel/kategorien-bereinigen`, gleiches Vorschau/Bestätigen-Muster wie "Artikel-Duplikate bereinigen") repariert bereits importierte Artikel mit ungültiger Kategorie in der Datenbank — ändert bewusst nur `kategorie`/`unterkategorie`, nicht `chargePflicht` (manuell umschaltbar, soll durch einen reinen Kategorie-Fix nicht überschrieben werden). End-to-end gegen die echte API + Playwright verifiziert: Import mit Kategorie-Spaltenwert "Getreide"/"Mais"/"Raps" legt Artikel jetzt direkt mit korrekter Kategorie+Unterkategorie an (inkl. korrekt berechnetem `chargePflicht`); Vorschau zeigt die Auflösung vorab; das Bereinigen-Tool findet einen testweise per API mit ungültiger Kategorie angelegten Artikel, korrigiert ihn korrekt und lässt einen bereits gültigen Artikel unangetastet; Edit-Formular zeigt einen unbekannten Kategorie-Wert sichtbar mit Warnhinweis statt ihn durch "Futter" zu verdecken |
| Ein Import legte denselben Artikel unter abweichendem Namen ein zweites Mal an (z.B. "SU Horizon" vs. "Z Winterweizen SU Horizon" — der Duplikat-Check beim Import matcht nur exakt gleiche Namen), statt das bereits bestehende Produkt zu aktualisieren — automatische Fuzzy-Namenserkennung beim Import wäre riskant (z.B. "SU Horizon" vs. "SU Jonte" sind unterschiedliche Sorten, ein zu laxer Abgleich würde also falsch zusammenführen) | Kein Werkzeug vorhanden, um zwei manuell als "derselbe Artikel" erkannte Datensätze sicher zusammenzuführen — nur der bestehende `/api/artikel/dedup` (exakter Namensabgleich, `/einstellungen/loeschzentrum`) deckte den Fall ab | Neue Seite `/artikel/verschmelzen` + `GET`/`POST /api/artikel/merge`, 1:1 nach dem bereits bestehenden Vorbild `/kunden/verschmelzen` + `/api/kunden/merge` (Vorschau mit Feld-für-Feld-Auswahl Ziel/Quelle, Konflikt-Warnung bei unique-constraint-Relationen, Bestätigungs-Checkbox, Quelle wird danach endgültig gelöscht). Bewusst KEINE automatische Erkennung beim Import — der Nutzer wählt die zwei Artikel manuell aus, nachdem er sie als Duplikat erkannt hat. Alle ~21 unmittelbaren Artikel-Relationen (Lieferpositionen, Preishistorie, Lagerbewegungen, Bestellungen, Kontrakte, Vorbestellungen, Gutschriften, Inventur, Chargen-Zertifikate, Frühbezug, Anlieferungen, Dokumente, Inhaltsstoffe, `Benachrichtigung.artikelId`/`EinkaufStatus.artikelId` trotz fehlendem `@relation` …) werden umgehängt; `ArtikelLieferant`/`ArtikelJahrespreis`/`KundeArtikelPreis`/`KundeBedarf`/`KampagneArtikel` haben unique-Constraints und werden bei Kollision zugunsten des Ziel-Artikels dedupliziert (Quelle verworfen, wie beim Kunden-Merge). `Artikel.aktuellerBestand` wird IMMER summiert statt zur Auswahl gestellt (physischer Lagerbestand darf nicht verschwinden), `chargePflicht` wird nach dem Merge anhand der final gewählten Kategorie neu erzwungen (wie bei PUT `/api/artikel/[id]`). Bewusst NICHT angefasst: `KiLieferungBatchItem.positionenJson` (Artikel-IDs stecken dort in einem JSON-Blob, nicht als eigene Spalte — transiente, noch unbestätigte KI-Vorschläge, gleiche Abgrenzung wie beim Kunden-Merge) und Nextcloud-Ordner (wie beim Kunden-Merge nicht mitkonsolidiert) |
| `resolveKategorie()` (siehe Zeile weiter oben) erkannte die natürliche deutsche Schreibweise "Dünger" (mit Umlaut) NICHT als die intern ASCII-gespeicherte Kategorie "Duenger" — jede Dünger-Zeile eines Imports fiel dadurch systematisch auf den "Futter"-Fallback zurück, unabhängig vom Artikel (z.B. gemeldet für "Schwefellinsen"). Betraf nur Duenger, da das die einzige der 6 festen Kategorien mit einem Umlaut in ihrer natürlichen Schreibweise ist (Futter/Saatgut/Analysen/Beratung/Pflege sind umlautfrei) | Der `norm()`-Helfer in `resolveKategorie()` machte nur `trim()+toLowerCase()`, keine Umlaut-Faltung — `norm("Dünger")` ("dünger") und `norm("Duenger")` ("duenger") sind unterschiedliche Strings, der Kategorie-Treffer schlug dadurch für jede Zeile mit "Dünger" in der Kategorie-Spalte fehl | Neue lokale `normKategorieWert()` in `lib/auswahllisten.ts` faltet zusätzlich ä→ae/ö→oe/ü→ue/ß→ss (dieselbe Faltung wie `normalizeText()` in `lib/bankabgleich-matching.ts`, hier bewusst lokal dupliziert statt cross-modul importiert, damit `lib/auswahllisten.ts` frei von Lib-internen Imports bleibt) — wird jetzt als `norm()` in `resolveKategorie()` verwendet. End-to-end gegen die echte API verifiziert: Import mit Kategorie-Spaltenwert "Dünger" UND "DÜNGER" (Großschreibung) legt den Artikel jetzt korrekt mit Kategorie "Duenger" an, `/api/artikel/import/vorschau` zeigt die Auflösung korrekt (vorher zeigte die Vorschau bei diesem Fall zusätzlich fälschlich "· null" für die nicht vorhandene Unterkategorie an — `unterkategorieAnzeige`-Variable behebt das mit) |
| Angebot bearbeiten (`/angebote/[id]`): (1) Eine bereits gespeicherte Position, deren Artikel inzwischen deaktiviert wurde, zeigte im Bearbeiten-Modus KEINEN Artikel mehr an ("— Artikel wählen —"), obwohl Menge/Preis korrekt weiter angezeigt wurden — wirkte wie Datenverlust, obwohl `editPositionen[i].artikelId` intern weiterhin den richtigen Wert hielt. (2) Die Einheit einer Position war im Bearbeiten-Modus nur als reiner Text sichtbar, nicht änderbar — beim Anlegen eines Angebots über den Kunden (`/angebote/neu`) ließ sie sich dagegen frei wählen (z.B. kg → dt) | (1) `fetch("/api/artikel?limit=2000&relations=false")` ohne `aktiv=alle` — `GET /api/artikel` liefert standardmäßig NUR aktive Artikel; die `SearchableSelect`-Optionsliste enthielt den (jetzt inaktiven) Artikel der Position dadurch nicht, wodurch kein `<option>` zum gespeicherten Wert passte. (2) Die Einheit wurde in der Positions-Tabelle als reines `<div>{p.einheit}</div>` gerendert statt als Eingabeelement — anders als `/angebote/neu/page.tsx`, das dafür längst ein `<select>` aus `system.einheiten`/`DEFAULT_EINHEITEN` nutzt | `app/angebote/[id]/page.tsx`: Artikel-Fetch auf `&aktiv=alle` erweitert, `SearchableSelect`-Optionen zeigen einen deaktivierten Artikel jetzt mit "· inaktiv"-Suffix (analog zum Inaktiv-Badge in `/artikel`) statt ihn stillschweigend auszublenden. Einheit-`<div>` durch ein `<select>` ersetzt (`einheiten`-State aus `system.einheiten`/`DEFAULT_EINHEITEN` geladen, analog `/angebote/neu`), inkl. Sicherheitsnetz-Option für einen bereits gespeicherten, nicht in der Liste stehenden Wert (Muster wie bei der Kategorie-Absicherung, siehe Zeilen weiter oben). `PUT /api/angebote/[id]` akzeptierte `einheit` je Position bereits zuvor — nur das Frontend sendete den Wert nie editierbar. End-to-end gegen die echte API + Playwright verifiziert: Position mit deaktiviertem Artikel zeigt ihn jetzt korrekt mit "inaktiv"-Hinweis an, Einheit-Wechsel (z.B. dt → t) einer Position wird beim Speichern korrekt persistiert, die andere Position bleibt unverändert |
| `resolveKategorie()` (siehe zwei Zeilen weiter oben) sortierte einen Kategorie-Wert, der WEDER eine der 6 festen Top-Level-Kategorien NOCH eine bekannte Unterkategorie war, hart auf "Futter" um — betraf beim "Artikel-Kategorien bereinigen"-Tool 320 Artikel, obwohl viele davon (z.B. "Pflanzenhilfsmittel" bei Sulfomix®/SulfoLins®, "Stallzubehör" bei marstall-Zubehör) bereits eine echte, im Alltag genutzte Kategorie waren, die genau so bleiben sollte | Erste Version der Funktion behandelte `DEFAULT_ARTIKEL_KATEGORIEN`/`system.artikelkategorien` fälschlich als abschließende Enum-Definition statt als Vorschlagsliste — ein Kunde kann aber jederzeit weitere, eigene Kategorien direkt beim Import/Anlegen einführen, ohne sie vorher unter Einstellungen → Artikelkategorien zu registrieren; für diesen (häufigeren) Fall gab es keine Unterscheidung zum echten Bugfall "Fruchtart in falscher Spalte" (z.B. "Getreide" statt "Saatgut") | Fallback-Zweig in `resolveKategorie()` entfernt: ein Wert, der weder als Top-Level-Kategorie noch als Unterkategorie erkannt wird, wird jetzt UNVERÄNDERT übernommen statt auf "Futter" erzwungen — nur der echte "Fruchtart-in-falscher-Spalte"-Fall (Treffer in `unterkategorienByKat`) wird weiterhin automatisch korrigiert. Dadurch flaggt `/api/artikel/kategorien-bereinigen` "Pflanzenhilfsmittel"/"Stallzubehör" & Co. nicht mehr zur Korrektur, findet aber weiterhin echte Fälle wie "Getreide" korrekt. End-to-end gegen die echte API verifiziert: Testartikel mit Kategorie "Pflanzenhilfsmittel"/"Stallzubehör" werden von der Vorschau nicht mehr erfasst, ein Testartikel mit "Getreide" weiterhin korrekt auf Saatgut/Getreide korrigiert; Import mit Kategorie-Spaltenwerten "Pflanzenhilfsmittel" (unverändert übernommen), "Dünger" (→ Duenger) und "Getreide" (→ Saatgut/Getreide) gleichzeitig verifiziert |
| Kunden-Detailseite (`/kunden/[id]`) auf dem Handy: (1) Der Link "Offene Vorgänge →" in der "Letzte Lieferungen"-Kachel lief über den rechten Bildschirmrand hinaus statt zu umbrechen. (2) E-Mail-Adresse (und bei längeren Nummern auch die Telefonnummer) in der "Kontakt"-Kachel wurde per `truncate` mit "…" abgeschnitten. Nutzer machen von dieser Ansicht regelmäßig Screenshots für Vorlieferanten (Versanddaten) — eine abgeschnittene Adresse macht den Screenshot dafür unbrauchbar | (1) Die Kopfzeile der Kachel (`justify-between` zwischen Label "Letzte Lieferungen" und dem `whitespace-nowrap`-Link) hatte kein `flex-wrap` — beide nowrap-Texte zusammen sind breiter als die Kachel im mobilen `grid-cols-2`-Layout (~180px). Ohne `min-width:0` auf dem Grid-Item erzwingt ein `white-space:nowrap`-Kind zusätzlich, dass der gesamte Grid-Track (und damit die Seite) breiter wird als der Viewport, statt dass der Inhalt umbricht oder gestaucht wird — ein Standard-CSS-Grid-Fallstrick (`min-width:auto` ist der Default für Grid-Items). (2) `truncate` (Tailwind: `overflow:hidden`+`white-space:nowrap`+`text-overflow:ellipsis`) ist für eine normale Bildschirmansicht sinnvoll, aber ungeeignet für den Screenshot-Versand-Workflow — der abgeschnittene Teil ist dabei schlicht nicht mehr lesbar | (1) `flex-wrap` auf die Kopfzeile ergänzt (Link fällt bei Platzmangel in eine zweite Zeile statt über den Rand zu laufen) und `min-w-0` auf die Kachel selbst. (2) `truncate` auf der Telefonnummer entfernt (bricht jetzt normal an Leerzeichen um) und auf der E-Mail-Adresse durch `break-all` ersetzt (bricht bei Bedarf auch innerhalb eines zusammenhängenden Worts um, notwendig da E-Mail-Adressen keine Leerzeichen enthalten) — beide jetzt immer vollständig lesbar, keine Kürzung mehr. `min-w-0` auch auf die Kontakt-Kachel ergänzt (gleicher Grid-Fallstrick wie bei (1), hier durch das Umbruchverhalten zwar nicht akut, aber konsistent abgesichert). Per Playwright mit mobilem Viewport (390px) verifiziert: `document.documentElement.scrollWidth === clientWidth` (kein horizontales Overflow), "Offene Vorgänge →" erscheint vollständig unter dem Label, eine lange Test-E-Mail-Adresse erscheint umgebrochen über 3 Zeilen vollständig lesbar, eine Telefonnummer mit Leerzeichen bricht sauber daran um |
| Streckengeschäft (Direktlieferung Lieferant→Kunde, `Lieferung.istStreckengeschaeft`/`streckenLieferantId`) hatte außer dem Überspringen der Lagerbuchung keinerlei Wirkung — der Vorlieferant musste die Bestellung komplett manuell außerhalb von AGRI-Office erhalten, inkl. der Kundenversand-Adresse ("wir haben die Ware in der Regel nicht im Lager, sondern müssen sie beim Streckengeschäft beim Vorlieferanten bestellen und direkt an den Kunden liefern lassen") | Kein Weg, aus einer Streckengeschäft-Lieferung heraus eine formelle `Bestellung` beim hinterlegten Direktlieferanten zu erzeugen; `bestellungEmail()`/das (bis dahin nicht existierende) Bestellungs-PDF kannten keine vom Rechnungsempfänger abweichende Versandadresse | Neue Route `POST /api/lieferungen/[id]/streckenbestellung`: legt für jede Lieferposition eine `Bestellposition` an (kundeId/lieferungId gesetzt — nutzt die dafür bereits vorhandenen, bis dahin nur vom Angebot-annahme-Pfad befüllten Felder, keine Schema-Änderung nötig; EK aus `ArtikelLieferant` für genau das Artikel/Lieferant-Paar, sonst 0) und bündelt sie in derselben Transaktion sofort zu einer neuen `Bestellung` (identisches Nummernvergabe-Muster wie `POST /api/bestellungen`); 409 mit `bestellungId`, falls für diese Lieferung bereits eine Bestellung existiert (Schutz vor Doppel-Bestellung bei mehrfachem Klick). Neuer Button "→ Bestellung beim Lieferanten anlegen" auf `/lieferungen/[id]` (bzw. Link auf die bereits bestehende Bestellung), navigiert nach Erfolg zu `/bestellungen/[id]`. `bestellungEmail()` (`lib/email-templates.ts`) und die neue `generiereBestellungPdf()` (`lib/pdfGenerator.ts`, neue Route `GET /api/exporte/bestellung`, PDF-Button auf `/bestellungen/[id]`) zeigen bei gesetztem `versandKunde` einen hervorgehobenen "Bitte Ware direkt an unseren Kunden versenden"-Block mit Name/Firma/Adresse; `versandKunde` wird serverseitig nur befüllt, wenn sich ALLE `Bestellposition`-Einträge einer Bestellung eindeutig auf genau einen Kunden zurückführen lassen (`app/api/bestellungen/[id]/mail/route.ts`) — bei einer manuell aus mehreren Kunden gebündelten Bestellung bleibt die Adresse bewusst leer, sonst würde die falsche Kundenadresse an den Lieferanten gehen. End-to-end gegen die echte API + PDF-Textextraktion verifiziert: EK/Menge/Nummer korrekt übernommen, Doppelklick-Schutz greift (409), Adressblock erscheint in E-Mail-Text und PDF bei eindeutigem Kunden, bleibt bei einer aus zwei verschiedenen Kunden gebündelten Bestellung korrekt leer |
| "Kategorie-Verlauf je Kunde" (`/statistik/kategorie-verlauf`, Fruchtfolge-/Wiederansprache-Planung): (1) Unterkategorie-Filter erlaubte nur EINE Auswahl — Anwendungsfall des Nutzers war aber z.B. "alle Kunden, die eine fertige Zwischenfruchtmischung ODER Einzelkomponenten dafür bezogen haben" für eine gezielte Kundenansprache-Liste im nächsten Jahr, was mehrere Unterkategorien gleichzeitig erfordert. (2) Nutzer meldete (mit Screenshot), im Dropdown erscheine "Einzelkomponente" scheinbar doppelt, obwohl in den Stammdaten nur einmal (singular) angelegt | (1) Reines UI-Limit, `<select>` statt Mehrfachauswahl. (2) Kein Bug in der Merge-Logik selbst — `aktuelleUnterkategorien` vereinigt bewusst zwei Quellen: die unter `/einstellungen/stammdaten` konfigurierten Werte UND die tatsächlich auf `Artikel.unterkategorie` verwendeten Werte (`GET /api/artikel/kategorien`, damit auch nicht-registrierte Werte filterbar bleiben). "Einzelkomponente" (konfiguriert, Singular) und "Einzelkomponenten" (Plural, nur auf einzelnen Artikeln vorhanden — z.B. aus einem CSV-Import, der `unterkategorie` anders als das eingeschränkte `<select>` auf `/artikel/neu` ungeprüft übernimmt) sind zwei tatsächlich unterschiedliche Strings, keine exakten Duplikate — wirkten im Dropdown aber ununterscheidbar wie ein Duplikat | Filter auf Mehrfachauswahl umgestellt: neue wiederverwendbare `components/MultiSelectDropdown.tsx` (Checkbox-Panel nach dem Öffnen/Schließen-Muster von `SearchableSelect.tsx`, optionale `hint`-Angabe je Option). `lib/kategorie-verlauf.ts` (`KategorieVerlaufParams.unterkategorien: string[]`, Prisma `unterkategorie: { in: [...] }` bei nicht-leerer Auswahl) sowie alle drei Routen (`GET /api/statistik/kategorie-verlauf`, `.../export`, `.../pdf`) auf `searchParams.getAll("unterkategorie")` (Query-Parameter mehrfach angebbar, ODER-verknüpft) umgestellt. Für (2): `aktuelleUnterkategorien` markiert jetzt Werte, die NUR aus den Artikeldaten stammen (nicht in den Stammdaten registriert), im Dropdown zusätzlich mit dem Hinweis "· nicht in Stammdaten registriert" — macht den tatsächlichen Unterschied sichtbar, statt zwei optisch identische Einträge unerklärt nebeneinander zu zeigen; keine automatische Verschmelzung, da Singular/Plural-Erkennung bei deutschen Wörtern nicht zuverlässig automatisierbar ist und ein Kunde jederzeit bewusst ähnlich benannte, aber tatsächlich unterschiedliche Unterkategorien pflegen können muss. End-to-end gegen die echte API + Playwright verifiziert: `unterkategorie`-Parameter mehrfach gesetzt liefert korrekt ODER-verknüpfte Treffer (nicht nur den letzten Parameter), Excel-/PDF-Export zeigen die Auswahl kommagetrennt im Titel, ein nur auf Artikeln vorhandener (nicht konfigurierter) Wert erscheint im Dropdown sichtbar mit dem Registrierungs-Hinweis |
| Derselbe Mobile-Überlappungs-Bug wie bei `/lieferungen/[id]/rechnung` (siehe Zeile weiter oben) steckte unbehoben auch in `app/angebote/[id]/druck/page.tsx`, `app/lieferungen/[id]/lieferschein/page.tsx` und `app/vorbestellungen/[id]/auftragsbestaetigung/page.tsx` — auf dem Handy quetschte sich der Briefkopf auf die Viewport-Breite und überlappte den nachfolgenden Inhalt | Gleiche Ursache wie beim Rechnungs-Fix: `[data-print-area]` hatte in allen drei Dateien nur `maxWidth: "210mm"`, kein festes `width` | Identisches, bereits etabliertes Muster in allen drei Dateien nachgezogen: `[data-print-area]` bekommt `width: "210mm"` statt `maxWidth`, umschlossen von einem neuen `<div className="<seite>-scroll-wrapper" style={{overflowX:"auto"}}>`; `@media print` bekam je Datei die ergänzenden Regeln `.{klasse}-scroll-wrapper { overflow: visible !important; }` und `[data-print-area] { …width: 100% !important; max-width: 100% !important; … }` (bei `auftragsbestaetigung/page.tsx` fehlten vorher auch die `main`-Padding- und `[data-print-area]`-Print-Overrides komplett — ergänzt, sonst hätte das feste `width:"210mm"` beim echten Drucken über die vom `@page`-Rand begrenzte Druckfläche hinausgeragt). Per Playwright mit mobilem Viewport (390px) für alle drei Seiten verifiziert: `[data-print-area]` bleibt exakt 210mm (≈794px) breit unabhängig vom Viewport, `document.documentElement.scrollWidth === clientWidth` (kein Body-Overflow, sauber innerhalb des Wrappers scrollbar), keine Überlappung im Screenshot |
| Bestellliste (`/bestellliste`) hatte manuelles Erfassen ("+ Position hinzufügen"), aber kein Diktieren — beim Annehmen einer Bestellliste per Anruf/vor Ort musste jede Position von Hand eingetippt werden, obwohl die Diktier-Infrastruktur (`AudioRecorder.tsx`/`POST /api/ki/transcribe`) für CRM/Lieferung/Wareneingang bereits existierte | War beim Bau des Bestellliste-Workflows bewusst zurückgestellt (siehe Zeile weiter oben) — Diktieren brauchte eine eigene KI-Struktur (Bestellliste-Positionen sind lose, nicht an einen Kunden/Beleg gebunden wie bei `lieferung`) und musste mehrere gleichzeitig genannte Artikel als eigene Positionen erkennen können | Neuer Prompt `PROMPTS.bestellliste` (`lib/ai.ts`) extrahiert aus dem diktierten Text ein Array `positionen[]` (`name`, `menge`, `einheit?`, `lieferant?`, `notiz?`) — mehrere im selben Satz genannte Artikel werden zu eigenen Positionen; `"bestellliste"` als viertes Feature zu `VALID_FEATURES` in `/api/ki/analyze` UND `/api/ki/transcribe` ergänzt (dort vorher nur `crm`/`sprachmemo`/`lieferung`), `AudioRecorder`s `feature`-Prop-Union erweitert, neuer Eintrag in `PROMPT_FEATURES` (`/einstellungen/ki`) für die Prompt-Anpassung. Neuer "🎤 Diktieren"-Button auf `/bestellliste` (schließt das manuelle Formular, falls offen, und umgekehrt) startet `AudioRecorder`; nach der Transkription sucht die Seite für jeden erkannten Artikelnamen per bereits vorhandenem `GET /api/artikel?search=` bis zu 5 Kandidaten und wählt den besten per `matchArtikel()` (`lib/kiMatching.ts`, bereits für `ki/lieferung`/`ki/wareneingang` etabliert) — der erkannte Lieferantenname wird gegen die bereits geladene `lieferantenListe` abgeglichen (exakter, sonst Teilstring-Treffer). Jede erkannte Position erscheint als eigene, editierbare Review-Zeile (Artikel-`<select>` aus den Kandidaten, Menge/Einheit, Lieferant-`<select>`, Konfidenz-Badge) — kein Auto-Submit, der Nutzer bestätigt/korrigiert vor dem Anlegen. "N Position(en) hinzufügen" ruft `POST /api/bestellliste` für jede Zeile mit gewähltem Artikel einzeln auf (analog zum bereits bestehenden Bulk-Muster in `ki/lieferung`s `handleBestelllisteAnlegen()`); Zeilen ohne Artikel-Zuordnung (kein Kandidat gefunden) bleiben zur manuellen Vervollständigung stehen statt verworfen zu werden, ein 422 (kein Lieferant hinterlegt) zeigt den Fehler direkt an der betroffenen Zeile statt die ganze Aktion abzubrechen — erfolgreich angelegte Zeilen werden aus der Review-Liste entfernt, der Rest bleibt bestehen. End-to-end mit gemocktem Mikrofon (`MediaRecorder`/`getUserMedia`) + gemockten KI-Antworten gegen die echte API/DB per Playwright verifiziert: erkannter Artikel + Lieferant korrekt vorbefüllt und nach Bestätigung tatsächlich in der Bestellliste angelegt (inkl. korrektem EK-Preis aus `ArtikelLieferant`); ein nicht auffindbarer Artikelname bleibt als unvollständige, nicht absendbare Zeile stehen, während eine im selben Diktat erkannte, matchbare Position parallel erfolgreich angelegt wird |
| Unterkategorie-Dropdown (`/statistik/kategorie-verlauf`, siehe Zeile weiter oben) markierte nicht registrierte Werte zwar mit einem Hinweis, es gab aber kein Werkzeug, sie tatsächlich zu bereinigen — die bestehende "Artikel-Kategorien bereinigen" (`/einstellungen/loeschzentrum`) prüft ausschließlich die TOP-LEVEL `kategorie`, überspringt einen Artikel also komplett, sobald dessen Kategorie bereits gültig ist ("Saatgut" ist gültig, egal was in `unterkategorie` steht) — sie sieht einen Fall wie "Einzelkomponenten" (Kategorie korrekt, nur Unterkategorie nicht registriert) gar nicht erst. Ein automatisches Zusammenführen ähnlich klingender Werte (Singular/Plural) wäre zudem genau die Art blinder Rateraterei, die bei `resolveKategorie()` bewusst entfernt wurde (siehe Zeile weiter oben zu "Pflanzenhilfsmittel"/"Stallzubehör") | Fehlendes Werkzeug — weder automatisch (riskant) noch manuell (nicht vorhanden) | Neue Route `GET /api/artikel/unterkategorien-unregistriert` (`prisma.artikel.groupBy(["kategorie","unterkategorie"])`, gefiltert auf Werte, die nicht in `loadKategorieTaxonomie()` stehen) liefert je Kategorie die unregistrierten Werte mit Artikel-Anzahl. Neue Sektion "Nicht registrierte Unterkategorien" unter `/einstellungen/stammdaten` (nach dem bestehenden "Unterkategorien"-Block) zeigt sie mit einem Ziel-`<select>` aus den bereits registrierten Werten derselben Kategorie + "Zusammenführen"-Button — bewusst EXPLIZIT (der Nutzer bestätigt selbst, dass zwei Werte dasselbe meinen), keine automatische Erkennung. Neue Aktion `{aktion:"unterkategorie_umbenennen", kategorie, von, zu}` in `POST /api/artikel/kategorien` (ergänzt die dort bereits vorhandene `{aktion:"umbenennen"}` für die Top-Level-Kategorie) führt ein einfaches `updateMany({where:{kategorie,unterkategorie:von}, data:{unterkategorie:zu}})` aus — anders als beim Kategorie-Umbenennen keine `Mengenrabatt`-Kopplung nötig, da `Mengenrabatt.kategorie` keine Unterkategorie kennt. Ein Playwright-Testlauf deckte einen UX-Fehler auf: Wurde der letzte unregistrierte Eintrag einer Kategorie zusammengeführt, verschwand die gesamte Karte (inkl. Erfolgsmeldung) sofort, da die Komponente bei leerer Trefferliste `null` rendert — behoben, indem sie erst ausblendet, wenn zusätzlich KEINE frische Erfolgsmeldung mehr ansteht. End-to-end gegen die echte API/DB verifiziert: zwei Testartikel mit "Einzelkomponenten" zusammengeführt in "Einzelkomponente", beide danach korrekt umgestellt, die Unregistriert-Liste danach leer, Erfolgsmeldung "„Einzelkomponenten" → „Einzelkomponente" (2 Artikel aktualisiert)" sichtbar |
| Rechnungsliste (`/rechnungen`) zeigte nur Rechnung-Nr/Datum/Kunde/Betrag — wollte man eine Rechnung mit einem bestimmten Artikel-Inhalt finden, musste man jede Rechnung einzeln über den Ausklapp-Pfeil öffnen. Die analoge Verbesserung für die Lieferungsliste (Artikelnamen direkt in der Zeile, siehe Zeile weiter oben) war für `/rechnungen` nie nachgezogen worden | Kein Werkzeug, das Analog fehlte schlicht — `/rechnungen` lädt `positionen.artikel.name` zwar bereits (fürs Ausklappen), zeigte/durchsuchte sie aber nicht in der Zeilenübersicht | Neue Spalte "Artikel" (`hidden lg:table-cell`, komma­getrennte Artikelnamen mit `truncate`+`title`-Tooltip, gleiches Muster wie in `/lieferungen`) sowie eine `lg:hidden`-Unterzeile unter der Rechnung-Nr für Tablet/Handy (analog zur bestehenden `sm:hidden`-Kunde/Datum-Zeile). Die Suche (`matchSearch` in `app/rechnungen/page.tsx`) prüft jetzt zusätzlich `positionen.some(p => p.artikel.name...)`, Platzhaltertext entsprechend auf "Suche nach Rechnung-Nr, Kunde oder Artikel…" erweitert. `colSpan`-Werte der Positions-Ausklappzeile (8→9) und der Fußzeile (5→6) an die neue Spalte angepasst. End-to-end gegen die echte API + Playwright verifiziert: Artikelname erscheint in der Desktop-Spalte UND in der mobilen Unterzeile, Suche nach einem Artikel-Teilnamen filtert korrekt auf die passende(n) Rechnung(en), kein horizontaler Overflow bei 390px Viewport |
| Streckengeschäft-Bestellung (PDF `GET /api/exporte/bestellung`, generiert in `generiereBestellungPdf()`): (1) Der Versandhinweis-Kasten ("Bitte Ware direkt an unseren Kunden versenden") zeigte Name/Adresse des Endkunden, aber keine Telefonnummer — beim Vorlieferanten fehlte damit der Kontaktweg für Rückfragen zur Anlieferung. (2) Der abschließende Hinweissatz ("Über eine Bestätigung mit Liefertermin würden wir uns freuen…") lief über den rechten Seitenrand hinaus und wurde dadurch sichtbar abgeschnitten | (1) `versandKunde`-Query selektierte nur `name/firma/strasse/plz/ort` — `Kunde` hat gar kein eigenes Telefonfeld, das lebt auf `KundeKontakt` (typ `telefon`/`mobil`), wurde aber nie mitgeladen. (2) Der Hinweissatz wurde per einzelnem `doc.text(...)`-Aufruf OHNE `splitTextToSize()` gezeichnet — anders als der direkt darüber stehende `bestellung.notiz`-Block, der korrekt umbricht; bei 9pt italic ist der Satz (~140 Zeichen) deutlich breiter als die 182mm nutzbare Seitenbreite | (1) `versandKunde`-Select um `kontakte: { where: { typ: { in: ["telefon","mobil"] } }, select: { typ:true, wert:true } }` ergänzt, `versandTelefon` per selbem Fallback-Muster wie bereits an anderer Stelle in `pdfGenerator.ts` (`c.typ === "telefon" \|\| c.typ === "mobil"`) aufgelöst und als zusätzliche "Tel.: …"-Zeile im Kasten ergänzt. (2) Hinweissatz auf `doc.splitTextToSize(text, 182)` + zeilenweises `doc.text()` umgestellt (identisches Muster wie der Notiz-Block direkt darüber). Derselbe fehlende Telefon-Fix zusätzlich im parallelen E-Mail-Versandpfad nachgezogen (Konsistenz zwischen PDF und Mail, wie bereits bei Mahnwesen praktiziert): `BestellungVersandKunde`-Typ (`lib/email-templates.ts`) um `telefon?` erweitert, `bestellungEmail()` zeigt "Tel.: …" in Text- UND HTML-Version, `app/api/bestellungen/[id]/mail/route.ts` lädt dafür ebenfalls die Kontakte. End-to-end gegen die echte API + `pdfjs-dist`-Textextraktion verifiziert: Testkunde mit hinterlegter Telefonnummer erscheint als "Tel.: 05731-999888" im Versandkasten, der Hinweissatz bricht jetzt in zwei Zeilen um (rechte Kante bei ≈545pt, innerhalb der 595pt-Seitenbreite) statt über den Rand zu laufen |
| Lieferantenbestellung (`/bestellungen/[id]`) hatte kein Eingabefeld für eine Notiz an den Lieferanten (z.B. gewünschte Verpackungsgröße "bitte in BigBags à 500 kg statt lose") — `Bestellung.notiz` existierte im Schema und wurde in PDF (`generiereBestellungPdf()`, "Anmerkung: …"-Zeile) UND E-Mail (`bestellungEmail()`) bereits korrekt gerendert, `PUT /api/bestellungen/[id]` akzeptierte `notiz` ebenfalls bereits — nur die Detailseite zeigte das Feld ausschließlich lesend an (`{data.notiz && …}`), wenn es zufällig schon gesetzt war; kein Weg, es dort selbst zu pflegen | Backend/PDF/Mail-Plumbing vollständig vorhanden, nur die Editier-UI fehlte auf `app/bestellungen/[id]/page.tsx` | Notiz-Karte von "nur bei vorhandenem Wert lesend anzeigen" auf immer sichtbares `<textarea>` + "Speichern"-Button umgestellt (`notizEdit`-State, initial aus `data.notiz`, `handleSaveNotiz()` ruft `PUT /api/bestellungen/[id]` mit `{notiz}`, Button disabled solange unverändert). Keine Status-Sperre (anders als bei Rechnungen kennt `Bestellung` keinen "bereits versendet"-Lock) — Notiz bleibt jederzeit editierbar, auch nach Versand; ein erneuter E-Mail-Versand oder PDF-Download zieht den aktuellen Wert. End-to-end gegen die echte API + `pdfjs-dist`-Textextraktion verifiziert: Notiz gespeichert, nach Reload persistiert, erscheint im heruntergeladenen PDF als "Anmerkung: Bitte in BigBags à 500 kg liefern, keine losen Säcke." |
| Bestellung beim Lieferanten per E-Mail versenden: Das "An"-Feld im Versand-Modal bot immer nur die eine feste `Lieferant.email` an — bei Lieferanten mit unterschiedlichen Zuständigkeiten je Abteilung (z.B. Verkauf bestellt, Buchhaltung bekommt Rechnungen) gab es keine Möglichkeit, verschiedene Ansprechpartner zu hinterlegen und beim Versand gezielt auszuwählen | `Lieferant` hatte (anders als `Kunde`/`KundeKontakt`) nur die drei Skalarfelder `ansprechpartner`/`email`/`telefon` — kein 1:N-Kontaktmodell, kein Weg, mehrere Personen zu pflegen | Neues Modell `LieferantKontakt` (Migration `20260904130000_lieferant_kontakte`, analog `KundeKontakt` aber ohne `rechnungsEmail`/`lieferscheinEmail`-Rollen — die sind Kunde-spezifisch). `PUT /api/lieferanten/[id]` akzeptiert jetzt optional `kontakte[]` (volle Ersetzung per `deleteMany`+`create`, identisches Muster wie beim Kunden), `GET /api/lieferanten/[id]` liefert sie mit. Neue Komponente `components/LieferantKontakteManager.tsx` (schlankere Variante von `KundeKontakteTab` — kein Visitenkarten-Scan, keine E-Mail-Rollen-Toggles) als neue Karte unter den Stammdaten auf `/lieferanten/[id]`. `GET /api/bestellungen/[id]` und die Antwort von `POST /api/bestellungen/[id]/mail` laden zusätzlich `lieferant.kontakte` (nur `typ:"email"`, damit `EmailVersandModal` — das bei >1 Adresse bereits automatisch ein Auswahl-Dropdown zeigt — mehrere Empfänger anbieten kann); `app/bestellungen/[id]/page.tsx` speist `emailKontakte` jetzt aus `lieferant.kontakte`, fällt auf die alte Einzel-`email` zurück, solange noch keine Kontakte gepflegt sind (Rückwärtskompatibilität für Bestandsdaten). End-to-end gegen die echte API + Playwright verifiziert: zwei Kontakte ("Verkauf"/"Buchhaltung") am Lieferanten angelegt, erscheinen korrekt in der Kontakte-Karte; Bestellungs-Mail-Modal zeigt danach beide als Dropdown-Optionen zur Auswahl statt nur einer festen Adresse |
| Kunde überweist eine bereits gestellte Rechnung, hat dabei aber eine Gutschrift falsch/zu viel abgezogen und dadurch zu wenig gezahlt — auf der Lieferungs-Detailseite ließ sich die eingegangene Teilzahlung zwar erfassen, aber es gab keine Möglichkeit, die Gutschrift dagegen zu verrechnen und den danach verbleibenden echten Fehlbetrag für die nächste Rechnung dieses Kunden vorzumerken; der bisherige Weg über den Bankabgleich (`erfasseBankabgleichDifferenz()`) griff nur beim Zuordnen EINES Kontoumsatzes zu genau EINER Rechnung, nicht wenn die Teilzahlung bereits anders (manuell) erfasst wurde | `injiziereOffeneGutschriften()` verbucht offene Gutschriften nur automatisch beim Erstellen EINER NEUEN Rechnung (fügt dafür eine negative Lieferposition hinzu) — für eine bereits gestellte, ggf. schon versendete Rechnung ist das nicht anwendbar (Positionen sind ab `rechnungVersendetAm` gesperrt, siehe weiter oben) | Neuer Bereich "Restbetrag klären" in der Teilzahlungen-Karte auf `/lieferungen/[id]` (sichtbar sobald nach Teilzahlungen noch etwas offen ist): optionale Auswahl einer bestehenden OFFENEN Gutschrift des Kunden aus `GET /api/gutschriften?kundeId=&status=OFFEN`, Vorschau des resultierenden Restbetrags. Neue `verrechneOffeneRestdifferenz()` (`lib/lieferung.ts`, Gegenstück zu `injiziereOffeneGutschriften()`/`injiziereAlteForderungen()`) läuft in `POST /api/lieferungen/[id]/restdifferenz`: markiert die gewählte Gutschrift als VERBUCHT mit `verbuchtBeiLieferungId` — OHNE neue Lieferposition, da die Rechnung bereits steht (lehnt mit 400 ab, wenn die Gutschrift den offenen Betrag übersteigt: Gutschriften sind in diesem System atomar, keine Teilverrechnung); ein danach verbleibender Restbetrag wird als `KundeForderung` mit `quelleLieferungId` angelegt und dadurch automatisch von `injiziereAlteForderungen()` in die nächste Rechnung dieses Kunden übernommen (als "Alte Forderung"-Position mit dem vollen Rechenweg als Notiz, z.B. "Restdifferenz Rechnung RE-2026-0691: Offener Betrag 290,00 € ./. Gutschrift GS-2026-0012 (200,00 €) = 90,00 € offen — auf nächste Rechnung übernommen."). `GET /api/lieferungen/[id]` liefert dafür zusätzlich `gutschriftenVerbucht`/`forderungenAlsQuelle` (nutzt die bereits im Schema vorhandenen Relationen `Lieferung.gutschriftenVerbucht`/`forderungenAlsQuelle` — keine Migration nötig); die Teilzahlungen-Karte zeigt die Aufschlüsselung dauerhaft an ("✓ Gutschrift GS-… verrechnet: X €" / "→ Restforderung Y € wird automatisch mit der nächsten Rechnung verrechnet" bzw. "bereits mit Rechnung … verrechnet") und der "Offen"-Betrag berücksichtigt verbuchte Gutschriften/Forderungen zusätzlich zu den Teilzahlungen. End-to-end gegen die echte API + Playwright verifiziert: Gutschrift-Auswahl reduziert die Vorschau korrekt, Bestätigen setzt Gutschrift auf VERBUCHT und legt die Forderung an, "Offen" springt danach auf 0,00 €; eine zu hoch gewählte Gutschrift wird mit klarer Fehlermeldung abgelehnt (keine Änderung in der DB); beim anschließenden Erstellen der nächsten Rechnung dieses Kunden erscheint die Forderung automatisch als "Alte Forderung"-Position mit dem vollständigen Rechenweg als Notiz und wird als `erledigt` markiert |
| Eine per Hand über den "Als verbucht markieren"-Button auf `/gutschriften/[id]` auf VERBUCHT gesetzte Gutschrift (setzt NUR den Status, anders als `injiziereOffeneGutschriften()` OHNE `verbuchtBeiLieferungId` und ohne Ausgleichsposition) ließ sich danach nicht mehr zurücksetzen — `PUT /api/gutschriften/[id]` blockt jede Bearbeitung sobald `status !== "OFFEN"`, einzige verbleibende Aktion war das vollständige Löschen. Fiel real auf, als eine Gutschrift dadurch für die neue "Restbetrag klären"-Funktion (siehe Zeile weiter oben) nicht mehr im Auswahl-Dropdown auftauchte, obwohl sie inhaltlich noch offen war | Kein Weg zurück von VERBUCHT nach OFFEN vorgesehen — nur `DELETE` (macht alle Nebenwirkungen inkl. einer ggf. vorhandenen Ausgleichsposition rückgängig, löscht aber den ganzen Datensatz) | Neue `oeffneGutschriftErneut()` (`lib/gutschrift.ts`, Gegenstück zu `loescheGutschriftMitNebenwirkungen()` — identische Ausgleichsposition-Entfernung falls `verbuchtBeiLieferungId` gesetzt ist, aber ohne den Datensatz zu löschen) über `PUT /api/gutschriften/[id]` mit `{aktion:"wieder_oeffnen"}` — bewusst VOR dem "nur OFFEN bearbeitbar"-Guard geprüft, sonst würde dieser die Aktion selbst blockieren. Neuer "Wieder öffnen"-Button auf `/gutschriften/[id]`, sichtbar bei Status VERBUCHT. End-to-end verifiziert: manuell auf VERBUCHT gesetzte Gutschrift ohne `verbuchtBeiLieferungId` wird korrekt wieder OFFEN und taucht danach im Restbetrag-klären-Dropdown auf |
| "Restbetrag klären" (siehe zwei Zeilen weiter oben): ging die Rechnung durch Teilzahlung + verrechnete Gutschrift + neu angelegte Forderung rechnerisch exakt auf (0,00 € Restbetrag), zeigte die Teilzahlungen-Karte statt "Offen: 0,00 €" ein "Offen: NaN €" an | `rundeKaufmaennisch()` (`lib/utils.ts`) baut den Rundungs-Trick über einen String-Umweg (`Number(\`${Math.abs(n)}e${stellen}\`)`) — bei einem Float-Rundungsrest aus mehrfacher Subtraktion (z.B. 1,1368683772161603e-13, weil sich Rechnungsbetrag, Teilzahlung, Gutschrift und Forderung in Floats nicht exakt auf 0 aufheben) liefert `Math.abs(n).toString()` unterhalb von 1e-6 bereits Exponentialschreibweise ("1.1e-13") — das angehängte "e2" erzeugt daraus einen zweiten, ungültigen Exponenten ("1.1e-13e2"), `Number(...)` davon ist `NaN`. War zuvor nie aufgefallen, weil keine bestehende Berechnung im Projekt vier unabhängige Beträge exakt gegeneinander aufgehen ließ | `rundeKaufmaennisch()` rundet Beträge, deren Betrag kleiner als die Hälfte der kleinsten darstellbaren Einheit bei `stellen` Nachkommastellen ist (z.B. < 0,005 bei 2 Nachkommastellen — weit oberhalb der 1e-6-Schwelle für Exponentialschreibweise), direkt auf 0, statt den String-Umweg zu versuchen. Regressionstest in `__tests__/lib/utils.test.ts` für genau diesen Float-Restwert; End-to-end gegen die echte API + Playwright verifiziert: eine bis auf einen Float-Rest exakt ausgeglichene Rechnung zeigt jetzt korrekt "Offen: 0,00 €" |
| Gutschrift-Detailseite (`/gutschriften/[id]`) auf dem Handy: die Positionstabelle (Artikel/Menge/Preis/Betrag) war rechts abgeschnitten — "Betrag" und "Gesamt Gutschrift" waren dadurch auf schmalen Viewports unsichtbar und unerreichbar, kein Scrollen möglich | `<table>` war direkt in eine Karte mit `overflow-hidden` eingebettet (nur für die abgerundeten Ecken gedacht) und hatte keinen eigenen `overflow-x-auto`-Wrapper — bei 4 Datenspalten ohne `hidden sm:table-cell`-Reduktion (die einzige ausblendbare Spalte "Rücknahme" war es schon) lief die Tabelle auf schmalen Viewports über die Kartenbreite hinaus und wurde von `overflow-hidden` einfach geclippt statt scrollbar zu sein | Tabelle in einen `<div className="overflow-x-auto">` innerhalb der Karte gewrappt (äußeres `overflow-hidden` bleibt für die abgerundeten Ecken erhalten) — identisches Muster wie bei den bereits bestehenden `*-scroll-wrapper`-Fixes für die Druckseiten (siehe Zeilen weiter oben). Per Playwright mit mobilem Viewport (390px) verifiziert: kein Body-Overflow (`document.documentElement.scrollWidth === clientWidth`), Tabelle lässt sich innerhalb ihres eigenen Containers horizontal scrollen, "Gesamt Gutschrift"-Betrag danach vollständig sichtbar |
| "Restbetrag klären" (siehe drei Zeilen weiter oben) vermischte Brutto und Netto: der "offene Betrag" der Rechnung ist brutto (inkl. MwSt, `berechneLieferungBrutto()`), aber `gsBetrag`/`gutschriftenSumme` wurden als reine Netto-Summe der `GutschriftPosition`en (`menge × preis`, ohne MwSt) berechnet — der als "verrechnet" angezeigte und vom offenen Betrag abgezogene Gutschriftbetrag war dadurch systematisch um genau die MwSt der Gutschrift zu niedrig, wodurch die daraus resultierende Restforderung um denselben Betrag zu hoch war. Realer Fall: Rechnung RE-2026-0691 offen 352,14 €, Gutschrift GS-2026-0010 netto 221,25 € (7 % MwSt, brutto 236,74 €) — angezeigt/verrechnet wurden fälschlich 221,25 €, die Restforderung damit fälschlich 130,89 € statt korrekt 115,40 € | `GutschriftPosition.preis` ist wie bei der PDF (`generiereGutschriftPdf()`) ein Netto-Einzelpreis ohne eigenes MwSt-Snapshot-Feld (liest `Artikel.mwstSatz` live) — `verrechneOffeneRestdifferenz()` und die Anzeige-Mappings hatten diesen MwSt-Aufschlag schlicht vergessen, obwohl `generiereGutschriftPdf()` ihn bereits korrekt vorgemacht hätte | Neue `berechneGutschriftBrutto()` in `lib/lieferung-brutto.ts` (`Menge × Preis × (1+MwSt%)` je Position, Fallback 19 % ohne Artikel, exakt wie in `generiereGutschriftPdf()`) als einzige Quelle der Wahrheit für den Brutto-Betrag einer Gutschrift. Eingesetzt in `verrechneOffeneRestdifferenz()` (`lib/lieferung.ts`, für `gutschriftenSumme` UND `gsBetrag`, jeweils inkl. `artikel:{select:{mwstSatz:true}}` im Prisma-Select), in `GET /api/lieferungen/[id]` (`gutschriftenVerbucht`-Mapping für die "✓ Gutschrift … verrechnet: X €"-Anzeige) sowie im Frontend (`openRestdiff()` in `app/lieferungen/[id]/page.tsx`, Dropdown-Optionen + Live-Vorschau des Restbetrags). Regressionstest in `__tests__/lib/lieferung-brutto.test.ts`; end-to-end gegen die echte DB verifiziert (Nachbau des realen Falls RE-2026-0691/GS-2026-0010 exakt bis auf den Cent): `offenVorAktion` 352,14 €, `gutschrift.betrag` jetzt korrekt 236,74 € (brutto statt 221,25 € netto), resultierende Forderung korrekt 115,40 € (statt 130,89 €) |
| Eine mit dem alten Netto-statt-Brutto-Fehler (siehe Zeile direkt darüber) bereits falsch angelegte "Restbetrag klären"-Verrechnung (Gutschrift VERBUCHT + Forderung mit falschem Betrag) ließ sich NICHT direkt von der Lieferungs-Detailseite aus korrigieren — die verrechnete Gutschrift stand dadurch nicht mehr im "Restbetrag klären"-Dropdown zur erneuten Auswahl (nur OFFENE Gutschriften werden geladen), einziger Weg zurück war der Umweg über zwei verschiedene Seiten: `/gutschriften/[id]` → "Wieder öffnen" UND zusätzlich der "Alte Forderungen"-Tab des Kunden (`/kunden/[id]` → Vertrieb → Forderungen) → "Löschen" der falschen Forderung | Beide zum Zurücksetzen nötigen Aktionen (Gutschrift wieder öffnen, Forderung löschen) existierten als API-Endpunkte bereits (`PUT /api/gutschriften/[id]` `{aktion:"wieder_oeffnen"}` aus einer früheren Zeile, `DELETE /api/kunden/[id]/forderungen?forderungId=`), waren aber nur auf ihren jeweils eigenen Seiten verlinkt — an der Stelle, wo der Fehler sichtbar wird (die Aufschlüsselungs-Zeilen in der Teilzahlungen-Karte auf `/lieferungen/[id]`), gab es keinen Rückgängig-Weg | Neue "Rückgängig"-/"Löschen"-Links direkt an den `gutschriftenVerbucht`- bzw. `forderungenAlsQuelle`-Zeilen in der Teilzahlungen-Karte (`app/lieferungen/[id]/page.tsx`, `handleGutschriftReopen()`/`handleForderungLoeschen()`) — rufen exakt dieselben bestehenden Endpunkte auf wie die Gutschrift- bzw. Kunden-Forderungen-Seite, keine neue Backend-Logik nötig; "Löschen" nur bei `!f.erledigt` sichtbar (eine bereits in eine Rechnung übernommene Forderung ist nicht mehr löschbar, siehe API-Guard). Nach beiden Aktionen `load()` der Lieferung, danach steht die Gutschrift im "Restbetrag klären"-Dropdown wieder als OFFEN zur Auswahl. End-to-end gegen die echte DB + Playwright verifiziert: kompletter Zyklus Verrechnen → Rückgängig (Gutschrift zurück auf OFFEN, `verbuchtBeiLieferungId` wieder `null`) → Forderung löschen → erneutes Verrechnen mit korrigiertem Betrag funktioniert lückenlos, ohne die Seite zu verlassen |
| "Restbetrag klären" bot als einzige Möglichkeit für den verbleibenden Restbetrag "auf die nächste Rechnung übernehmen" (`KundeForderung` → automatisch als zusätzliche Position bei der nächsten Rechnung dieses Kunden) — Kundenwunsch: stattdessen wahlweise eine EIGENSTÄNDIGE, separate Rechnung NUR über die Restdifferenz stellen können, mit für den Kunden nachvollziehbarem Rechenweg, ohne die Position mit der nächsten regulären Rechnung zu vermischen ("das verwirrt den Kunden") | `verrechneOffeneRestdifferenz()` kannte für den Restbetrag nur den einen Pfad (KundeForderung-Anlage) | `verrechneOffeneRestdifferenz()` (`lib/lieferung.ts`) bekommt einen neuen `opts.modus: "forderung" \| "neue_rechnung"` (Standard weiterhin "forderung", volle Rückwärtskompatibilität). Bei "neue_rechnung" wird statt einer `KundeForderung` eine neue `Lieferung` mit **sofort vergebener Rechnungsnummer** (`vergebeRechnungsnummerFuerLieferung()`) und genau EINER Position angelegt — neuer Ausgleichs-Artikel `RESTDIFFERENZ` (via bereits vorhandenem `ladeOderErstelleAusgleichsArtikel()`, mwstSatz 0 wie bei "Alte Forderung"/"Gutschrift-Verrechnung", keine Doppelbesteuerung), `Lieferposition.notiz` enthält denselben Rechenweg-Text wie bisher der `KundeForderung.grund` ("Restdifferenz Rechnung RE-…: Offener Betrag X € ./. Gutschrift Y (Z €) = W €") — erscheint dadurch direkt auf dem Lieferschein/der Rechnung als sichtbare Notizzeile. Response liefert dann `neueRechnung:{id,rechnungNr}` statt `forderung`. `POST /api/lieferungen/[id]/restdifferenz` reicht `modus` aus dem Body durch (Whitelist, Default "forderung" bei ungültigem/fehlendem Wert). Frontend (`app/lieferungen/[id]/page.tsx`): neue Radio-Auswahl ("Auf nächste Rechnung übernehmen" / "Eigene Rechnung … erstellen") erscheint nur, wenn nach der optionalen Gutschriftverrechnung überhaupt ein Restbetrag verbleibt; bei "neue_rechnung" navigiert `handleRestdifferenz()` nach Erfolg direkt zu `/lieferungen/{neueRechnung.id}/rechnung`, damit der Rechenweg sofort sichtbar ist — kein zusätzliches `load()` der Ursprungslieferung nötig. Bewusst KEINE Sonderbehandlung, die das nachträgliche Hinzufügen weiterer Positionen zur neuen Rechnung verhindert — sie ist eine ganz normale `Lieferung`/Rechnung, das bereits bestehende "Artikel hinzufügen" bleibt verfügbar, falls im Einzelfall doch gewünscht. End-to-end gegen die echte DB + Playwright verifiziert: neue Rechnung bekommt korrekte, fortlaufende Rechnungsnummer, genau eine `RESTDIFFERENZ`-Position mit korrektem Betrag (Brutto-Restdifferenz, siehe Zeile zwei weiter oben) und vollständigem Rechenweg in der Notiz, KEINE `KundeForderung` wird angelegt, Navigation landet direkt auf der neuen Rechnungs-Druckseite mit sichtbarem Rechenweg |
| DATEV-Export bucht Ausgleichspositionen ("Alte Forderung"/"Gutschrift-Verrechnung"/"Restdifferenz", siehe drei Zeilen weiter oben — allesamt mwstSatz 0, kein neuer Umsatz) auf ein normales **Erlöskonto** (SKR03 8000 / SKR04 4200, wie jeder andere 0%-Umsatz auch) — steuerlich unproblematisch (keine doppelte MwSt, siehe unten), aber buchhalterisch falsch: der zugrunde liegende Umsatz wurde bereits mit der ursprünglichen Rechnung verbucht, eine zweite Erlösbuchung für denselben Vorgang verfälscht GuV und Umsatz-Statistiken nach oben | `buildDatevCsv()` (`lib/datev.ts`) gruppierte Lieferungs-/Sammelrechnungs-/Gutschrift-Positionen ausschließlich nach `mwstSatz` (`Map<number, number>`) und buchte jede Gruppe pauschal über `erloeseKonto(satz, kontenrahmen)` — ohne nach Artikelnummer zu unterscheiden, ob eine Position echter Umsatz oder eine reine Ausgleichsposition ist. Steuerlich korrekt bleibt es trotzdem: da `mwstSatz=0` und kein Steuerbetrag gesondert ausgewiesen wird, entsteht keine unrichtige/doppelte Steuerschuld nach § 14c UStG — nur die Erlösklassifizierung war falsch | Neues, dependency-freies `lib/ausgleichsartikel.ts` (`AUSGLEICHS_ARTIKELNUMMERN`, `istAusgleichsArtikelnummer()`) als einzige Quelle der Wahrheit für die drei Artikelnummern — `lib/lieferung.ts` importiert sie jetzt von dort (keine lokalen Konstanten mehr, `GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER` bleibt zur Rückwärtskompatibilität von dort re-exportiert). Neue Einstellung `datev.verrechnungskonto` (`/einstellungen/datev`, Vorschlag „1590" — SKR03 „Verrechnungskonto", muss mit dem Steuerberater abgestimmt werden): ist sie gesetzt, bucht `buildDatevCsv()` Ausgleichspositionen separat auf dieses Konto statt in die normale `byMwst`-Erlösgruppierung; ist sie leer, bleibt es beim bisherigen Verhalten (kein Verhaltensbruch für bestehende Exporte ohne konfiguriertes Konto). Negative Ausgleichsbeträge (z.B. eine "Gutschrift-Verrechnung" mit `verkaufspreis < 0`) werden dabei korrekt über `Math.abs()` + Soll/Haben-Tausch statt eines negativen Umsatz-Werts abgebildet — DATEV-EXTF-Format erwartet vorzeichenlose Beträge. End-to-end gegen die echte DB verifiziert: eine Lieferung mit normaler 19%-Position + `RESTDIFFERENZ`-Position liefert ohne konfiguriertes Verrechnungskonto weiterhin eine 0%-Zeile auf Erlöskonto 8000 (unverändertes Altverhalten), mit konfiguriertem Konto "1590" landet die Ausgleichsposition korrekt getrennt auf 1590 statt 8000; eine negative `GUTSCHRIFT-VERRECHNUNG`-Position (−30 €) erzeugt korrekt "30,00;H" statt "−30,00;S" |
| Gehaltsabrechnungen (`Gehaltsabrechnung`, `/personal/abrechnungen` + Tab "Abrechnung" auf `/personal/[id]`) hatten keine Löschen-Möglichkeit im Frontend, obwohl der Backend-Endpunkt (`DELETE /api/personal/abrechnungen/[id]`) bereits existierte und ausgezahlte Abrechnungen bereits korrekt sperrte (409) — z.B. eine versehentlich angelegte Test-/Doppel-Abrechnung ließ sich nicht mehr entfernen. Zusätzlich war die DELETE-Route nur auf eine gültige Session geprüft (`verifySession`), nicht auf die Rolle — jeder angemeldete Nutzer hätte sie per direktem API-Aufruf löschen können | Reines UI-Lücke (kein Löschen-Button vorhanden) plus fehlende Rollenprüfung server-seitig | `DELETE /api/personal/abrechnungen/[id]` prüft jetzt zusätzlich `session.rolle !== "admin"` → 403 (Muster wie `GET /api/benutzer`). Neuer "Löschen"-Button an beiden Stellen (`/personal/abrechnungen`-Liste und Abrechnung-Tab auf `/personal/[id]`), sichtbar nur für Admins (`fetch("/api/auth/me")` → `user.rolle === "admin"`, Muster wie `components/Nav.tsx`) und nur bei Status OFFEN/ABGERECHNET (AUSGEZAHLT bleibt serverseitig ohnehin gesperrt, Button wird für diesen Status gar nicht erst angezeigt). End-to-end gegen die echte DB + Playwright verifiziert: Admin sieht/nutzt den Button erfolgreich (DELETE liefert 200, Zeile verschwindet), Nicht-Admin sieht keinen Button UND ein direkter API-Aufruf wird mit 403 abgelehnt |
| Mitarbeiter-Stammdaten (`/personal/[id]`, Tab "Stammdaten") waren rein lesend — änderte sich z.B. das Gehalt, gab es keine Möglichkeit, das im Frontend zu pflegen, obwohl `PUT /api/personal/mitarbeiter/[id]` bereits alle Felder unterstützte | Reine UI-Lücke — kein Bearbeiten-UI vorhanden, nur "Deaktivieren" | Inline-Bearbeiten-Toggle nach dem etablierten Muster von `app/lieferanten/[id]/page.tsx` (kein `/neu`-Formular, sondern `editing`/`editForm`-State direkt im Stammdaten-Tab): "Bearbeiten"-Button ersetzt die 4 lesenden Karten (Beschäftigung/Vergütung/Kontakt/Bankverbindung + Notiz) durch dieselben Felder als Eingabeformular (Struktur/Labels 1:1 aus `app/personal/neu/page.tsx` übernommen), "Speichern" ruft `PUT /api/personal/mitarbeiter/[id]`. End-to-end gegen die echte DB + Playwright verifiziert: Grundgehalt- und Telefon-Änderung werden korrekt gespeichert und überstehen einen Seiten-Reload |
| Eine eigens angelegte Rolle ohne `a.artikel.loeschen` konnte trotzdem Artikel löschen (per Klick auf den Löschen-Button, aber auch per direktem API-Aufruf) — ebenso ließen sich Artikel anlegen/bearbeiten, Kunden anlegen/bearbeiten/löschen, Lieferungen anlegen/stornieren, Angebote anlegen/bearbeiten, Lagerkorrekturen/Wareneingänge buchen, Lieferschein/Rechnung exportieren bzw. per Mail versenden und praktisch jede KI-Analysefunktion nutzen, unabhängig davon, ob die jeweilige `a.*`-Checkbox in der Rollen-Berechtigungsmatrix (`/einstellungen/benutzer`) gesetzt war oder nicht | `requirePermission()`/`hasPermission()` (`lib/permissions.ts`) waren zwar vollständig implementiert und wurden in der Settings-UI korrekt angezeigt/gespeichert, aber `requirePermission()` wurde für praktisch keine der ~19 `a.*`-Aktionspermissions tatsächlich in der zugehörigen API-Route aufgerufen — nur `EXPORT_DATEV`, `EXPORT_BULK` und `EINSTELLUNGEN_BEARBEITEN` waren serverseitig verdrahtet. Jede andere Checkbox in der Berechtigungsmatrix war dadurch reine Kosmetik: nur der Seitenzugriff (`s.*`) und die EK-Preis-Feldfilterung (`f.artikel.einkaufspreis`) griffen tatsächlich | `requirePermission(me, P.X)` als erste Zeile in der jeweils zuständigen Route ergänzt (Muster identisch zu `EXPORT_DATEV`): `ARTIKEL_ERSTELLEN`/`_BEARBEITEN`/`_LOESCHEN` in `POST /api/artikel` + `PUT`/`DELETE /api/artikel/[id]`; `KUNDEN_ERSTELLEN`/`_BEARBEITEN`/`_LOESCHEN` in `POST /api/kunden` + `PUT`/`DELETE /api/kunden/[id]`; `LIEFERUNGEN_ERSTELLEN` in `POST /api/lieferungen`; `LIEFERUNGEN_STORNIEREN` in `PUT /api/lieferungen/[id]` nur wenn `data.status === "storniert"` angefordert wird (die übrige, nicht separat berechtigungspflichtige Bearbeitung bleibt unverändert erlaubt); `ANGEBOTE_ERSTELLEN` in `POST /api/angebote`, `ANGEBOTE_BEARBEITEN` in `PUT /api/angebote/[id]` (deckt auch die Sonderaktion `aktion:"annehmen"` ab); `LAGER_WARENEINGANG`/`LAGER_KORREKTUR` in `POST /api/lager/wareneingaenge` bzw. `POST /api/lager/korrektur`; `EXPORT_LIEFERSCHEIN`/`EXPORT_RECHNUNG`/`EXPORT_RECHNUNG_MAIL` in den jeweiligen `GET`/`POST /api/exporte/*`-Routen; `KI_NUTZEN` in allen 15 tatsächlich KI-aufrufenden `/api/ki/*`-Routen (`analyze`, `beleg`, `inhaltsstoffe`, `transcribe`, `tts`, `bankabgleich`, `mahnungstext`, `sortenversuch`, `sachkundenachweis`, `schlaegte`, `bodenprobe`, `visitenkarte`, `router`, `lieferung/batch/[id]/analyze`, `eingangsrechnung/batch/[id]/analyze`) — bewusst NICHT bei `churn`/`statistik`/`preis-empfehlung`/`lernen`/`test` (dokumentiert kein echter KI-Aufruf bzw. reiner Verbindungstest). End-to-end gegen die echte DB verifiziert: eine Testrolle mit exakt `["s.artikel","a.artikel.erstellen"]` (identisch zum gemeldeten Fall) kann weiterhin Artikel anlegen (201), aber Bearbeiten/Löschen liefern jetzt korrekt 403 statt vorher erfolgreich durchzugehen; eine Rolle ganz ohne Aktionsrechte bekommt 403 auf Lagerkorrektur/Angebot-erstellen/KI/Export/Kunde-erstellen; der Legacy-Admin (`rolle:"admin"`, `rolleId:null`) kann weiterhin uneingeschränkt Artikel anlegen und löschen (kein Regressionsverhalten) |
| `components/Nav.tsx` zeigte JEDER Rolle das komplette Hauptmenü inkl. aller Dropdown-Reiter (z.B. "Pflanze & Tier" mit Bodenproben/Sortenversuche/PSM/Rationsberechnung) unabhängig von deren Seiten-Berechtigungen (`s.*`) — eine Buchhaltung-Rolle ohne jegliche Agrar-Berechtigung sah trotzdem den vollständigen "Pflanze & Tier"-Reiter, obwohl sie dort nichts zu suchen hat | Nav.tsx filterte Gruppen/Menüpunkte ausschließlich nach Modul-Konfiguration (`modulDisabledHrefs`, aus `/api/einstellungen?prefix=modul.`), aber nie nach der Rollen-Berechtigungsmatrix — `hasPermission()`/`usePermission()` (siehe Zeile direkt darüber) existierten zwar bereits inkl. eines fertigen Client-Context (`lib/user-context.tsx`, `UserProvider` in `app/layout.tsx`), wurden in `Nav.tsx` aber nie genutzt | Neue `NAV_PERMISSION`-Lookup-Tabelle (href ohne Query-String → benötigte `s.*`-Permission) in `components/Nav.tsx`, genutzt via `useCurrentUser()` + `hasPermission()`; `isHrefAllowed()` prüft zusätzlich zur bestehenden Modul-Sperre jetzt auch die Permission, Gruppen mit anschließend leerer `children`-Liste werden komplett ausgeblendet (identisches Muster wie die bestehende `modulDisabledHrefs`-Filterung, in einer Funktion zusammengeführt). Bewusst **keine neuen Permission-Konstanten erfunden** — jeder Nav-Eintrag wird nur auf eine bereits existierende `P.*`-Permission gemappt (inkl. sinnvoller Bucket-Zuordnung analog zu `MODULE_HREFS`, z.B. Albrecht-Analyse/DüV/Anbauplanung/Zwischenfruchtrechner/Zertifizierungen → `P.BODENPROBEN`, Sachkundenachweise → `P.PSM`, Kalkulation → das bereits vorhandene `P.FELD_KALKULATION`); ein Eintrag ohne Mapping (z.B. `/crm`, `/personal/*`, `/anlieferungen`, Eierhandel-Seiten) bleibt für **jede** Rolle sichtbar, damit das Ausrollen dieser Liste keiner bereits bestehenden Rolle unbemerkt Seiten entzieht, für die es schlicht noch keine granulare Permission gibt. End-to-end gegen die echte DB + Playwright verifiziert: eine Testrolle mit `["s.dashboard","s.artikel","a.artikel.erstellen","s.rechnungen","s.bankabgleich","s.mahnwesen"]` (Buchhaltung-artiges Profil aus der Meldung) sieht "Finanzen" und "Artikel & Lager" weiterhin, "Pflanze & Tier" und "Vertrieb" verschwinden komplett aus dem Menü, "Preiskalkulation" fehlt im Artikel-Dropdown (kein `f.kalkulation`); der Legacy-Admin sieht weiterhin alle Gruppen unverändert (keine Regression) |
| Arbeitszeiterfassung (`Arbeitsstunde`) gab es nur als rein manuelles Einzelformular (`/personal/[id]/stunden/neu`, Stunden-Feld hart auf "8" vorbelegt) — keine Vorbelegung aus üblichen Arbeitszeiten und keine Möglichkeit, an einem Tag mehrere/alle Mitarbeiter auf einen Blick zu erfassen, ohne für jeden einzeln in dessen Detailseite zu wechseln | `Mitarbeiter` hatte kein Feld für bevorzugte/übliche Arbeitszeiten je Wochentag, und es gab keine mitarbeiterübergreifende Tages-Erfassungsseite (nur die Abrechnungen-Liste `/personal/abrechnungen` existierte als mitarbeiterübergreifende Personal-Seite) | Neues Feld `Mitarbeiter.bevorzugteArbeitszeiten String?` (JSON `{mo,di,mi,do,fr,sa,so}` in Stunden) — Eingabe als 7 Zahlenfelder im Stammdaten-Bearbeiten-Formular auf `/personal/[id]`, kompakte Zusammenfassung in der Lese-Ansicht. Neue Helper `sollStundenFuerDatum()`/`parseBevorzugteArbeitszeiten()`/`wochentagKeyFuerDatum()` in `lib/utils.ts` als einzige Quelle der Wahrheit für die Vorschlagsberechnung (bevorzugte Arbeitszeit für den Wochentag, sonst Fallback `wochenstunden/5` an Werktagen bzw. 0 am Wochenende, sonst der alte Standardwert 8h). `/personal/[id]/stunden/neu` nutzt den Vorschlag jetzt als abgeleiteten Wert (nicht per Effect synchronisiert — vermeidet den `react-hooks/set-state-in-effect`-Lint-Fehler) und aktualisiert ihn bei Datumswechsel, solange der Nutzer das Stunden-Feld noch nicht selbst angefasst hat (analog `vkAuto`-Muster in `lieferungen/neu`). Neue Seite `/personal/arbeitszeiterfassung` (neuer Nav-Eintrag unter Personal → Abrechnung) zeigt für ein wählbares Datum alle aktiven Mitarbeiter mit vorbelegten Stunden/Art, "Bestätigen" legt den `Arbeitsstunde`-Eintrag an (oder aktualisiert ihn, falls für diesen Tag bereits einer existiert — kein neues Duplikat), "Alle N mit Vorschlag bestätigen" erledigt alle noch offenen Zeilen in einem Klick. End-to-end gegen die echte DB + Playwright verifiziert: bevorzugte Montags-Arbeitszeit (7,5h) wird sowohl im Einzelformular als auch in der neuen Sammel-Erfassungsseite korrekt vorgeschlagen, ein Wochentag ohne konfigurierten Wert fällt korrekt auf `wochenstunden/5` zurück, Bestätigen legt den Eintrag korrekt an und übersteht einen Seiten-Reload (inkl. erneuter Datumswahl, da das Datum bewusst reiner Client-State ist) |
| Lieferantenbestellungen-Liste (`/bestellungen`) zeigte pro Zeile nur Nummer/Datum/Lieferant/Status — beim Suchen nach "wo/für welchen Kunden wurde was bestellt" (Streckengeschäft) musste jede Bestellung einzeln geöffnet werden, um zu sehen, ob und für wen sie direkt an einen Kunden geliefert wird | `GET /api/bestellungen` lieferte keinerlei Kundenbezug — die Streckengeschäft-Kundenzuordnung lebt auf den `Bestellposition`-Einträgen (`Bestellung.bestelllisteEintraege`, die "Bestellliste"), NICHT auf `BestellungPosition` (den fertig gebündelten Zeilen, die gar kein `kundeId`-Feld haben); nur der einzelne E-Mail-Versand (`app/api/bestellungen/[id]/mail/route.ts`) löste das bereits pro Bestellung eindeutig auf (`versandKunde`), aber nicht die Liste | `GET /api/bestellungen` lädt zusätzlich `bestelllisteEintraege: { select: { kundeId: true } }` und wendet dieselbe Eindeutigkeits-Regel wie beim E-Mail-Versand an (Lieferort nur, wenn ALLE Bestellliste-Einträge einer Bestellung auf genau denselben Kunden zurückgehen, sonst bleibt es leer — mehrdeutig/manuell aus mehreren Kunden gebündelt/reine Lagerbestellung ohne Kundenbezug); die dafür nötigen Kundennamen werden in einer einzigen gebündelten `kunde.findMany({where:{id:{in:[...]}}})`-Query nachgeladen (kein N+1 über die Liste). Antwort trägt neu `versandKunde:{name,ort}|null` je Bestellung; `/bestellungen` zeigt das als kompakte "📍 Kundenname (Ort)"-Zeile direkt unter dem Lieferantennamen (immer sichtbar, auch mobil, kein zusätzliches `hidden`-Spalten-Gedöns nötig). End-to-end gegen die echte DB verifiziert: eine aus einer einzelnen Streckengeschäft-Position gebündelte Bestellung zeigt korrekt Kundenname+Ort, eine normale Lagerbestellung ohne Bestellliste-Bezug bleibt leer, eine aus zwei unterschiedlichen Kunden zusammengeführte Bestellung bleibt ebenfalls bewusst leer (mehrdeutig) |
| Nach Einführung des Lieferort-Hinweises in `/bestellungen` (siehe Zeile direkt darüber) gab es noch keine Möglichkeit, gezielt nach einem bestimmten Lieferort/Kunden zu filtern — bei vielen offenen Bestellungen musste man weiterhin die ganze Liste visuell nach dem "📍"-Hinweis durchsuchen | Nur Status- und Lieferant-Filter (serverseitig über Query-Parameter) vorhanden, kein Text-Filter für den neu hinzugekommenen `versandKunde` | Neues Textfeld "Lieferort/Kunde suchen…" in der Filterleiste von `app/bestellungen/page.tsx` — filtert rein clientseitig (`gefiltert`-Array) auf der bereits geladenen Seite gegen `versandKunde.name`/`.ort` (case-insensitive, Teilstring), analog zum bestehenden `matchSearch`-Muster in `/rechnungen`; kein neuer API-Parameter nötig, da `GET /api/bestellungen` bereits alle nach Status/Lieferant gefilterten Zeilen inkl. `versandKunde` an den Client liefert. Eigener Leer-Zustand "Kein Lieferort passend zu „…" gefunden." unterscheidet sich vom generischen "Keine Bestellungen gefunden."; "Filter zurücksetzen" leert jetzt auch dieses Feld. End-to-end gegen die echte DB + Playwright verifiziert: Suche nach Kundenname UND nach reinem Ortsnamen (ohne dass der Name selbst eingegeben wird) findet jeweils korrekt genau die eine passende Bestellung, ein nicht passender Suchbegriff zeigt den eigenen Leer-Hinweis, Zurücksetzen bringt alle Zeilen zurück |
| Neue Retoure (`/retouren/neu`): ein tatsächlich angelegter Artikel ("ES Alicia") ließ sich in der Artikel-Auswahl einer Position nicht finden ("Nichts gefunden"), obwohl er existiert | `SearchableSelect` filtert ausschließlich clientseitig über die per Prop übergebenen `options` — es gibt keine Server-Nachfrage pro Tastenanschlag. `app/retouren/neu/page.tsx` lud die Artikelliste beim Öffnen der Seite aber nur mit `GET /api/artikel?limit=500` (Standard-Sortierung `orderBy:{name:"asc"}`) — bei mehr als 500 aktiven Artikeln fallen alphabetisch spät einsortierte Artikel (z.B. mit "L"/"Z" beginnende Sortennamen) komplett aus der geladenen Liste heraus, unabhängig vom Suchbegriff. Derselbe Bug-Typ wie beim früheren Kunden-/Artikel-Picker-Problem (siehe Zeilen weiter oben zu `GET /api/kunden` und den `?limit=500`→`?limit=5000`-Fixes bei Sammelrechnung/Vorbestellung/Gutschrift/Inventur/Artikel-Verschmelzen) — bei Retouren wurde er beim Feature-Bau übersehen | `app/retouren/neu/page.tsx` fragt jetzt `?limit=5000` an (gleiches Muster/Obergrenze wie `gutschriften/neu`, `vorbestellungen/neu`, `inventur/neu`, `artikel/verschmelzen`, `lieferungen/neu`); end-to-end gegen die echte DB verifiziert (550 alphabetisch davorliegende Füllartikel + ein Ziel-Artikel weit hinter Position 500) — Artikel erscheint jetzt korrekt in der Suche und lässt sich auswählen. Derselbe Musterfehler steckte noch unbehoben in 11 weiteren Seiten — siehe Zeile direkt darunter für den Sammel-Fix |
| Derselbe `?limit=500`/`?limit=1000`-Musterfehler (siehe Zeile direkt darüber, Retouren) steckte unbehoben noch in 11 weiteren Artikel-Picker-Seiten — sowohl bei `SearchableSelect`-Comboboxen als auch beim rein clientseitig gefilterten Lagerbestand (`/lager`, keine `SearchableSelect`-Komponente, aber dieselbe Ursache: Filter+Kategorie-Dropdown leiten sich aus derselben gedeckelt geladenen Artikelliste ab) | Beim Bau jeder einzelnen Seite wurde `?limit=500` (bzw. `?limit=1000` bei `anlieferungen/neu`) kopiert, ohne das inzwischen etablierte `?limit=5000`-Muster (siehe `GET /api/artikel`-Obergrenze `Math.min(5000,…)`) nachzuziehen | `?limit=500`→`?limit=5000` (bzw. `?limit=1000`→`?limit=5000`) in `app/bestellungen/neu/page.tsx`, `app/kontrakte/neu/page.tsx`, `app/sammelbestellung/page.tsx`, `app/kampagnen/neu/page.tsx`, `app/kampagnen/[id]/page.tsx`, `app/tourenplanung/page.tsx` (2 Vorkommen), `app/lager/umbuchungen/page.tsx`, `app/lager/etiketten/page.tsx`, `app/lager/chargen/zertifikate/page.tsx`, `app/lager/page.tsx`, `app/angebot-vorlagen/neu/page.tsx`, `app/anlieferungen/neu/page.tsx`; end-to-end gegen die echte DB + Playwright an zwei repräsentativen Seiten verifiziert (550 Füllartikel + 1 Ziel-Artikel weit hinter Position 500): `bestellungen/neu` (SearchableSelect-Muster) findet den Artikel jetzt korrekt in der Positions-Auswahl, `/lager` (Suchfeld+Kategorie-Filter ohne SearchableSelect) filtert korrekt auf genau die eine Zeile |
| Bankabgleich "Automatischer Abgleich": Zahlbetrags-Abweichungen (z.B. Fehlbetrag/Überzahlung) im Tab "Abweichung" ließen sich nur einzeln durchklicken — kein Sammel-Workflow wie im "Sicher"-Tab (dort "✓ 100% übernehmen"/"Alle prüfen & übernehmen"), zusätzlich unterbrach `window.confirm()` bei Gutschrift/Forderung den Ablauf. Kundenmeldung dabei zusätzlich aufgedeckt: das Feld "Betragstoleranz (€)" wurde fälschlich als "diese Fälle ganz aus dem Abgleich ausschließen"-Filter benutzt (niedrig/0 gesetzt) — dadurch verschwanden die Differenz-Fälle komplett aus "Abweichung" und landeten ganz ohne Kandidatenvorschlag im Tab "Nur Bank" | `runNormalMatch()` (`lib/bankabgleich-matching.ts`) nutzt für "Sicher" (Pass 1) einen fest codierten `AMOUNT_EXACT = 0.005`-Cent-Schwellwert, unabhängig von der einstellbaren `amountTolerance` — die steuert ausschließlich Pass 2 ("Abweichung"). Das war im UI nirgends erklärt: ein niedrig gesetzter Wert wirkte dadurch wie ein Ausschlussfilter für die Differenzprüfung insgesamt, statt nur zu bestimmen, ob ein Fall noch als Kandidat mit Aktionen erscheint oder komplett in "Nur Bank" (nur ein passiver Hinweistext, keine Zuordnungs-Buttons) fällt | Neuer Hinweistext unter dem Betragstoleranz-Feld in `AutomatischerAbgleich.tsx` erklärt explizit, dass der Wert nur "Abweichung" betrifft und "Sicher" davon unberührt bleibt (kann großzügig gesetzt werden, ohne Fehlzuordnungen zu riskieren). Neue Übersichtsleiste im "Abweichung"-Tab (Anzahl + Gesamtdifferenz) mit Button "Schritt für Schritt durchgehen" öffnet ein Review-Modal (`deviationReviewOffen`/`deviationIndex`-State), das die `AutoMatchKarte`/`ZuordnungsVorschlagCard`-Komponente einzeln durchreicht statt eines Grids — Index bleibt nach einer erledigten Zeile unverändert, da `entferneAusListe()` das Array filtert und die nächste Zeile automatisch an dieselbe Position nachrückt ("← Zurück"/"Überspringen →" zum Browsen ohne Aktion, "✓ Alle Abweichungen abgearbeitet" bei leerer Liste). `ZuordnungsVorschlagCard`s `window.confirm()` bei Gutschrift/Forderung durch inline eingeblendete Bestätigung (`pendingAktion`-State, "Ja, erfassen"/"Abbrechen") ersetzt — wirkt in allen drei Verwendungsorten (Inline-Panel `/bankabgleich`, "Sicher"/"Abweichung"-Grid, neues Review-Modal) einheitlich, kein Browser-Dialog unterbricht mehr den Ablauf. End-to-end gegen die echte DB + Playwright verifiziert: Testfall mit 15 € Fehlbetrag (Betragstoleranz auf 50 € gesetzt) erscheint korrekt unter "Abweichung" (nicht mehr "Nur Bank"), Review-Modal zeigt "1 von 1", Klick auf "+ Forderung über 15,00 € erfassen" zeigt Inline-Bestätigung ohne natives `confirm()`, nach Bestätigen: `Kontoumsatz.zugeordnet=true`, `Lieferung.bezahltAm` gesetzt, `KundeForderung` über 15 € korrekt angelegt, Modal zeigt danach "Alle Abweichungen abgearbeitet" |
| Neuer Auftrag (`/lieferungen/neu`) auf dem Handy: Nutzer meldete, beim Ausfüllen "springt" die Seite dauernd weg / Eingabefelder verlieren den Fokus. Konnte in der lokalen Dev-Umgebung NICHT eins-zu-eins reproduziert werden (dort nur 3 Artikel/1 Kunde vorhanden — Next.js-Dev-Mode-Overhead dominierte jeden CPU-Throttling-Test) — zwei konkrete, unabhängig verifizierte Ursachen mit demselben Symptom-Bild wurden trotzdem gefunden und behoben; falls das Problem nach diesem Fix weiter auftritt, sind weitere konkrete Repro-Schritte (genaues Feld, Browser, Zeitpunkt) nötig | (1) `positionen`-State ändert sich bei JEDEM Tastendruck in Menge/EK/VK/Notiz irgendeiner Position → die ganze Seite rendert neu → jede Positionszeile bildete ihre `SearchableSelect`-Artikelliste (bis zu 5000 Einträge) per Inline-`.map()` NEU ab, plus die Kundenliste (bis zu 1000) oben — unmemoisiert, bei jedem Tastendruck erneut. (2) `SearchableSelect` selbst berechnete `filtered = options.filter(...)` IMMER, auch wenn das Dropdown geschlossen war und das Ergebnis gar nicht gerendert wurde — bei mehreren geschlossenen Positionszeilen gleichzeitig unnötige Arbeit auf jedem Tastendruck. (3) Zusätzlich unabhängig gefunden: der Sprengstoffvorläufer-Erklärung-`useEffect` hatte `positionen` (Objekt-Referenz, ändert sich bei jedem Tastendruck) als Dependency statt nur der booleschen Frage "ist mind. 1 Position betroffen" — bei einer Bestellung mit Sprengstoffvorläufer-Artikel löste das bei JEDEM Tastendruck in einem völlig anderen Feld einen neuen Server-Request aus UND setzte die bereits vom Nutzer gesetzte Bestätigungs-Checkbox `erklaerungBestaetigt` still zurück auf `false` | (1)+(2) gemessen per Playwright + `Emulation.setCPUThrottlingRate` (CDP): 150–1000ms Blockierung des Main-Threads pro Tastendruck unter 6×/20×-Drosselung vor dem Fix. Neue `useMemo`-Werte `kundenOptions`/`artikelOptions`/`lieferantenOptions` in `app/lieferungen/neu/page.tsx` (abhängig von `kunden`/`artikel`/`lieferanten`, NICHT von `positionen`) ersetzen die Inline-`.map()`-Aufrufe. `components/SearchableSelect.tsx`: `filtered` wird nur noch berechnet, wenn `open === true` (`filtered = open ? options.filter(...) : []`) — wirkt für ALLE Nutzungen von `SearchableSelect` im gesamten Projekt, nicht nur diese Seite. (3) Neuer `hatSprengstoffPosition`-`useMemo` (boolescher Primitivwert) ersetzt `positionen` als Effekt-Dependency — der Effekt feuert jetzt nur noch, wenn sich der Kunde ändert oder sich die Sprengstoffvorläufer-Betroffenheit tatsächlich ändert (Artikelwechsel), nicht mehr bei jedem Tastendruck in Menge/Notiz/Preis. End-to-end gegen die echte DB + Playwright (iPhone-Viewport) verifiziert: kompletter Auftrag (Kunde wählen → Artikel wählen → Menge/Preis/Notiz eintragen → Absenden) legt weiterhin korrekt eine `Lieferung`+`Lieferposition` an und navigiert zum Lieferschein — keine Funktionsregression durch die Performance-Fixes |
| Nach dem vorigen Fix (Zeile direkt darüber) meldete der Nutzer weiter Probleme beim Erfassen eines Auftrags auf dem Handy — ein Screenshot der Produktivinstanz zeigte den Grund: die "Kunde"-Auswahl auf `/lieferungen/neu` war komplett LEER ("Nichts gefunden" bei leerem Suchfeld), auf sichtbar schwachem Mobilfunknetz (2 von 4 Balken) | `load()` in `app/lieferungen/neu/page.tsx` hatte `try { …await Promise.all([4 parallele fetch()-Aufrufe])…; …setKunden/setArtikel/… } finally { setLoading(false); }` — OHNE `catch`. Schlägt einer der 4 parallelen Fetches auf echter Netzwerkebene fehl (Verbindungsabbruch/Timeout, wie bei schwachem Empfang plausibel), lehnt `Promise.all` komplett ab, KEINER der `set*`-Aufrufe läuft — aber `finally` setzt `loading` trotzdem auf `false`, wodurch das Formular mit still leeren Kunden-/Artikel-/Lieferanten-Listen und ganz ohne Fehlermeldung rendert; wirkte für den Nutzer wie "die App reagiert nicht"/"springt weg" | `load()` zu `useCallback` umgebaut (aufgerufen aus eigenem `useEffect(() => { load(); }, [load])`), neuer `catch`-Block setzt einen neuen `loadError`-State auf einen erklärenden Text — bewusst KEIN zusätzliches `Sentry.captureException()` darin, da `lib/fetch-reporter.ts` echte Netzwerkfehler auf `/api/*` bereits automatisch in den GlitchTip-Log-Strom meldet (Doppel-Reporting wäre der Verstoß, nicht das Fehlen einer eigenen Meldung). Neue rote Banner-Zeile ganz oben auf der Seite zeigt `loadError` mit Button "Erneut versuchen" (ruft `load()` erneut auf, resettet `loadError` zu Beginn). End-to-end mit echtem Login + Playwright-Routen-Interception verifiziert (`/api/kunden`-Request gezielt mit `route.abort("failed")` als echter Netzwerkfehler simuliert, nicht nur eine Non-OK-Antwort): Banner erscheint mit dem erwarteten Text, `lib/fetch-reporter.ts` meldet den Netzwerkfehler unabhängig davon wie dokumentiert, Klick auf "Erneut versuchen" lädt erfolgreich nach — Banner verschwindet, Kunde-Dropdown zeigt danach die echten Kunden statt "Nichts gefunden"; regulärer (nicht-fehlerhafter) Seitenaufruf zeigt weiterhin kein Banner (keine Regression) |
| Bevor der vorige `catch`-Fix (Zeile direkt darüber) überhaupt ausgeliefert war, schickte der Nutzer einen weiteren Screenshot derselben Seite (`/lieferungen/neu`, wieder schwaches Mobilfunknetz) — diesmal blieb die Seite komplett auf "Lade Daten..." hängen, kam also nicht einmal bis zum (damals noch unbehobenen) leeren Formular | Ein `catch`-Block fängt nur eine ABGELEHNTE Promise ab — auf sehr schwachem Mobilfunknetz hängt ein `fetch()` aber oft einfach fest (die TCP-Verbindung kommt weder durch noch bricht sie sauber ab), die Promise löst sich also NIE auf (weder resolve noch reject). Weder der alte Code noch der `catch`-Fix aus der Zeile darüber können das behandeln — `finally { setLoading(false) }` wird ja nie erreicht, solange `await` auf eine ewig hängende Promise wartet. Per Playwright reproduziert: eine Route, die eine Anfrage einfach nie beantwortet (kein `fulfill`/`abort`/`continue`), lässt die Seite exakt wie im Screenshot für immer auf "Lade Daten..." stehen | Alle `fetch()`-Aufrufe in `load()` (die 4 parallelen Haupt-Requests im `Promise.all` UND die beiden optionalen Nachlade-Fetches für Kunden-Vorauswahl/Angebots-Vorbefüllung, da auch die direkt awaited werden und die ganze Funktion blockieren könnten) bekommen jetzt `{ signal: AbortSignal.timeout(LADE_TIMEOUT_MS) }` (neue Modul-Konstante, 20000ms) — nach Ablauf bricht der Browser die Anfrage selbst ab und lässt die Promise mit einem `AbortError`/`TimeoutError` fehlschlagen, wodurch der bereits vorhandene `catch`-Block aus der Zeile darüber greift und `loadError` samt "Erneut versuchen"-Button zeigt, statt für immer auf "Lade Daten..." zu verharren. End-to-end mit echtem Login + Playwright-Routen-Interception verifiziert: eine Route, die `/api/kunden` absichtlich nie beantwortet, hält die Seite wie erwartet 20s auf "Lade Daten...", danach erscheint zuverlässig der Fehlerbanner mit funktionierendem "Erneut versuchen"; ein normaler (schneller) Seitenaufruf bleibt unverändert (~1,5s bis Formular bereit, kein Banner, Kunde korrekt im Dropdown) |
| Bankabgleich: eine bereits gestellte Rechnung (RE-2026-0755) hatte eine offene Gutschrift des Kunden — der Kunde überwies korrekt Rechnungsbetrag abzüglich Gutschrift, AGRI-Office erkannte das aber nicht: die Zahlung erschien nur als reine Betrags-"Abweichung" (Fehlbetrag in Höhe der Gutschrift) mit ausschließlich einem "+ Forderung erfassen"-Button — hätte man diesen genutzt, wäre fälschlich eine zusätzliche Forderung über einen bereits durch die Gutschrift korrekt abgedeckten Betrag entstanden | Der bereits vorhandene Skonto-Erkennungsmechanismus (`ReconCandidate.skontoAmount`/`skontoMatch` in `lib/bankabgleich-matching.ts`) prüft nur, ob der Bankbetrag dem Skonto-reduzierten Rechnungsbetrag entspricht — ein analoger Mechanismus für "Rechnungsbetrag abzüglich einer offenen Gutschrift desselben Kunden" existierte nicht; `bestimmeBetragsabweichung()` kannte nur volles Betrag vs. Skonto-Betrag, keine dritte Möglichkeit | Neues, zum Skonto-Mechanismus symmetrisches `gutschriftMatch`-Feld durch den kompletten Bankabgleich-Stack gezogen: `ReconCandidate.offeneGutschriften` (nur bei `kind:"lieferung"`, NICHT bei Sammelrechnung — `Gutschrift.verbuchtBeiLieferungId` kennt keine Sammelrechnung) wird in `ladeOffeneGutschriftenProKunde()` (`lib/bankabgleich-kandidaten.ts`, ein gebündelter `findMany` über alle betroffenen Kundinnen, kein N+1) geladen und an `ladeLieferungKandidaten()` angehängt (Brutto-Betrag via `berechneGutschriftBrutto()`, `lib/lieferung-brutto.ts`). `bestimmeBetragsabweichung()` (`lib/bankabgleich-matching.ts`) prüft jetzt zusätzlich für jede offene Gutschrift, ob `Rechnungsbetrag − Gutschriftbetrag` dem Bankbetrag am nächsten kommt (Toleranz wie beim normalen Abweichungs-Pass, `GUTSCHRIFT_ERKENNUNGS_TOLERANZ = DEFAULT_AMOUNT_TOLERANZ`) und markiert dann `gutschriftMatch` statt eines reinen Fehlbetrags; `runNormalMatch()`/`rankCandidatesForBank()`/`mergeAiMatches()` reichen das Feld durch. Neue `verbucheGutschriftGegenLieferung()` (`lib/gutschrift.ts`, exakt nach dem Muster der bestehenden `verrechneOffeneRestdifferenz()`-Verrechnung — Gutschrift wird OHNE neue Position auf `status:"VERBUCHT"` + `verbuchtBeiLieferungId` gesetzt, da die Rechnung bereits steht) wird in `PUT /api/bankabgleich/[id]` aufgerufen, wenn der Request-Body ein optionales `gutschriftIdFuerVerrechnung` mitschickt; die bereits vorhandene `oeffneGutschriftErneut()` macht das unverändert wieder rückgängig (funktioniert bereits für eine Gutschrift ohne Lieferposition, keine Anpassung nötig). `ZuordnungsVorschlagCard`/`AutoMatchKarte` zeigen bei `gutschriftMatch` einen grünen "✓ entspricht Rechnung abzüglich Gutschrift …"-Hinweis statt der amber Abweichungs-Warnung und blenden den "+ Forderung erfassen"-Button aus; sowohl das manuelle Inline-Panel (`app/bankabgleich/page.tsx`) als auch der Bulk-Review (`AutomatischerAbgleich.tsx`) reichen `gutschriftIdFuerVerrechnung` beim Übernehmen mit. End-to-end gegen die echte DB + Playwright verifiziert (reale Beträge aus der Meldung nachgebaut): Zahlung = Rechnung − offene Gutschrift wird korrekt mit grünem Hinweis erkannt, Übernehmen setzt `Lieferung.bezahltAm` UND `Gutschrift.status:"VERBUCHT"`/`verbuchtBeiLieferungId` korrekt, ohne neue Lieferposition; Regressionstest mit einem echten, Gutschrift-unabhängigen Fehlbetrag bei gleichzeitig vorhandener (aber unpassender) offener Gutschrift eines anderen Betrags zeigt weiterhin korrekt die amber Warnung + Forderung-Button, kein falsch-positiver grüner Hinweis; 6 neue Unit-Tests in `__tests__/lib/bankabgleich-matching.test.ts` |
| Kunde hatte 8 Rechnungen in einer Sammelüberweisung beglichen und dabei überzahlt — die Überzahlung wurde als manuelle `Teilzahlung` (mit erklärender Notiz) auf einer anderen, noch offenen Rechnung dieses Kunden angerechnet. Kundenwunsch: eine Übersicht per Mail an den Kunden schicken, die diese Zuordnung nachvollziehbar macht (Rechnungsbetrag, die Teilzahlung samt Notiz, verbleibender Restbetrag) — ausdrücklich OHNE die Rechnung selbst zu verändern oder erneut zu versenden | Kein Werkzeug vorhanden: die Teilzahlungs-Notiz war nur intern auf der Lieferungs-Detailseite sichtbar, und der bestehende "E-Mail"-Versand einer Rechnung (`POST /api/exporte/rechnung/mail`) verschickt immer nur die unveränderte Rechnungs-PDF mit festem Standardtext — kein Platz für Zahlungsstand-Infos, und der Nutzer wollte explizit **kein** Re-Send der Rechnung | Neue, komplett eigenständige Route `POST /api/lieferungen/[id]/zahlungsuebersicht/mail` (Body: `{empfaenger?, cc?}`, `P.EXPORT_RECHNUNG_MAIL` wie beim normalen Rechnungsversand) — lädt Lieferung + Teilzahlungen + verbuchte Gutschriften/Forderungen, berechnet Rechnungsbetrag über `berechneLieferungBrutto()` sowie den noch offenen Betrag exakt wie die Teilzahlungen-Karte auf `/lieferungen/[id]` (Brutto abzüglich Teilzahlungen/Gutschriften/Forderungen), und verschickt eine reine Info-Mail via neuer `zahlungsuebersichtEmail()` (`lib/email-templates.ts`) — **ohne PDF-Anhang und ohne jede Änderung an `Lieferung`/`rechnungVersendetAm`**. Die Mail listet Rechnungsnummer/-datum/-betrag, jede Teilzahlung mit Datum/Betrag/Notiz sowie optional zusätzlich verrechnete Gutschriften/Forderungen als eigene Zeilen, und schließt mit "Noch offener Betrag: X €" bzw. "Die Rechnung ist damit vollständig beglichen." bei 0. Neuer Button "📧 Zahlungsübersicht per E-Mail senden" in der Teilzahlungen-Karte (sichtbar sobald mind. eine Teilzahlung erfasst ist), öffnet die bereits bestehende `EmailVersandModal`-Komponente (`docType="rechnung"`, bevorzugt die als `rechnungsEmail` markierte Kontaktadresse) als zweite, unabhängige Modal-Instanz neben dem bestehenden Rechnungsversand. End-to-end gegen die echte DB + Playwright + lokalem Test-SMTP-Server verifiziert (reale Beträge aus der Meldung nachgebaut, 610,47 € Rechnung − 362,70 € Teilzahlung mit Notiz = 247,77 € offen): Button öffnet Modal mit korrekt vorbefüllter Adresse, tatsächlich zugestellte Mail (Text + HTML) zeigt exakt Rechnungsnummer/-datum/-betrag, Teilzahlungsdatum/-betrag/-notiz und den korrekten Restbetrag, `MailLog`/`KundeAktivitaet` werden korrekt angelegt, `Lieferung.rechnungVersendetAm` bleibt unverändert (`null`); 6 neue Unit-Tests in `__tests__/lib/email-templates-zahlungsuebersicht.test.ts` (offener-Betrag-/vollständig-beglichen-Zweig, weitere Positionen, leere Teilzahlungsliste, HTML-Escaping der Notiz) |
| Nachzieher zur Zeile direkt darüber: Kundenwunsch, die "Zahlungsübersicht senden"-Funktion zusätzlich als dritte Option direkt im "Restbetrag klären"-Entscheidungsdialog anzubieten — dort stand man ohnehin schon vor der Frage "was passiert mit dem offenen Restbetrag" (bisher nur "Auf nächste Rechnung übernehmen" oder "Eigene Rechnung erstellen"), ein drittes "gar nichts verbuchen, nur informieren" fehlte als Option an genau dieser Stelle | Die beiden bestehenden `restdiffModus`-Werte (`"forderung"`/`"neue_rechnung"`) lösen den Restbetrag immer aktiv auf (Forderung anlegen bzw. neue Rechnung stellen) — für den Fall "Restbetrag bleibt einfach wie gehabt als offener Betrag auf dieser Rechnung stehen, der Kunde soll nur den aktuellen Stand per Mail sehen" gab es keine Option, die NICHTS an Gutschrift/Forderung/Rechnung verändert | `restdiffModus`-State um `"email"` erweitert; die dritte Radio-Option ("Nur den Kunden per E-Mail über den aktuellen Zahlungsstand informieren — der Restbetrag bleibt unverändert als offener Betrag auf dieser Rechnung stehen") erscheint nur, solange in der darüberliegenden "Gutschrift verrechnen"-Auswahl KEINE Gutschrift gewählt ist (die beiden anderen Optionen bleiben die einzig sinnvollen, sobald eine Gutschrift tatsächlich gegengebucht werden soll — Auswahl einer Gutschrift schaltet `restdiffModus` deshalb automatisch von `"email"` zurück auf `"forderung"`, falls zuvor gewählt). Der "Bestätigen"-Button (Label wechselt bei dieser Auswahl auf "Weiter zur E-Mail →") ruft bei `modus:"email"` NICHT mehr `POST /api/lieferungen/[id]/restdifferenz` auf, sondern schließt das Restbetrag-klären-Panel und öffnet direkt die bereits bestehende Zahlungsübersicht-`EmailVersandModal`-Instanz (keine neue Backend-Logik nötig, reine Frontend-Weiche) — nach Abbrechen/erneutem Öffnen ist wieder `"forderung"` vorausgewählt. End-to-end gegen die echte DB + Playwright verifiziert: dritte Option erscheint korrekt, Auswahl + "Weiter zur E-Mail →" schließt das Restdiff-Panel und öffnet das Zahlungsübersicht-Modal mit korrekt vorbefüllter Kontaktadresse, erneutes Öffnen von "Restbetrag klären" zeigt wieder den Standard-Modus |
| Kunde meldete: eine Rechnung eines bestimmten Kunden (per Foto/WhatsApp gezeigt) war "im System nicht auffindbar" — weder über die Rechnungsnummer noch über den Kundennamen fand sich ein Treffer, obwohl die PDF eindeutig von AGRI-Office selbst erzeugt worden war (gleiches Layout, GiroCode). Wirkte wie ein echter Datenverlust ("Sie ist weg!") | Zwei unabhängige Ursachen kamen zusammen: (1) Die gezeigte Rechnungsnummer ("RE-2026-300.", nur 3-stellig statt der sonst immer 4-stellig gepolsterten `RE-JJJJ-NNNN`-Autoformat, plus ein Punkt am Ende) stammte nicht aus der automatischen Vergabe (`naechsteRechnungsnummer()`/`vergebeRechnungsnummerFuerLieferung()` polstern IMMER auf 4 Stellen), sondern wurde offensichtlich manuell über "Rechnungsnummer bearbeiten" auf `/lieferungen/[id]` eingetragen — weder Frontend (`speichereRechnungNr()`) noch Backend (`PUT /api/lieferungen/[id]`) validieren dabei ein Format, nur "nicht leer" + Eindeutigkeit werden geprüft. Eine Suche nach der "erwarteten" Standardform mit führender Null (`RE-2026-0300`) findet das per `contains` gespeicherte `RE-2026-300.` dadurch nicht (keine Teilzeichenkette). (2) Der eigentlich gemeldete Fall: der zugehörige KUNDE war über "Löschen" entfernt worden — das ist aber nur ein Soft-Delete (`DELETE /api/kunden/[id]` setzt lediglich `aktiv:false`, alle Lieferungen/Rechnungen bleiben unangetastet in der DB). Sowohl die globale Suche (`GET /api/suche`, FTS5-Query UND Fallback-Zweig filtern explizit `aktiv:true`/`k.aktiv = 1`) als auch die Kundenliste (Standardfilter "Aktiv") blenden einen inaktiven Kunden komplett aus — dadurch wirkte er samt seiner kompletten Historie wie vollständig gelöscht, obwohl nichts verloren war. Verschärfend: anders als bei Artikel (dort gibt es eine "Aktiv"-Checkbox zum Reaktivieren auf der Detailseite) gab es für Kunden in der gesamten Oberfläche KEINEN Weg zurück — `PUT /api/kunden/[id]` unterstützte `{aktiv:true}` zwar bereits serverseitig, aber ohne jede Frontend-Anbindung war ein einmal gelöschter Kunde faktisch unwiderruflich unsichtbar | Sofortiger Workaround (kein Code-Fix nötig): auf `/kunden` den Filter-Button von "Aktiv" auf "Alle" umstellen — der Kunde erscheint dort weiterhin mit grauem "Inaktiv"-Badge, seine komplette Lieferhistorie inkl. der Rechnung ist unverändert einsehbar. Als eigentlicher Fix: neuer "↺ Reaktivieren"-Button direkt neben dem "Inaktiv"-Badge im Kopfbereich von `/kunden/[id]` (`handleReaktivieren()` ruft `PUT /api/kunden/[id]` mit `{aktiv:true}`, danach `fetchKunde()` neu geladen) — schließt die zuvor komplett fehlende Reaktivierungs-Lücke, keine Backend-Änderung nötig, da die API das bereits unterstützte. Die falsch formatierte Rechnungsnummer selbst wurde bewusst NICHT automatisch korrigiert (der Nutzer muss entscheiden, ob/wie er die bereits kommunizierte Nummer ändert) — nur als Ursache für die "Suche nach Standardformat findet nichts"-Verwirrung dokumentiert; eine Formatvalidierung für die manuelle Rechnungsnummer-Eingabe war zum Zeitpunkt dieser Zeile noch nicht angefragt/gebaut. End-to-end gegen die echte DB + Playwright verifiziert: ein inaktiver Testkunde ist unter "Aktiv" weder in der Liste noch über `GET /api/suche` auffindbar, unter "Alle" mit Inaktiv-Badge sichtbar; Klick auf "↺ Reaktivieren" auf der Detailseite entfernt Badge und Button sofort und macht den Kunden unmittelbar wieder über die globale Suche auffindbar |
| Zweiter, unabhängiger Kunde (anderer Betrieb) mit demselben Symptom wie in der Zeile direkt darüber gemeldet: Rechnung "RE-2026-329." (wieder 3-stellig ohne führende Null, wieder mit Punkt am Ende — also erneut manuell statt automatisch vergeben) erscheint zwar korrekt in der Lieferhistorie des Kunden, taucht aber in `/rechnungen` (Rechnungsübersicht) NICHT auf — diesmal war der Kunde weiterhin aktiv, der Soft-Delete-Fix aus der Zeile darüber war also nicht die Ursache | `app/rechnungen/page.tsx` lädt `GET /api/lieferungen?hatRechnung=true&limit=500` — `GET /api/lieferungen` deckelte den `limit`-Parameter serverseitig hart auf `Math.min(500, …)`, unabhängig vom angefragten Wert. Ohne `sort=datum`-Parameter (den `/rechnungen` nicht setzt) wird nach `createdAt desc` sortiert, nicht nach Rechnungs-/Lieferdatum — bei inzwischen deutlich über 500 im Jahr 2026 gestellten Rechnungen (höchste beobachtete Nummer RE-2026-0822) fällt eine früh im Jahr erzeugte Rechnung (RE-2026-0329, erstellt 27.4.2026) aus den 500 zuletzt ANGELEGTEN Datensätzen heraus, sobald seitdem 500+ neuere Lieferungen/Rechnungen angelegt wurden — exakt derselbe "500er-Deckel"-Bug-Typ wie schon mehrfach dokumentiert (Kunden-/Artikel-Picker, Bankabgleich-Kandidaten) und im Code-Kommentar der Seite selbst bereits als Risiko benannt ("Sollte die Zahl der Rechnungen 500 übersteigen…"), aber nie behoben. Die Kunden-Detailseite ist von diesem Deckel nicht betroffen, da sie nur die Lieferungen GENAU dieses einen Kunden lädt (weit unter 500) | `GET /api/lieferungen`-Obergrenze in `app/api/lieferungen/route.ts` von `Math.min(500, …)` auf `Math.min(5000, …)` angehoben (gleiches Muster/gleiche Obergrenze wie bei `GET /api/kunden`); `app/rechnungen/page.tsx` und `app/rechnungsuebersicht/neu/page.tsx` fragen jetzt `limit=5000` statt `limit=500` an. Als Nebeneffekt profitieren auch `app/offene-posten/page.tsx` und `app/streckengeschaeft/page.tsx` (fragten bereits `limit=1000` an, wurden aber vom alten 500er-Server-Deckel unbemerkt auf 500 zurückgestutzt) — dort keine Code-Änderung nötig. End-to-end gegen die echte DB verifiziert: 505 künstliche "Füll"-Rechnungen (createdAt = jetzt) + 1 künstlich 30 Tage älter angelegte Ziel-Rechnung angelegt — mit `limit=500` (altes Verhalten) fehlt die Ziel-Rechnung in der Antwort, mit `limit=5000` (Fix) erscheint sie korrekt |
| Für eine noch nicht gelieferte Lieferung (status "geplant", z.B. ein Streckengeschäft-Auftrag) gab es keine Möglichkeit, dem Kunden vorab eine Auftragsbestätigung zukommen zu lassen — nur der Lieferschein (keine Preise, Unterschriftsfeld, impliziert bereits erfolgte/unmittelbar bevorstehende Lieferung) und die Rechnung (setzt bereits erfolgte Lieferung voraus) waren als Dokument/E-Mail verfügbar | Kein PDF-Generator, keine E-Mail-Route und keine Bildschirm-Vorschau für dieses Dokument vorhanden — anders als bei Vorbestellungen (`/vorbestellungen/[id]/auftragsbestaetigung`, dort aber bewusst nur Druck/Teilen/Nextcloud-Upload ohne echten E-Mail-Versand) gibt es für eine normale Lieferung/Auftrag kein Analogon | Neue eigenständige Dokumentenart "Auftragsbestätigung" nach dem Muster von Lieferschein/Angebot: `generiereAuftragsbestaetigungPdf()` (`lib/pdfGenerator.ts`, PDF-Aufbau wie `generiereAngebotPdf()` — MIT Preisen/MwSt-Gruppierung/Auftragssumme, OHNE Signaturfeld/Chargen/Nährstoffdeklaration; nutzt `Lieferposition.mwstSatz`/`verkaufspreis`/`rabattProzent`, `Lieferung.lieferscheinNr` als Auftragsnummer); `auftragsbestaetigungEmail()` (`lib/email-templates.ts`); neue Routen `GET /api/exporte/auftragsbestaetigung?lieferungId=` und `POST /api/exporte/auftragsbestaetigung/mail` (beide `P.EXPORT_LIEFERSCHEIN`-gated, analog zu den bestehenden Lieferschein-Routen); neue Bildschirmseite `/lieferungen/[id]/auftragsbestaetigung` (Drucken/PDF-Download/Teilen/E-Mail via `EmailVersandModal` `docType="sonstige"`) — verlinkt über einen neuen Button auf `/lieferungen/[id]`, der NUR bei `status === "geplant"` erscheint (verschwindet automatisch, sobald die Lieferung als geliefert markiert wird — ab dann ist der Lieferschein das richtige Dokument). Neues Feld `Lieferung.auftragsbestaetigungVersendetAm DateTime?` (Migration `20260911080000_lieferung_auftragsbestaetigung_versendet`) analog `lieferscheinVersendetAm` für die "bereits versendet"-Anzeige; `"auftragsbestaetigung"` als neues `feature` zu `ANHANG_FEATURES`/`baueAnhang()` in `/api/einstellungen/mail-log/[id]/resend` ergänzt, damit "Erneut senden" auch hier den PDF-Anhang frisch erzeugt. End-to-end gegen die echte DB + Playwright + lokalem Test-SMTP-Server verifiziert: PDF-Download liefert korrekte Positions-/MwSt-/Summenberechnung (2 Positionen, 7%/19% MwSt, 10% Rabatt auf einer Position — Netto/MwSt-Aufschlüsselung/Auftragssumme bis auf den Cent korrekt), E-Mail kommt mit PDF-Anhang an, `auftragsbestaetigungVersendetAm` wird gesetzt, Button erscheint bei `status:"geplant"` und verschwindet nach "Als geliefert markieren" (Lieferschein-Button bleibt unverändert sichtbar) |
| Dritter, unabhängiger "Rechnung nicht auffindbar"-Fall (Foto einer echten gedruckten Rechnung "RE-2026-0167." für Kunde Hartwig Lagemann): diesmal war die Rechnungsnummer korrekt 4-stellig gepolstert (kein manueller Formatfehler wie bei den zwei Zeilen weiter oben) UND die Rechnung fehlte sogar in der Lieferhistorie GENAU DIESES Kunden — ein Bereich, den weder der Soft-Delete-Fix (betrifft nur Suche/Liste, nicht die eigene Kundendetailseite) noch der `/rechnungen`-500er-Fix (betrifft nur die globale, kundenübergreifende Liste) berühren konnten | Genau die Annahme aus der Zeile zwei weiter oben — "Die Kunden-Detailseite ist von diesem Deckel nicht betroffen, da sie nur die Lieferungen GENAU dieses einen Kunden lädt (weit unter 500)" — erwies sich als falsch: `GET /api/kunden/[id]/route.ts` lädt die Lieferungen des Kunden über `include: { lieferungen: { orderBy: { datum: "desc" }, take: 500 } } }` — ein eigener, von dem bereits gefixten `/api/lieferungen`-Deckel komplett unabhängiger, nie angefasster `take: 500`, direkt in der nested Relation. Bei einem Vielkunden mit mehr als 500 `Lieferung`-Datensätzen (z.B. durch häufige wiederkehrende Lieferungen über mehrere Jahre) fällt eine ältere Rechnung wie RE-2026-0167 (Januar 2026, bei inzwischen September 2026 und entsprechend vielen neueren Lieferungen dieses Kunden) aus dem 500-neuesten-Datensätze-Fenster heraus, BEVOR sie überhaupt beim `LieferhistorieTab` (der rein clientseitig auf dem bereits gekürzten `kunde.lieferungen`-Array filtert, selbst keine eigene Kürzung vornimmt) ankommt — exakt derselbe "500er-Deckel"-Bug-Typ wie in den beiden Zeilen weiter oben, nur an einer dritten, bis dahin für sicher gehaltenen Stelle | `take: 500` in `app/api/kunden/[id]/route.ts` auf `take: 5000` angehoben (gleiches Muster/gleiche Obergrenze wie bei `GET /api/kunden`/`GET /api/lieferungen`). End-to-end gegen die echte DB verifiziert: Testkunde mit 505 "Füll"-Lieferungen + 1 künstlich auf 2020 zurückdatierte Ziel-Lieferung (RE-2026-0167) angelegt — mit `take:500` (altes Verhalten) fehlt die Ziel-Lieferung in der API-Antwort (500 von 506 Lieferungen), mit `take:5000` (Fix) erscheinen alle 506 inkl. der Ziel-Lieferung korrekt. Die zuvor vermutete Theorie "Punkt am Ende der Rechnungsnummer bricht die Suche" wurde geprüft und verworfen: `GET /api/suche` nutzt Prisma `contains` (`rechnungNr: { contains: q }`) — ein gesuchtes `"RE-2026-0167"` ohne Punkt würde ein gespeichertes `"RE-2026-0167."` MIT Punkt trotzdem finden (Substring-Prüfung in die richtige Richtung); der Punkt im Foto stammt erkennbar aus dem Satzzeichen des PDF-Fließtexts ("…unter Angabe der Rechnungsnummer ${rechnungNr}.", `lib/pdfGenerator.ts`), nicht aus dem gespeicherten Wert selbst. Als zusätzliche, nicht ausgeschlossene Möglichkeit (falls der Kunde weiterhin nicht auffindbar sein sollte): ein doppelter `Kunde`-Datensatz für denselben Namen, dessen `Lieferung.kundeId` auf den jeweils anderen Datensatz zeigt — prüfbar über `/kunden` mit Filter "Alle" (findet auch inaktive Duplikate) und ggf. zu bereinigen über `/kunden/verschmelzen` |
| Mahnwesen: Kunde meldete, das Briefdatum einer bereits vor Wochen erstellten "Freundlichen Zahlungserinnerung" (Stufe 1, Rechnung RE-2026-0227) habe sich beim erneuten Öffnen der archivierten PDF plötzlich auf das aktuelle Tagesdatum geändert ("Ich bin mir sehr sicher, dass ich das viel früher gemacht habe") — wirkte wie ein nachträglich überschriebenes Feld | Zwei zusammenwirkende Ursachen: (1) Das Briefdatum wird bei JEDER Erzeugung frisch als `new Date()` berechnet (`generiereMahnungPdf()` in `lib/pdfGenerator.ts` UND unabhängig davon die Browser-Druckansicht `druckeZahlungserinnerung()` in `app/mahnwesen/page.tsx`) — anders als bei Rechnung/Lieferschein/Auftragsbestätigung gibt es für eine Mahnung kein persistiertes `*VersendetAm`-Feld, das den ursprünglichen Erstellungszeitpunkt einfriert; das ist für die reine Live-Vorschau auch richtig so (eine heute gedruckte Mahnung soll das heutige Datum tragen). (2) Der eigentliche Bug: `GET /api/exporte/mahnung` spiegelt die frisch erzeugte PDF fire-and-forget nach Nextcloud in den Kunden-Ordner "Mahnungen" — unter dem Dateinamen `Mahnung_${rechnungNr}.pdf`, OHNE Mahnstufe oder Datum. Jede erneute Erzeugung (egal ob Stufe 1/2/3, egal ob nur zur Kontrolle angeklickt) überschreibt dadurch die zuvor archivierte Datei am selben Pfad mit dem neuen Tagesdatum — die ursprünglich archivierte Momentaufnahme (inkl. ihres damaligen Briefdatums) ist damit unwiderruflich verloren, sobald die PDF ein zweites Mal (an einem späteren Tag) heruntergeladen wird | Dateiname in `app/api/exporte/mahnung/route.ts` um Mahnstufe + Erzeugungsdatum erweitert: `Mahnung_${rechnungNr}_Stufe${mahnstufe}_${JJJJ-MM-TT}.pdf` (Muster wie bei `rechnung`/`lieferschein`/`auftragsbestaetigung`, die den Tagesstempel bereits im Download-Dateinamen führen). Dadurch kollidieren weder verschiedene Mahnstufen noch eine erneute Erzeugung an einem SPÄTEREN Tag mehr mit der bereits archivierten Datei — eine am selben Tag mehrfach erzeugte PDF überschreibt sich selbst weiterhin (unproblematisch, identischer Inhalt). Die vorher vermutete "Punkt-in-Rechnungsnummer"-Ursache wurde geprüft und ausgeschlossen (Rechnungsnummer war hier korrekt formatiert, kein manueller Eintrag). Als verlässlicher, von diesem Bug unberührter Nachweis des tatsächlichen Sendezeitpunkts: `POST /api/exporte/mahnung/mail` (E-Mail-Versand, verschickt bewusst KEINEN PDF-Anhang, betrifft diesen Bug also gar nicht) legt bei jedem tatsächlichen Versand einen unveränderlichen `KundeAktivitaet`-Eintrag mit echtem Zeitstempel an ("Zahlungserinnerung: Rechnung …"), einsehbar im CRM-Tab des Kunden. End-to-end gegen die echte DB verifiziert: `GET /api/exporte/mahnung?mahnstufe=1` und `?mahnstufe=2` derselben Lieferung liefern jetzt unterscheidbare `Content-Disposition`-Dateinamen (`..._Stufe1_2026-09-11.pdf` vs. `..._Stufe2_2026-09-11.pdf`) statt des vorher identischen `Mahnung_RE-….pdf` |
| Nachzieher zur Zeile direkt darüber: Kundenwunsch, ob/wann eine Mahnung tatsächlich versendet wurde, direkt in `/mahnwesen` erkennen zu können — bisher musste man umständlich im CRM-Tab des Kunden nach einem passenden Aktivitäts-Eintrag suchen, ohne vorher zu wissen, ob überhaupt einer existiert | `GET /api/mahnwesen` lieferte gar keinen Hinweis auf einen früheren Versand; der einzige verlässliche Nachweis (`KundeAktivitaet`-Eintrag aus `POST /api/exporte/mahnung/mail`, siehe Zeile direkt darüber) war nur über einen Seitenwechsel zum Kunden erreichbar | `GET /api/mahnwesen` lädt jetzt zusätzlich in einem einzigen Bulk-`findMany` (kein N+1) alle `KundeAktivitaet`-Einträge (`typ:"email"`, `betreff` endet auf `"Rechnung <rechnungNr>"`) der betroffenen Kunden und liefert je Eintrag `letzteVersendung:{am,stufe}|null` (neuester Treffer je Kunde+Rechnungsnummer). `/mahnwesen` zeigt das als grüne "✉ zuletzt versendet TT.MM.JJJJ"-Zeile unter dem Kundennamen (Tooltip nennt zusätzlich die Mahnstufe), bzw. grau "✉ noch nicht versendet" wenn kein Treffer — bewusst NUR der tatsächliche E-Mail-Versand zählt, Drucken/PDF hinterlassen weiterhin keine Spur (deren Briefdatum zeigt ja gerade deshalb immer "heute", siehe Zeile direkt darüber). End-to-end gegen die echte DB + Playwright verifiziert: eine Rechnung mit passendem `KundeAktivitaet`-Eintrag ("Zahlungserinnerung: Rechnung RE-2026-9001", Datum 10.7.2026) zeigt korrekt "✉ zuletzt versendet 10.7.2026", eine zweite Rechnung ohne Eintrag zeigt "✉ noch nicht versendet" |

## Schemata: Wichtige Felder

- `Artikel.mwstSatz Float @default(19)` — 0 | 7 | 19
- `Artikel.aktuellerBestand Float` + `Artikel.mindestbestand Float`
- `ArtikelInhaltsstoff.name String` + `menge Float?` + `einheit String?` — 1:N pro Artikel
- `AntragEmpfaenger.steuerNr String?`
- `Lieferung.rechnungNr String?` + `rechnungDatum DateTime?`
- `Lieferposition.chargeNr String?` — bis 2026 immer Kannfeld; ab 2027-01-01 Pflichtfeld bei Artikel-Kategorie "Futter" (Rückverfolgbarkeit Tierfutter). Enforcement: `istChargeNrPflichtFuerLieferschein()` in `lib/lieferung.ts`, geprüft beim Statuswechsel geplant→geliefert in `app/api/lieferungen/[id]/route.ts` (PUT + PATCH/QR). Unabhängig vom allgemeinen, konfigurierbaren `Artikel.chargePflicht`-Hinweisflag (das zusätzlich Saatgut abdeckt, aber nie blockiert).
- `Lieferung.rechnungVersendetAm DateTime?` / `Lieferung.lieferscheinVersendetAm DateTime?` — Zeitpunkt, seit dem die Rechnung das Haus verlassen hat (E-Mail-Versand ODER manuell `aktion: rechnung_postversand_markieren` für Post); löst denselben Positions-Sperr-Mechanismus aus. `lieferscheinVersendetAm` bleibt weiterhin rein E-Mail (kein Post-Pendant). Filter dafür in `/api/lieferungen` (`rechnungOffen`/`lieferscheinOffen`)
- `Lieferung.auftragsbestaetigungVersendetAm DateTime?` — analog `lieferscheinVersendetAm`, aber für die Auftragsbestätigung (`/lieferungen/[id]/auftragsbestaetigung`); nur relevant solange `status === "geplant"`, löst KEINEN Positions-Sperr-Mechanismus aus (anders als `rechnungVersendetAm`)
- `Lieferung.rechnungVersandKanal String?` — `"email"` \| `"post"`, rein informativ für die Anzeige ("Per E-Mail versendet" vs. "Per Post versendet" auf `/lieferungen/[id]/rechnung`); alte Datensätze vor Einführung des Postversands bleiben `null` und zeigen weiterhin "Per E-Mail versendet"
- `Lieferung.manuelleMahnstufe Int?` — manueller Override der automatisch berechneten Mahnstufe (1|2|3), null = automatisch anhand Tage überfällig; setzbar über `PUT /api/lieferungen/[id]` (`{manuelleMahnstufe: 1|2|3|null}`), whitelist-validiert; `/api/mahnwesen` liefert damit `mahnstufe` (effektiv), `automatischeMahnstufe` und `mahnstufeManuell` je Eintrag
- `Lieferposition.lagerBereitsGebucht Boolean @default(false)` — true = Lagerausgang für diese Position wurde bereits gebucht. Entkoppelt den Lagerbuchungsstatus vom `Lieferung.status`, damit eine Lieferung nach dem Liefern wieder auf "geplant" gesetzt werden kann (z.B. der Rest nach einer Teilrechnung), ohne bei einer erneuten "geliefert"-Markierung den Lagerausgang doppelt zu buchen. Gesetzt/geprüft in `markiereLieferungGeliefertFallsGeplant()` (`lib/lieferung.ts`) und im Statuswechsel-Handling in `app/api/lieferungen/[id]/route.ts` (PUT geplant→geliefert setzt es, geliefert→storniert prüft es vor der Rückbuchung und setzt es zurück auf `false`).
- `Lieferposition.mwstSatz Float @default(19)` — bei Positionserstellung eingefrorener MwSt-Satz (analog `verkaufspreis`), NICHT live aus `Artikel.mwstSatz` nachgeladen. Gesetzt in `erstelleLieferungMitPreisberechnung()`/`injiziereAlteForderungen()`/`injiziereOffeneGutschriften()` (`lib/lieferung.ts`) sowie `POST /api/lieferungen/[id]/positionen`. Alle Rechnungs-/Lieferschein-/Sammelrechnungs-/ZUGFeRD-/DATEV-/UStVA-Berechnungen nutzen `p.mwstSatz ?? p.artikel.mwstSatz ?? 19` (Fallback nur für Altbestand vor der Migration, per Backfill bereits übertragen). `berechneLieferungBrutto()` (`lib/lieferung-brutto.ts`) ist die zentrale Stelle für diesen Fallback. Betrifft NUR Lieferposition — AngebotPosition/GutschriftPosition haben (noch) kein eigenes Snapshot-Feld, lesen weiterhin live von `Artikel.mwstSatz`.
- `Artikel.notiz String?` — freie Notiz/Hinweis; wird beim Hinzufügen zu einer Lieferung in `Lieferposition.notiz` durchgeschleift und auf Lieferschein/Rechnung gedruckt (Abpackungshinweise bei gleichem kg-Preis)
- `Mengenrabatt.preis Float?` — absoluter Verkaufspreis ab `vonMenge`, primäre Eingabeart (`/mengenrabatte/neu`). `rabattProzent Float @default(0)` bleibt als Legacy-Fallback für vor der Umstellung (Migration `20260828160000_mengenrabatt_absoluter_preis`) angelegte prozentbasierte Staffeln — `wendeMengenstaffelAn()`/`effektiverMengenstaffelRabatt()` (`lib/utils.ts`) nutzen `rabattProzent` nur, wenn `preis` null ist.
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

## Fehler-Reporting (Sentry/GlitchTip, `lib/logger.ts`)

**Regel: Jeder abgefangene Fehler wird an GlitchTip gemeldet — ohne Filter, ohne Ausnahme.**
Umgesetzt projektweit (App Router, `lib/*.ts`, Client-Komponenten, Promise-Ketten) — siehe
Checkliste unten für den genauen Umsetzungsstandard bei neuem Code.

### Fest hinterlegter DSN — funktioniert ohne Konfiguration

`lib/sentry-dsn.ts` ist die **einzige Quelle der Wahrheit** für die DSN. Sie ist bewusst fest im
Code hinterlegt (`DEFAULT_SENTRY_DSN`), damit **jeder** Container dieses Images ohne gesetztes
Secret an GlitchTip meldet. Ein DSN ist kein Geheimnis: er liegt bei jeder Web-App offen im
Browser-Bundle und erlaubt ausschließlich das Einsenden, nicht das Lesen von Events.

| Ziel | Vorgehen |
|------|----------|
| Standard nutzen | nichts tun |
| Eigenes GlitchTip-Projekt | `SENTRY_DSN=<eigene-dsn>` (Browser zusätzlich: Build-ARG `NEXT_PUBLIC_SENTRY_DSN`) |
| Reporting abschalten | `SENTRY_DSN=off` (auch `none`/`false`/`0`/`disabled`/`aus`) |

`SENTRY_DSN=off` wirkt zur Laufzeit für Issues und Logs. **Eine Ausnahme:** der
CSP-`report-uri`-Header wird von Next beim Build in `routes-manifest.json` geschrieben — um auch
CSP-Verstoßmeldungen abzuschalten, muss das Image mit `SENTRY_DSN=off` neu gebaut werden.

Diese Begründung bitte **nicht zurückdrehen**: die Kommentare in `docker-entrypoint.sh` und
`.github/scripts/report-to-sentry.sh` haben früher genau davor gewarnt — der Zweck ist jetzt
ausdrücklich, dass jedes Deployment meldet, mit `off` als Opt-out.

Der DSN-Literal existiert zwangsläufig **vierfach**, weil Shell, Service Worker und der
PID-1-Reporter das TS-Modul nicht importieren können: `lib/sentry-dsn.ts` (Quelle),
`docker-entrypoint.sh`, `.github/scripts/report-to-sentry.sh`, `scripts/sentry-store-report.cjs`
und `public/sw.js`. **`__tests__/lib/sentry-dsn.test.ts` hält alle Kopien synchron** — beim Ändern
des DSN also alle Stellen anpassen, der Test schlägt sonst fehl.

### `lib/logger.ts` ist der Einstieg für neuen Code

```ts
import { log } from "@/lib/logger";

log.info("Import gestartet", { datei: name });
log.warn("Eurostat: product-Dimension fehlt", { dataset });
const eventId = log.error("Speichern fehlgeschlagen", err, { kundeId });
```

- `log.error`/`log.fatal` schreiben ins Log **und** erzeugen das GlitchTip-Issue. **Nicht
  zusätzlich `Sentry.captureException(err)` aufrufen** — das wäre Doppel-Reporting.
- `log.debug`/`info`/`warn` landen nur im Log-Strom (kein Issue). `debug` wird in Produktion
  nicht ausgegeben.
- Für Sonderfälle (Issue unterdrücken, eigener Fingerprint) gibt es `logEreignis({ … issue: false })`.
- **`Sentry.logger.*` NICHT verwenden.** Der Log-Strom läuft ausschließlich über `console.*` +
  `consoleLoggingIntegration`; ein direkter `Sentry.logger`-Aufruf käme doppelt an.
- **Reihenfolge der `console`-Argumente nicht umstellen** (Message zuerst, Kontext-Objekt als
  zweites Argument): so bleibt `docker logs` lesbar und der Kontext in GlitchTip durchsuchbar.

### `console.*` landet automatisch in GlitchTip

`enableLogs: true` + `Sentry.consoleLoggingIntegration({ levels: ["info","warn","error"] })` sind in
**allen drei** Configs aktiv (`sentry.server.config.ts`, `instrumentation-client.ts`,
`sentry.edge.config.ts`). Damit erreichen **alle** vorhandenen `console.*`-Aufrufe den
GlitchTip-**Log**-Strom, ohne dass sie angefasst werden müssen — als Logs, nicht als Issues. Die
Altbestands-Aufrufe müssen daher nicht migriert werden; neuer Code nutzt trotzdem `log.*`.
GlitchTip 6.1.8 unterstützt Logs (`enabledFeatures: ["logs","uptime","mcp"]`, gegen die Instanz mit
einem `type: "log"`-Envelope verifiziert → HTTP 200).

**`console.log`/`console.debug` sind NICHT in der Level-Liste** und erreichen GlitchTip nicht. Wer
ein Ereignis dauerhaft sichtbar braucht (z.B. „Backup wurde erstellt" — der einzige positive
Nachweis, dass der Scheduler läuft), nutzt `log.info`, nicht `console.log`.

**Ausnahme `middleware.ts`:** dort bewusst rohes `console.warn` statt `log.*`. Ein Import von
`lib/logger.ts` zieht in der Edge-Runtime den Sentry-Edge-Build samt `process.features` in den
Bundle-Graph, was `npm run build` mit „A Node.js API is used which is not supported in the Edge
Runtime" quittiert. Die Console-Integration der Edge-Config nimmt den Aufruf ohnehin auf.

**Ein Fehler erscheint damit i.d.R. zweimal: als Issue (Alarm) und als Log (Zeitachse). Das ist
beabsichtigt und kein Verstoß gegen die Doppel-Reporting-Regel** — die verbietet zwei *Issues*
für denselben Fehler.

### Fetch-Fehler im Browser: kein Wrapper nötig

`lib/fetch-reporter.ts` umhüllt `window.fetch` einmalig (installiert aus
`instrumentation-client.ts` nach `Sentry.init()`). Jede Non-OK-Antwort und jeder Netzwerkfehler auf
`/api/*` wird automatisch gemeldet — **Aufrufstellen brauchen dafür nichts zu tun.** Bewusst nur
Log-Strom, kein Issue: den eigentlichen Fehler hat der Server schon mit echtem Stacktrace als Issue
gemeldet. Erwartete Fälle (401 auf `/api/auth/*`, 404 auf Suche/Telefonmaske), Fremd-Hosts
(Nominatim/OSRM) und Next-Interna sind ausgenommen.
Ein `if (!res.ok)`-Zweig braucht deshalb **keine** eigene Sentry-Meldung mehr — wohl aber eine
**Rückmeldung an den Nutzer** (Toast/`setError`), sonst sieht ein HTTP 500 wie „keine Daten" aus.

Zwei Eigenschaften des Reporters, die nicht „wegoptimiert" werden dürfen:
- **Dedup-Fenster (60 s)** pro Pfad+Methode+Status. Die App pollt an drei Stellen im Minutentakt
  (Dashboard, `NotificationCenter` auf *jeder* Seite, Fahrer-Standorte); ohne Deckel erzeugte ein
  einzelner offener Tab bei DB-Ausfall unbegrenzt viele Einträge.
- **401 ist generell ausgenommen**, nicht nur auf `/api/auth/*`: `middleware.ts` liefert 401 für
  *jeden* `/api/*`-Pfad, sobald die Session abgelaufen ist. Ein über Nacht offener Tab würde sonst
  dauerhaft melden.
- Der Antwortkörper wird nur bei 5xx **und** vorhandenem `content-length ≤ 8 KB` gelesen. Fehlt der
  Header (chunked/gestreamt — der Normalfall bei Next-500-HTML-Seiten), wird bewusst NICHT gelesen;
  `Number(null ?? "0")` ergäbe 0 und würde den Deckel unterlaufen. Das Lesen läuft außerdem
  **ohne `await`** vor dem `return res`, damit die Aufrufstelle nicht auf die Diagnose wartet.

- `onRequestError` (`instrumentation.ts`) erfasst nur *unbehandelte* Exceptions. Sobald eine
  Route/Funktion einen eigenen `try/catch` hat (Standardfall laut Checkliste), muss der
  `catch`-Block selbst melden — sonst verschwindet der Fehler spurlos in `console.error`.
- **Jeder neue `try/catch`-Block** (API-Route, `lib/*.ts`, Hintergrund-Job, Client-Komponente)
  meldet im `catch`: `log.error("…", err, ctx)` (neu, bevorzugt) oder `Sentry.captureException(err)`
  (Bestand, weiterhin gültig) — aber nie beides zusammen.
- **Jede neue Promise-`.catch(...)`-Kette** mit Inline-Callback meldet den Fehler genauso. Bei
  Concise-Body-Arrows (`.catch(() => fallback)`) den Rückgabewert per explizitem `return`
  erhalten, damit sich das Resolve-Verhalten der Kette nicht ändert:
  `.catch((err) => { Sentry.captureException(err); return fallback; })`.
- **Import je nach Bundle-Ziel:**
  - Server-only (API-Routes, `lib/*.ts`-Module die garantiert nie von einer `"use client"`-Datei
    importiert werden — auch nicht transitiv über ein anderes `lib/*.ts`): `import { Sentry } from "@/lib/sentry";`
  - Alles, was direkt oder transitiv von einer `"use client"`-Komponente importiert werden kann
    (Client-Pages, `components/**`, sowie jedes `lib/*.ts`-Modul, das — egal über wie viele
    Zwischenschritte — von so einer Datei importiert wird): `import * as Sentry from "@sentry/nextjs";`
    direkt — **nicht** `@/lib/sentry`, da dieser Wrapper `next/headers` (über `lib/auth.ts`) und
    `next/server` nachzieht; sobald das im Browser-Bundle landet, bricht der Build hart mit
    "You're importing a module that depends on next/server/next/headers...".
    **Wichtig:** Ob ein Modul *bereits andere* server-only Importe hat (z.B. `prisma`), sagt NICHTS
    darüber aus, ob `@/lib/sentry` sicher ist — `prisma` allein lässt den Client-Build i.d.R. nicht
    hart fehlschlagen, `next/headers`/`next/server` (über `@/lib/sentry`) dagegen schon. Einzig
    entscheidend: wird die Datei von irgendeiner `"use client"`-Datei erreicht (direkt oder über
    beliebig viele `lib/*.ts`-Zwischenschritte, `import type` zählt nicht mit)? Im Zweifel mit
    `npm run build` verifizieren, nicht nur `tsc --noEmit` (der TypeScript-Checker prüft keine
    Client/Server-Bundle-Grenzen).
    Bekannte client-sichere `lib/*.ts`-Module mit diesem Muster: `lib/appinfo.ts`,
    `lib/auswahllisten.ts`, `lib/backup-config.ts`, `lib/fetch-reporter.ts`, `lib/girocode.ts`,
    `lib/logger.ts`, `lib/mahnwesen-config.ts`, `lib/matif.ts`, `lib/prisma.ts`,
    `lib/sentry-dsn.ts`, `lib/useScrollRestoration.ts`.
    Hinweis: `lib/sentry.ts` ist inzwischen nur noch ein Re-Export von `@sentry/nextjs` (der
    `withSentry`-Wrapper ist entfallen) und zieht `next/headers` nicht mehr nach. Die Regel bleibt
    trotzdem bestehen — sie schützt davor, dass ein künftiger server-only Import im Wrapper den
    Client-Build wieder bricht.
    `lib/sentry-dsn.ts` muss **importfrei** bleiben: es wird von Client-Bundle, Server, Edge und
    `next.config.ts` (außerhalb des Next-Bundles, per relativem Import `./lib/sentry-dsn`) genutzt.
- **Kein Filtern nach "wichtig genug" oder "zu erwarten".** Auch vermeintlich harmlose Fallbacks
  (z.B. Encoding-Fallback UTF-8→Latin1, KI-Retry, Cache-Miss) werden gemeldet. Mehr Rauschen in
  GlitchTip ist ausdrücklich erwünscht — lieber zu viele Events als einen unsichtbaren Fehler.
  Es werden keine Schweregrad-Filter, Sampling-Ausnahmen oder "non-critical, skip" Sonderfälle
  für neue Catches eingebaut.
- **Kein Doppel-Reporting:** Ruft ein `catch`-Block direkt danach einen gemeinsamen Fehler-Helfer
  auf, der den Fehler bereits selbst an Sentry meldet (z.B. `melde()` in
  `lib/nextcloud-backfill.ts`), wird am Call-Site **nicht** zusätzlich `captureException`
  aufgerufen — sonst landet derselbe Fehler doppelt in GlitchTip.
- Einzige zulässige Ausnahme: Kontrollfluss, der explizit **kein Fehler** ist — abgelehnte/
  abgelaufene Session- oder JWT-Verifikation, weil das normales Nutzerverhalten ist, kein
  Anwendungsfehler. Gilt für `middleware.ts` genauso wie für die inhaltlich identische Prüfung in
  `lib/auth.ts` (`verifySession()`) und `lib/portal-auth.ts` (`verifyPortalSession()`,
  `getPortalSession()`) — dort bewusst **kein** `Sentry.captureException` im `catch`.
- **Fehler-Toasts:** `useToast().error(message)` (`components/ToastProvider.tsx`) meldet jede
  Fehler-Toast zentral über `log.warn()` in `showToast()` — neue Aufrufstellen müssen dafür nichts
  zusätzlich tun. Bewusst **kein** `captureMessage` mehr: der Toast-Text ist ein generischer String
  ohne Stacktrace ("Fehler beim Speichern"), der in GlitchTip alle Aufrufstellen zu einem einzigen
  Issue kollabieren ließ. Das aussagekräftige Issue kommt jetzt vom Server bzw. von
  `lib/fetch-reporter.ts` (mit Pfad + Status).
- Bestehende Infrastruktur: `instrumentation-client.ts` (Browser-Init; ersetzt die ab SDK 9
  deprecated `sentry.client.config.ts`, die unter Turbopack gar nicht mehr griff),
  `sentry.server.config.ts` / `sentry.edge.config.ts` (Init + DSN), `app/error.tsx` +
  `app/global-error.tsx` (React-Error-Boundaries, melden bereits automatisch),
  `components/SentryUserContext.tsx` (Sentry-User-Kontext aus Session, **clientseitig**),
  `lib/process-error-handlers.ts` (`uncaughtException`/`unhandledRejection` + `flush`).
- **`uncaughtException` MUSS den Prozess beenden.** Node beendet sich dort standardmäßig mit Code 1,
  worauf Docker neu startet; registriert man einen Handler, entfällt das — der Server läuft dann in
  undefiniertem Zustand weiter. `lib/process-error-handlers.ts` und `geo-server.js` holen das
  Beenden daher explizit nach, aber erst **nach** dem `flush()`. Bei `unhandledRejection` bewusst
  nicht (definierter Zustand). Diesen `process.exit(1)` nicht entfernen.
- **Reporting darf nie zum Fehlerverstärker werden.** `logEreignis` fängt eigene Fehler ab (es wird
  fast nur aus `catch`-Blöcken gerufen — würde es werfen, ersetzte der Logger-Fehler den
  Originalfehler). In `geo-server.js` sind `ECONNRESET`/`EPIPE` von der Meldung ausgenommen, weil
  Client-Abbrüche Alltag sind, und `req`/`res`/`proxyRes` haben `error`-Handler: ohne die wurde ein
  Verbindungsabbruch über den `uncaughtException`-Handler zu einem FATAL-Issue.
- **Fingerprints bei variablen Meldungen.** `scripts/sentry-store-report.cjs` unterstützt
  `fingerprint`; `geo-server.js` setzt ihn überall, wo die Meldung einen variablen Anteil
  (Fehlercode, Exit-Code) enthält — sonst legt GlitchTip pro Variante ein eigenes Issue an.
- **Kein serverseitiger User-Kontext.** `Sentry.getIsolationScope().setUser()` wäre naheliegend, ist
  hier aber **falsch**: der Isolation-Scope wird pro Request nur von
  `wrapRouteHandlerWithSentry`/`wrapMiddlewareWithSentry` geforkt, und
  `webpack.autoInstrumentAppDirectory` ist `false`. Ohne Fork ist der Scope prozessweit — der Nutzer
  würde also requestübergreifend leaken und Events falsch zugeordnet. Nicht ohne
  `autoInstrumentAppDirectory: true` nachrüsten.
- **`middleware.ts` ist instrumentiert** (`webpack.autoInstrumentMiddleware: true` in
  `next.config.ts`). Vorher erreichte kein einziger Middleware-Crash GlitchTip — auch nicht der harte
  `throw` bei fehlendem `SESSION_SECRET`. Gewrappt werden nur Exceptions; abgelehnte Sessions bleiben
  wie unten dokumentiert stumm.
- **CSP-Verstöße** gehen per `report-uri` an GlitchTip (`next.config.ts`). Bewusst **ohne**
  `report-to`/`Reporting-Endpoints`: GlitchTips Security-Endpunkt akzeptiert nur das Legacy-Format
  `{"csp-report":{…}}`, und Chromium ignoriert `report-uri`, sobald `report-to` gesetzt ist — die
  Kombination hätte in Chrome/Edge gar keine Reports mehr geliefert. Nicht „modernisieren".
- **Prozesse ohne Bundle** melden über einen rohen POST an den Store-Endpunkt, weil dort kein
  Sentry-SDK verfügbar ist: `geo-server.js` (Produktions-Entrypoint/PID 1) via
  `scripts/sentry-store-report.cjs`, `public/sw.js` inline, `docker-entrypoint.sh` und
  `.github/scripts/report-to-sentry.sh` via `node -e`. Bewusst kein `require("@sentry/node")` in
  `geo-server.js`: das Runner-Image installiert nur `prisma`/`dotenv`/`geoip-lite`, alles andere
  hängt am `.next/standalone`-Trace und darf für PID 1 keine Voraussetzung sein.
- **DSN-Diagnose:** Ein „DSN fehlt"-Zustand existiert nicht mehr — ohne Konfiguration greift der
  Standard-DSN. Stumm ist das Reporting nur noch, wenn es per `SENTRY_DSN=off` bewusst abgeschaltet
  wurde; dann warnen die Configs beim Start per `console.warn` (sichtbar in `docker logs`).
  `/einstellungen/system` zeigt die **effektive** DSN (Host, Projekt-ID, Herkunft
  `default`/`env`/`off`, ohne den Key) und hat zwei Buttons ("Server-Test senden" / "Browser-Test
  senden", via `POST /api/einstellungen/sentry-test` bzw. direktem `Sentry.captureException()` im
  Client). Der Server-Test erzeugt **Issue UND Log** — kommt nur eins von beiden in GlitchTip an,
  weiß man sofort, welcher Kanal klemmt.
- **`release`** ist in allen Configs auf `NEXT_PUBLIC_APP_VERSION+NEXT_PUBLIC_BUILD_ID` gesetzt. Die
  Build-ID kommt aus `GITHUB_SHA` (Fallback `randomUUID()`), weil Next die Config mehrfach auswertet
  und ein reines `randomUUID()` Client und Server unterschiedliche Releases melden ließe.

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
| `lib/logger.ts` | **Zentraler Logger** — `log.debug/info/warn/error/fatal` + `logEreignis()`; schreibt `console.*` (→ GlitchTip-Log) und erzeugt bei `error`/`fatal` das Issue |
| `lib/sentry-dsn.ts` | Einzige Quelle der Wahrheit für die GlitchTip-DSN (`DEFAULT_SENTRY_DSN`, `resolveSentryDsn()`, `sentrySecurityReportUrl()`, `parseDsn()`) — bewusst importfrei |
| `lib/fetch-reporter.ts` | Umhüllt `window.fetch` einmalig; meldet fehlgeschlagene `/api/*`-Aufrufe automatisch in den Log-Strom |
| `scripts/sentry-store-report.cjs` | Abhängigkeitsfreier GlitchTip-Reporter für `geo-server.js` (PID 1, außerhalb des Next-Bundles) |
| `lib/audit.ts` | `auditLog()` + `auditChanges()` — schreibt in `AuditLog`-Tabelle |
| `lib/bankimport.ts` | Parser für CSV-Kontoauszüge (MT940-ähnlich, deutsche Formate) |
| `lib/bankabgleich-matching.ts` | Deterministischer Matcher (`runNormalMatch`, Bulk-Auto-Abgleich mit harter Betragstoleranz) + `rankCandidatesForBank` (Einzel-Vorschläge für manuelle Zuordnung, verwirft keine Betragsabweichung, rankt nur niedriger); `bestimmeBetragsabweichung()` berücksichtigt bei Kandidaten mit Skonto (`ReconCandidate.skontoAmount`) automatisch auch den Skonto-reduzierten Betrag (`skontoMatch`-Flag, nur bei plausibler Nähe ≤1€) |
| `lib/bankabgleich-kandidaten.ts` | Lädt offene Verkaufs-/Einkaufskandidaten (Lieferung/Sammelrechnung/Ausgabe/EingangsRechnung) für den Bankabgleich-Matcher, Beträge bereits brutto; liefert für Lieferung/Sammelrechnung mit hinterlegtem Skonto zusätzlich `skontoAmount` |
| `lib/bankabgleich-zuordnung.ts` | `markiereAlsBezahlt()`/`macheBezahltRueckgaengig()` — setzt/entfernt `bezahltAm` je Zieltyp; `markiereAlsBezahlt()` nimmt optionalen `client`-Parameter für Aufruf innerhalb einer `$transaction` |
| `lib/bankabgleich-differenz.ts` | Erfasst beim Bankabgleich eine Betragsdifferenz zwischen Kontoumsatz und zugeordneter Rechnung als Gutschrift (Überzahlung) oder KundeForderung (Fehlbetrag) — `erfasseBankabgleichDifferenz()`, aufgerufen aus `PUT /api/bankabgleich/[id]`; lehnt `art:"forderung"` ab, wenn die Abweichung dem hinterlegten Skonto entspricht (`istSkontoBetrag()`); `markiereSkontoGenutztFallsPassend()` setzt automatisch `skontoGenutzt`, wenn der zugeordnete Betrag dem Skonto-reduzierten Rechnungsbetrag entspricht |
| `lib/gutschrift.ts` | `erstelleDoppelzahlungsGutschrift()` — Bankabgleich-Doppelzahlung → Gutschrift (grund "Doppelzahlung", status OFFEN/ERSTATTET je nach modus), aufgerufen aus `POST /api/bankabgleich/[id]/doppelzahlung`; `loescheGutschriftMitNebenwirkungen()` — geteilte Lösch-Logik (VERBUCHT-Position entfernen, Rücknahme-Lagerbuchung rückgängig machen, verknüpften Kontoumsatz wieder als offen markieren), genutzt von `DELETE /api/gutschriften/[id]` UND vom Bankabgleich-Aufheben (`DELETE /api/bankabgleich/[id]`) |
| `lib/email.ts` | E-Mail-Versand via SMTP (nodemailer) oder Resend, `loadEmailConfig()` |
| `lib/email-templates.ts` | HTML-E-Mail-Templates (Rechnung, Mahnung, Angebot, Lieferantenbestellung) |
| `lib/bestellvorschlag-lieferant.ts` | `vorschlagLieferantFuerArtikel()` — rein datenbasierter Lieferantenvorschlag für einen Artikel (zuerst `ArtikelLieferant.bevorzugt`, sonst günstigster Einkaufspreis, sonst irgendein zugeordneter) — keine KI nötig, dieselbe Quelle wie `bevorzugterLieferant` in `/api/prognose`, nur mit Fallback statt `null` |
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
| `lib/jahrespreis.ts` | Preis-Jahresgültigkeiten (`ArtikelJahrespreis`/`ArtikelLieferantJahrespreis`/`KundeArtikelPreisJahr`): `loeseJahrespreisAuf()` interpoliert auf das nächstgelegene bekannte Jahr, `syncArtikelStandardpreis()`/`syncEinkaufspreis()`/`syncKundePreis()` halten den jeweiligen Basispreis-Skalar synchron |
| `lib/einkaufspreisverlauf.ts` | Datumsgenauer Einkaufspreis-Verlauf je Lieferant (`ArtikelLieferantPreis`): `setAktiverEinkaufspreis()` markiert genau einen Eintrag als aktiv und synct `ArtikelLieferant.einkaufspreis`; `hatAktivenEinkaufspreis()` lässt `syncEinkaufspreis()` (lib/jahrespreis.ts) einen bewusst gewählten Preisverlauf-Preis nicht überschreiben |
| `lib/artikel-kategorie.ts` | `loadKategorieTaxonomie()` — lädt die konfigurierten Top-Level-Kategorien + deren Unterkategorien aus `Einstellung` für `resolveKategorie()` (lib/auswahllisten.ts), genutzt von den Artikel-Import-Routen und `/api/artikel/kategorien-bereinigen` |
| `lib/ausgleichsartikel.ts` | Zentrale, dependency-freie Liste der "Ausgleichsartikel"-Artikelnummern (`ALTE_FORDERUNG_ARTIKELNUMMER`/`GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER`/`RESTDIFFERENZ_ARTIKELNUMMER`) + `istAusgleichsArtikelnummer()` — genutzt von `lib/lieferung.ts` (erzeugt die Positionen) UND `lib/datev.ts` (muss sie im Export erkennen, um sie auf ein Verrechnungs- statt Erlöskonto zu buchen) |

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
- CI: `.github/workflows/docker-build-reusable.yml` enthält die eigentlichen Jobs (Qualitäts-Gate +
  Docker Build & Push), aufgerufen von zwei schlanken Trigger-Workflows:
  - `.github/workflows/docker.yml` — Standardweg auf dem **Self-Hosted-Runner**; automatisch bei
    Push auf `main`/Versions-Tag `v*.*.*`, jederzeit zusätzlich manuell über `workflow_dispatch`
  - `.github/workflows/docker-cloud.yml` — Ausweichlösung auf einem **GitHub-gehosteten
    Cloud-Runner** (`ubuntu-latest`), ausschließlich manuell über `workflow_dispatch` (z.B. wenn der
    Self-Hosted-Runner nicht verfügbar ist und nach einem PR-Merge in `main` trotzdem sofort gebaut
    werden muss)
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
6. `npx prisma migrate dev --name beschreibung` für neue Migrationen — schlägt aber in einer FRISCH geklonten/neu aufgesetzten Umgebung (`dev.db` existiert noch nicht) mit `SQLite database error: no such column: T.artikel_id` fehl, weil `migrate dev` alle Migrationen erst in einer temporären Shadow-DB von Null an durchspielt und dabei eine alte handgeschriebene FTS5-Trigger-Migration (`20260329120000_add_fts5_search`) nicht sauber durchläuft (latenter, nie vorher aufgefallener Fehler, da bisher immer ein bereits migriertes `dev.db` vorlag). Workaround: Migration von Hand als `prisma/migrations/<timestamp>_beschreibung/migration.sql` anlegen (Format wie bestehende Migrationen, z.B. `ALTER TABLE … ADD COLUMN …`) und mit `npx prisma migrate deploy` anwenden — das umgeht die Shadow-DB komplett, da es Migrationen nur ausführt statt zu diffen
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
22. **Meldung in jedem neuen `catch`**: `log.error("…", err, ctx)` aus `@/lib/logger` als erste Anweisung, auch in `.catch(...)`-Ketten. `log.error` macht Log **und** Issue in einem Aufruf — **nicht zusätzlich** `Sentry.captureException(err)` (Doppel-Reporting). Bestehende `captureException`-Aufrufe bleiben gültig; Import dann `@/lib/sentry` nur wenn das Modul garantiert server-only bleibt, sonst `@sentry/nextjs` direkt (siehe Abschnitt "Fehler-Reporting")
23. **`console.*` statt Logger ist erlaubt, aber nicht bevorzugt**: `console.*` erreicht GlitchTip automatisch als Log (`consoleLoggingIntegration`). Neuer Code nutzt trotzdem `log.*`, weil dort Kontext + Issue-Erzeugung mitgeliefert werden.
24. **`if (!res.ok)` im Frontend braucht Nutzer-Feedback, kein Sentry**: die Meldung an GlitchTip übernimmt `lib/fetch-reporter.ts` automatisch. Was fehlen darf: ein Toast/`setError` — ohne das sieht ein HTTP 500 für den Nutzer wie „keine Daten" aus.
