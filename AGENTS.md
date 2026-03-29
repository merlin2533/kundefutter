# AgrarOffice Röthemeier — Projekt-Wissensbasis

## Framework & Laufzeitumgebung

**WICHTIG: Lies immer zuerst `node_modules/next/dist/docs/` bevor du Code schreibst.**
Diese Next.js-Version hat Breaking Changes gegenüber dem Trainingswissen.

- **Next.js 16** App Router mit Turbopack
- **Prisma 7** + SQLite via `@libsql/client`
- **Branch:** `claude/customer-inventory-management-4eHdv`
- **Deployment:** `http://194.164.59.48:8080`
- **RouteContext-Pattern:** `type Params = { params: Promise<{ id: string }> }` — immer `await ctx.params`

---

## Datenbankmodelle (Prisma)

```
Kunde               — Stammdaten, betriebsnummer, flaeche, geo-Koordinaten
KundeKontakt        — 1:N Ansprechpartner
KundeNotiz          — 1:N Notizen mit thema (Wichtig/Info/Offener Punkt…)
KundeAktivitaet     — CRM-Aktivitäten (typ, betreff, inhalt, datum)
Lieferant           — Lieferantenstamm
Artikel             — Lagerartikel mit Preis, Mindestbestand
ArtikelDokument     — Dateianlagen an Artikel
ArtikelLieferant    — Einkaufspreise je Lieferant
ArtikelPreisHistorie— Preishistorie
KundeArtikelPreis   — Sonderpreise je Kunde+Artikel
KundeBedarf         — Bedarfspläne
Lieferung           — Lieferscheine (status: OFFEN/GELIEFERT/ABGERECHNET)
Lieferposition      — Positionen einer Lieferung
Wareneingang        — Wareneingänge
WareineingangPosition
Lagerbewegung       — alle Lagerbuchungen
Mengenrabatt        — Staffelrabatte
Sammelrechnung      — Rechnungen mit zahlungsstatus
Einstellung         — Key/Value-Store (system.*, firma.*)
MarktpreisCache     — Eurostat-Preisindex (dataset, produktCode, zeitraum, land)
AgrarflaechenCache  — Flächendaten-Cache
AntragEmpfaenger    — AFIG-Daten (agrarzahlungen.de) aggregiert je Empfänger+Jahr
```

### Einstellung Key-Konventionen
| Key | Inhalt |
|-----|--------|
| `system.logo` | Base64 DataURL des Firmenlogos |
| `system.tournamen` | JSON-Array gespeicherter Tour-Namen |
| `system.firmenname` | Firmenbezeichnung |
| `firma.*` | Firmenstammdaten (adresse, plz, ort, tel, email…) |

---

## Seitenstruktur (App Router)

```
app/
├── page.tsx                    Dashboard
├── kunden/
│   ├── page.tsx                Kundenliste
│   ├── neu/page.tsx            Neuer Kunde (Formular-Seite)
│   └── [id]/page.tsx           Kundendetail
│       TABS: Stammdaten | Kontakte | Bedarfe | Sonderpreise |
│             Statistik | Lieferhistorie | CRM | Notizen | Agrarantrag
├── artikel/
│   ├── page.tsx
│   └── neu/page.tsx
├── lieferanten/
│   ├── page.tsx
│   └── neu/page.tsx
├── lieferungen/
│   ├── page.tsx                (inkl. Wiederkehrend-Tab)
│   └── neu/page.tsx
├── lager/
│   ├── page.tsx
│   └── wareneingang/page.tsx
├── mengenrabatte/
│   ├── page.tsx
│   └── neu/page.tsx
├── crm/page.tsx                CRM + Schnellerfassung, Suche, neueste zuerst
├── tourenplanung/page.tsx      OSRM-Routing, Tourname, Schnellerfassung
├── marktpreise/page.tsx        Produktbaum-Navigation + Eurostat-Charts
├── agrarantraege/page.tsx      AFIG-Import, Suche, Verknüpfung mit Kunden
├── gebietsanalyse/page.tsx
├── prognose/page.tsx
├── exporte/page.tsx
├── einstellungen/
│   ├── page.tsx                Kachelübersicht
│   ├── firma/page.tsx          Firmenstammdaten
│   ├── erscheinungsbild/page.tsx  Logo-Upload
│   ├── lager/page.tsx          Lager-Einstellungen
│   ├── adressen/page.tsx       Batch-Geocoding
│   ├── tournamen/page.tsx      Tour-Namen verwalten
│   └── system/page.tsx         Version, DB-Info
├── manifest.ts                 PWA Manifest
├── icon.tsx                    Favicon (dynamic, aus DB)
└── apple-icon.tsx              Apple-Icon (dynamic, aus DB)
```

**Regel: Keine Modals für Formulare** — jedes Erfassungsformular ist eine eigene Seite (`/neu/page.tsx`).

---

## API-Routen

```
/api/kunden                     GET(filter), POST
/api/kunden/[id]                GET, PUT, DELETE
/api/kunden/[id]/kontakte       GET, POST, DELETE
/api/kunden/[id]/notizen        GET, POST, DELETE?notizId=
/api/kunden/[id]/sonderpreise   GET, POST, DELETE
/api/kunden/aktivitaeten        GET, POST (CRM)
/api/kunden/adress-validierung  GET(stats), POST(batch)
/api/lieferanten                GET, POST
/api/lieferanten/[id]           GET, PUT, DELETE
/api/artikel                    GET, POST
/api/artikel/[id]               GET, PUT, DELETE
/api/lieferungen                GET, POST
/api/lieferungen/[id]           GET, PUT, DELETE
/api/lager/wareneingaenge       GET, POST
/api/lager/korrekturen          POST
/api/mengenrabatte              GET, POST, DELETE
/api/sammelrechnungen           GET, POST
/api/agrarantraege              GET(search), PATCH(link), DELETE
/api/agrarantraege/import       POST (multipart|{action:"url"}|{action:"serverpath"})
/api/agrarantraege/pdf          GET?kundeId=
/api/marktpreise                GET(?force=true)
/api/dashboard                  GET
/api/einstellungen              GET(?prefix=), PUT({key,value})
/api/exporte/tour               GET(?tourname=)
/api/suche                      GET(?q=) — Kunden/Artikel/Lieferungen, min 2 Zeichen
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
- Gruppen: Dashboard | Kunden (mit CRM, Gebietsanalyse, Agraranträge) | Lager | Lieferungen | Verwaltung | Analyse

### `components/Card.tsx`
`<Card>` und `<KpiCard label="" value="" color="" sub="" />`

### `components/ServiceWorkerRegistration.tsx`
Client-Komponente, registriert `/sw.js` für PWA-Offline-Support.

### `components/SearchPalette.tsx`
Globale Cmd+K / Ctrl+K Suche (Overlay). In `app/layout.tsx` eingebunden.
Sucht in Kunden, Artikel, Lieferungen via `GET /api/suche?q=...` (min. 2 Zeichen, max 5 Treffer je Typ).

### `components/Badge.tsx`
`<StatusBadge status="OFFEN|GELIEFERT|ABGERECHNET" />` und `<MargeBadge />`

---

## Datenquellen

### Eurostat (Marktpreise)
- **Input-Preisindex:** `apri_pi15_inq` — Codes 201000/203xxx/206xxx (Saatgut, Dünger, Futter)
- **Output-Preisindex:** `apri_pi15_outq` — Codes C0000/C1110…/D0000/D1100… (Getreide, Ölsaaten)
- Lib: `lib/eurostat.ts` — `fetchEurostatQuarterly()`, `fetchEurostatOutput()`, `PRODUKT_BAUM`
- Cache in `MarktpreisCache`, 7-Tage-Gültigkeit

### AFIG — agrarzahlungen.de
- Keine API, nur CSV-Download (impdata2024.csv, ~250MB)
- Import via `/api/agrarantraege/import`:
  - `multipart/form-data` (kleine Dateien)
  - `{action:"url", url:"https://..."}` — Server lädt CSV als Stream
  - `{action:"serverpath", path:"/pfad/datei.csv"}` — Liest von Dateisystem
- Streaming via Node.js `readline` — kein RAM-Overflow bei 250MB
- **Kritisch: `Readable.from([text])` verwenden**, NICHT `Readable.from(text.split("\n"))` — sonst concateniert readline alle Zeilen zu einer
- Streaming-Insert: max. 200 Einträge gleichzeitig im Speicher (lazy-delete year on first encounter)
- Encoding-Erkennung nur aus ersten 4KB (nicht ganzer File), dann Buffer direkt mit `.setEncoding()` streamen
- Aggregiert: mehrere Maßnahmen-Zeilen → ein Eintrag pro (Jahr, Name, PLZ)
- Maßnahmen als JSON in `massnahmen`-Feld: `[{code, ziel, egfl, eler, nationalKofi, anfang, ende}]`
- `AntragEmpfaenger` hat: `steuerNr`, `nationalKofiGesamt`, `elerUndKofiGesamt`, `gesamtBetrag`
- AFIG CSV nutzt `.` als Dezimaltrennzeichen (nicht `,`) — `parseNum` muss Format erkennen

### Geocoding
- Nominatim (OpenStreetMap) für Adressen
- OSRM für Routing in Tourenplanung

---

## PWA

- Manifest: `app/manifest.ts` (Next.js native)
- Service Worker: `public/sw.js` (cache-first, offline-fähig)
- Icons: `public/icons/icon-192x192.png`, `icon-512x512.png`
- Registration: `<ServiceWorkerRegistration />` in `app/layout.tsx`

---

## Drucken / PDF

- Seiten: `window.print()` + Tailwind `print:hidden` / `print:block` (versteckt Nav/Buttons)
- Firmendaten für Drucklayout: `GET /api/einstellungen?prefix=firma.`
- PDF-Export: jsPDF + jspdf-autotable (Tourenplan, Agraranträge)
- Tour-PDF: `GET /api/exporte/tour?tourname=X`
- AFIG-PDF: `GET /api/agrarantraege/pdf?kundeId=X`
- Rechnung-PDF: Drucklayout in `/lieferungen/[id]/page.tsx` (MwSt gruppiert nach Satz)

---

## Einstellungen-Architektur (Pflichtprinzip)

**Regel: Alle Einstellungen/Konfigurationen IMMER als Kachelseite + Unterseiten aufbauen.**

Struktur:
- `/einstellungen/page.tsx` — Kachelübersicht (EinstellungTile-Komponente)
- `/einstellungen/[bereich]/page.tsx` — Unterseite je Bereich
- Jede Unterseite hat Breadcrumb: `Einstellungen › Bereichsname`

Bestehende Kacheln:
| Kachel | Seite | Inhalt |
|--------|-------|--------|
| Firma | /einstellungen/firma | Name, Adresse, Kontakt |
| Erscheinungsbild | /einstellungen/erscheinungsbild | Logo (DB: system.logo) |
| Lager | /einstellungen/lager | Mindestbestände |
| Adressen | /einstellungen/adressen | Batch-Geocoding |
| Tour-Namen | /einstellungen/tournamen | system.tournamen JSON-Array |
| System | /einstellungen/system | Version, DB |
| Stammdaten | /einstellungen/stammdaten | Kategorien, Mitarbeiter, Einheiten; Link zu /kundenimport |
| Lieferanten | /einstellungen/lieferanten | Zahlungskonditionen, MwSt |
| Agraranträge (AFIG) | /einstellungen/agrarantraege | CSV-Import UI (Upload + Auto-Download) |

**Beim Hinzufügen neuer Features:** Prüfe immer ob konfigurierbare Werte in
eine Einstellungen-Kachel gehören. Neue Konfigurationsbereiche → neue Kachel + Unterseite.

EinstellungTile-Komponente ist in /app/einstellungen/page.tsx definiert.

---

## Bekannte Bugs / Fallstricke

| Problem | Ursache | Fix |
|---------|---------|-----|
| Rechnungsdatum null → "55 Jahre überfällig" | `new Date(null)` = 1970 | `rechnungDatum ?? datum` |
| Multi-Lieferung bekommt verschiedene Rechnungsnummern | Jedes PATCH erzeugt neue Nr. | Erste Lieferung PATCH, Rest PUT mit gleicher Nr. |
| React-Key-Warnung bei expandierbaren Zeilen | `key` auf `<>` statt `<React.Fragment>` | `<React.Fragment key={id}>` |
| Stale bestand in Inventur-Transaktion | `findMany` außerhalb `$transaction` | `tx.artikel.findMany` INNERHALB Callback |
| N+1 bei wiederkehrenden Lieferungen | `findFirst` in Loop | Bulk `findMany` + `Map<"artikelId|kundeId", Date>` |
| AFIG CSV "Keine Datensätze extrahiert" | `Readable.from(text.split("\n"))` | `Readable.from([text])` |
| AFIG Dezimalwerte falsch (2634.8→26348) | Punkt als Tausender gestrippt | Nur strippen wenn Komma auch vorhanden |

## Schemata: Wichtige Felder

- `Artikel.mwstSatz Float @default(19)` — 0 | 7 | 19
- `AntragEmpfaenger.steuerNr String?`
- `AntragEmpfaenger.nationalKofiGesamt Float @default(0)`
- `AntragEmpfaenger.elerUndKofiGesamt Float @default(0)`
- `Lieferung.rechnungNr String?` + `rechnungDatum DateTime?`
- `Kunde.lat Float?` + `lng Float?` (Geocoding)

## Mobile-Responsive-Muster

Für Tabellen-Seiten:
- `hidden sm:table-cell` — auf Mobile ausblenden (≥640px zeigen)
- `hidden md:table-cell` — ab Tablet zeigen (≥768px)
- `hidden lg:table-cell` — ab Desktop (≥1024px)
- Mobile Unterzeile: `<div className="sm:hidden text-xs text-gray-500">{sekundärInfo}</div>` in erster `<td>`
- Filter-Bar: immer `flex flex-wrap gap-3`
- Suchfelder: `w-full sm:w-72` statt fixer Breite
- Buttons in Formularen: `w-full sm:w-auto`

## Deployment

- Docker Image: `merlin2539/kundefutter:latest` (Docker Hub)
- CI: `.github/workflows/docker.yml` — baut auf Push zu `main` und `claude/**`
- Watchtower: zieht automatisch neue Images und startet Container neu
- Entrypoint: `./docker-entrypoint.sh` → `prisma migrate deploy` → `node server.js`
- Daten-Volume: `kundefutter_data:/data` (SQLite-Datei)

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
