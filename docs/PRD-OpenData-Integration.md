# PRD: Open-Data-Integration — Agrarmarktpreise & Landwirtschaftliche Flächendaten

**Version**: 1.0
**Datum**: 2026-03-28
**Status**: In Umsetzung

---

## 1. Zusammenfassung

Integration von zwei frei verfügbaren Open-Data-Quellen in KundeFutter:

1. **Eurostat Agrarpreisindex** — Marktpreis-Benchmark für Futtermittel, Dünger und Saatgut
2. **OpenStreetMap Overpass API** — Landwirtschaftliche Nutzflächen zur Kundenpotenzial-Analyse

---

## 2. Problemstellung

### 2.1 Fehlender Marktpreiskontext
- Disponenten sehen aktuell nur Einkaufspreise der Lieferanten und eigene Verkaufspreise
- Es fehlt ein externer Benchmark: "Ist der Lieferantenpreis marktgerecht?"
- Preistrends (steigend/fallend) sind nicht sichtbar — reaktive statt proaktive Einkaufsstrategie
- Margenoptimierung basiert nur auf internen Daten

### 2.2 Fehlende Gebietsanalyse
- Kundenkarte zeigt nur bestehende Kunden
- Kein Überblick über landwirtschaftliche Nutzflächen in der Umgebung
- Potenzialanalyse ("Wo gibt es Landwirte, die noch keine Kunden sind?") fehlt
- Außendienst hat keine datenbasierte Grundlage für Neukundenakquise

---

## 3. Datenquellen

### 3.1 Eurostat Agricultural Price Index API

| Eigenschaft | Wert |
|---|---|
| **Endpoint** | `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/{dataset}` |
| **Datasets** | `apri_pi15_ina` (jährlich), `apri_pi15_inq` (quartalsweise) |
| **Format** | JSON (JSON-stat) |
| **Auth** | Keine — frei zugänglich |
| **Rate Limit** | Keine dokumentiert, Fair-Use |
| **Abdeckung** | EU-Mitgliedstaaten, ab 2015 (Basisjahr = 100) |

**Relevante Produktcodes (Dimension `inputidx`):**

| Code | Bezeichnung | Mapping → Kategorie |
|---|---|---|
| `201000` | Seeds and planting stock | Saatgut |
| `203000` | Fertilisers and soil improvers | Dünger (Gesamt) |
| `203100` | Straight fertilizers | Dünger (Einzeln) |
| `203110` | Nitrogenous fertilizers | Stickstoffdünger |
| `203120` | Phosphatic fertilizers | Phosphatdünger |
| `203130` | Potassic fertilizers | Kalidünger |
| `203200` | Compound fertilizers | Mischdünger |
| `206000` | Animal feedingstuffs | Futtermittel (Gesamt) |
| `206100` | Straight feedingstuffs | Einzelfuttermittel |
| `206200` | Compound feedingstuffs | Mischfuttermittel |

**Beispiel-Request:**
```
GET https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/apri_pi15_inq
  ?format=JSON
  &geo=DE
  &inputidx=201000,203000,206000
  &unit=I15
  &p_adj=NI
  &sinceTimePeriod=2020
```

**Response-Struktur** (JSON-stat):
```json
{
  "version": "2.0",
  "label": "...",
  "id": ["freq", "p_adj", "unit", "inputidx", "geo", "time"],
  "size": [1, 1, 1, 3, 1, 16],
  "dimension": {
    "inputidx": {
      "category": {
        "index": { "201000": 0, "203000": 1, "206000": 2 },
        "label": { "201000": "Seeds", "203000": "Fertilisers", "206000": "Feed" }
      }
    },
    "time": {
      "category": {
        "index": { "2020-Q1": 0, "2020-Q2": 1, ... }
      }
    }
  },
  "value": { "0": 110.2, "1": 145.3, "2": 120.8, ... }
}
```

### 3.2 OpenStreetMap Overpass API

| Eigenschaft | Wert |
|---|---|
| **Endpoint** | `https://overpass-api.de/api/interpreter` |
| **Format** | JSON |
| **Auth** | Keine — frei zugänglich |
| **Rate Limit** | Fair-Use, max 2 parallele Anfragen, Timeout 180s |
| **Daten** | `landuse=farmland` Polygone weltweit |

**Beispiel-Query** (Farmland im 10km-Radius um Koordinate):
```
[out:json][timeout:60];
(
  way["landuse"="farmland"](around:10000,52.5,9.7);
  relation["landuse"="farmland"](around:10000,52.5,9.7);
);
out body;
>;
out skel qt;
```

---

## 4. Feature-Spezifikation

### 4.1 Modul: Marktpreise (`/marktpreise`)

#### 4.1.1 Neue Seite: Marktpreis-Dashboard

**Navigation**: Neuer Menüpunkt "Marktpreise" in der Hauptnavigation

**Inhalte:**

**A) Preisindex-Übersicht (Cards)**
- Drei KPI-Cards für die Hauptkategorien (Futtermittel, Dünger, Saatgut)
- Zeigt: aktueller Indexwert, Veränderung zum Vorquartal (↑/↓ mit Prozent)
- Farbcodierung: Grün = gefallen, Rot = gestiegen, Grau = stabil (±2%)

**B) Preisindex-Verlauf (Chart)**
- SVG-Liniendiagramm mit Quartals-Datenpunkten
- Drei Linien (Futter/Dünger/Saatgut) mit Legende
- Zeitraum: letzte 3 Jahre (12 Quartale)
- Tooltips mit exaktem Wert bei Hover
- Basisjahr 2015 = 100 als gestrichelte Referenzlinie

**C) Detailtabelle**
- Alle verfügbaren Subcategories mit Index-Werten
- Spalten: Kategorie | Aktuell | Vorquartal | Veränderung | Trend (Sparkline)
- Sortierbar nach jeder Spalte
- Filter nach Hauptkategorie

#### 4.1.2 Marktpreis-Benchmark auf Artikelseite

**Ort**: Artikel-Detailseite (`/artikel/[id]`)

**Neuer Abschnitt: "Marktpreis-Vergleich"**
- Zeigt den passenden Eurostat-Index basierend auf Artikelkategorie:
  - Kategorie "Futter" → Index `206000`
  - Kategorie "Duenger" → Index `203000`
  - Kategorie "Saatgut" → Index `201000`
- Visualisierung: Mini-Balkendiagramm
  - Balken 1: Marktindex (normalisiert)
  - Balken 2: Eigener Einkaufspreis (relativ zum Basisjahr)
  - Balken 3: Eigener Verkaufspreis
- Warnung wenn Einkaufspreis-Entwicklung stärker steigt als Marktindex

#### 4.1.3 Dashboard-Widget

**Ort**: Hauptdashboard (`/`)

**Neues KPI-Card: "Markttrend"**
- Zeigt zusammengefassten Trend aller drei Kategorien
- Klick führt zu `/marktpreise`

### 4.2 Modul: Agrarflächen-Analyse

#### 4.2.1 Erweiterung Kundenkarte (`/kunden/karte`)

**Neuer Toggle: "Agrarflächen anzeigen"**
- Schaltet Overlay mit `landuse=farmland`-Polygonen ein/aus
- Flächen werden halbtransparent grün dargestellt
- Lazy Loading: Flächen werden erst ab Zoom-Level 10 geladen
- Abfrage basiert auf dem aktuellen Kartenausschnitt (Bounding Box)
- Caching: Bereits geladene Bereiche werden nicht erneut abgefragt

**Flächenstatistik-Panel**
- Zeigt im aktuellen Kartenausschnitt:
  - Gesamte landwirtschaftliche Fläche (ha)
  - Anzahl Bestandskunden im Bereich
  - Geschätzte Kunden-Abdeckung (Kunden pro 1000 ha)
- Aktualisiert sich bei Pan/Zoom

#### 4.2.2 Kundenpotenzial-Analyse (`/kunden/[id]`)

**Neuer Abschnitt: "Umgebungsanalyse"**
- Button: "Agrarflächen im Umkreis analysieren"
- Zeigt landwirtschaftliche Nutzflächen im 5/10/15km-Radius um den Kunden
- Berechnet: Gesamtfläche (ha), Anzahl weitere Kunden im Bereich
- Potenzial-Score: Fläche ÷ bestehende Kunden = "unversorgtes Potenzial"

#### 4.2.3 Standalone-Abfrage: Gebiet analysieren (`/gebietsanalyse`)

**Neue Seite für Außendienst/Geschäftsführung**

**Funktionen:**
- Interaktive Karte mit Klick oder Adresseingabe zum Setzen eines Zentrums
- Radius-Auswahl: 5 / 10 / 15 / 25 km
- Nach Klick auf "Analysieren":
  - Lädt Agrarflächen via Overpass API
  - Lädt bestehende Kunden im Bereich aus DB
  - Zeigt Karte mit:
    - Grüne Polygone = Agrarflächen
    - Farbige Marker = Bestandskunden
    - Gestrichelte Kreislinie = Analyseradius
  - Ergebnispanel:
    - Landwirtschaftliche Fläche gesamt (ha)
    - Anzahl Bestandskunden im Radius
    - Kunden-Dichte (Kunden pro 1000 ha)
    - Liste der Bestandskunden mit Entfernung
    - Empfehlung: "Gebiet unterversorgt" / "Gut abgedeckt" / "Überversorgt"

---

## 5. Datenmodell-Erweiterungen

### 5.1 Neues Prisma-Modell: MarktpreisCache

```prisma
model MarktpreisCache {
  id          Int      @id @default(autoincrement())
  dataset     String   // "apri_pi15_inq" oder "apri_pi15_ina"
  produktCode String   // z.B. "206000"
  produktName String   // z.B. "Futtermittel"
  zeitraum    String   // z.B. "2024-Q3" oder "2024"
  indexWert   Float    // z.B. 152.1
  einheit     String   @default("I15") // Index 2015=100
  land        String   @default("DE")
  abgerufenAm DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([dataset, produktCode, zeitraum, land])
}
```

### 5.2 Neues Prisma-Modell: AgrarflaechenCache

```prisma
model AgrarflaechenCache {
  id          Int      @id @default(autoincrement())
  bbox        String   // "lat1,lng1,lat2,lng2"
  flaecheHa   Float   // Gesamtfläche in Hektar
  polygonCount Int     // Anzahl Polygone
  geojson     String   // GeoJSON FeatureCollection (komprimiert)
  abgerufenAm DateTime @default(now())
  createdAt   DateTime @default(now())

  @@unique([bbox])
}
```

---

## 6. API-Endpunkte (Backend)

### 6.1 Marktpreise

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/marktpreise` | Alle gecachten Marktpreise, optional `?kategorie=Futter` |
| `GET` | `/api/marktpreise/aktuell` | Aktuellste Werte je Kategorie (für Dashboard) |
| `POST` | `/api/marktpreise/sync` | Eurostat-Daten abrufen und Cache aktualisieren |
| `GET` | `/api/marktpreise/vergleich?artikelId=5` | Marktindex vs. Einkaufspreis für einen Artikel |

### 6.2 Agrarflächen

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/agrarflaechen?lat=52.5&lng=9.7&radius=10000` | Farmland-Daten im Radius |
| `GET` | `/api/agrarflaechen/analyse?lat=52.5&lng=9.7&radius=10000` | Analyse mit Kunden-Overlay |

---

## 7. UI-Mockup-Beschreibung

### 7.1 Marktpreise-Seite

```
┌─────────────────────────────────────────────────────┐
│  Marktpreise — Agrarpreisindex (Eurostat)            │
│                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ Futter   │ │ Dünger   │ │ Saatgut  │            │
│  │ 152.1    │ │ 183.6    │ │ 133.8    │            │
│  │ ▼ -2.3%  │ │ ▲ +4.1%  │ │ ▼ -1.0%  │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  ┌───────────────────────────────────────────┐      │
│  │  Preisindex-Verlauf (Quartale)            │      │
│  │                                            │      │
│  │  200 ┤          ╭─╮                       │      │
│  │      │     ╭───╯   ╰──╮  Dünger          │      │
│  │  150 ┤╭───╯            ╰────── Futter     │      │
│  │      ││                                    │      │
│  │  100 ┤┼──────────────────────── Basis 2015│      │
│  │      └┤────┤────┤────┤────┤────┤          │      │
│  │       Q1   Q2   Q3   Q4   Q1   Q2        │      │
│  └───────────────────────────────────────────┘      │
│                                                      │
│  ┌───────────────────────────────────────────┐      │
│  │ Kategorie          │ Aktuell │ Δ Vorq. │ Trend │ │
│  │────────────────────┼─────────┼─────────┼───────│ │
│  │ Futtermittel gesamt │ 152.1   │ -2.3%   │ ~~~↓ │ │
│  │ ├ Einzelfutter      │ 148.5   │ -3.1%   │ ~~↓  │ │
│  │ ├ Mischfutter       │ 155.2   │ -1.8%   │ ~↓   │ │
│  │ Dünger gesamt       │ 183.6   │ +4.1%   │ ~~↑  │ │
│  │ ├ Stickstoff        │ 192.3   │ +5.2%   │ ~~~↑ │ │
│  │ ├ Phosphat          │ 171.4   │ +2.8%   │ ~↑   │ │
│  │ Saatgut             │ 133.8   │ -1.0%   │ ~↓   │ │
│  └───────────────────────────────────────────┘      │
│                                                      │
│  Quelle: Eurostat apri_pi15_inq · Stand: Q4 2025   │
│  Letzte Aktualisierung: 28.03.2026                   │
└─────────────────────────────────────────────────────┘
```

### 7.2 Gebietsanalyse-Seite

```
┌────────────────────────────────────────────────────────┐
│  Gebietsanalyse — Agrarflächen & Kundenpotenzial       │
│                                                         │
│  ┌─────────────────────────────────┐ ┌──────────────┐  │
│  │                                 │ │ Zentrum:     │  │
│  │      [Interaktive Karte]        │ │ 📍 Nienburg  │  │
│  │                                 │ │              │  │
│  │  ████ = Agrarflächen            │ │ Radius:      │  │
│  │  📍    = Bestandskunden         │ │ ◉ 5km        │  │
│  │  - - - = Analyseradius          │ │ ○ 10km       │  │
│  │                                 │ │ ○ 15km       │  │
│  │                                 │ │ ○ 25km       │  │
│  │                                 │ │              │  │
│  └─────────────────────────────────┘ │ [Analysieren]│  │
│                                       │              │  │
│  ┌──────────────────────────────────┐│ ────────────  │  │
│  │ Ergebnis                         ││ Agrarfläche: │  │
│  │                                  ││ 4.230 ha     │  │
│  │ Kundendichte: 2,4 / 1000 ha     ││              │  │
│  │ Bewertung: 🟡 Unterversorgt     ││ Kunden:      │  │
│  │                                  ││ 8 im Radius  │  │
│  │ Kunden im Gebiet:               ││              │  │
│  │ • Hof Meier (2,3 km)            ││ Dichte:      │  │
│  │ • Agrar GmbH (4,1 km)           ││ 1,9 / 1000ha │  │
│  │ • ...                            ││              │  │
│  └──────────────────────────────────┘└──────────────┘  │
│                                                         │
│  Quelle: OpenStreetMap · Overpass API                   │
└────────────────────────────────────────────────────────┘
```

---

## 8. Caching-Strategie

| Datenquelle | Cache-Dauer | Begründung |
|---|---|---|
| Eurostat Quartalsindex | 7 Tage | Daten ändern sich quartalsweise |
| Eurostat Jahresindex | 30 Tage | Daten ändern sich jährlich |
| Overpass Farmland | 30 Tage | Flächendaten ändern sich selten |

Cache wird in SQLite gespeichert (Prisma-Modelle). Bei jedem API-Abruf wird geprüft:
1. Existiert ein Cache-Eintrag?
2. Ist er jünger als die Cache-Dauer?
3. Wenn ja → Cache verwenden, wenn nein → Eurostat/Overpass abrufen und Cache aktualisieren

---

## 9. Technische Risiken & Mitigationen

| Risiko | Mitigation |
|---|---|
| Eurostat API nicht erreichbar | Fallback auf Cache; Hinweis "Daten von [Datum]" |
| Overpass API Timeout bei großen Gebieten | Radius begrenzen (max 25km), Timeout 60s |
| Overpass Rate Limiting | Sequenzielle Abfragen, min. 2s Pause, Client-Cache |
| JSON-stat Format komplex | Parser-Utility in `/lib/eurostat.ts` kapseln |
| Große GeoJSON-Daten | Polygone vereinfachen, nur Fläche berechnen statt alle Koordinaten speichern |

---

## 10. Implementierungsplan

### Phase 1: Marktpreise (Priorität)
1. Prisma-Schema erweitern + Migration
2. Eurostat JSON-stat Parser (`/lib/eurostat.ts`)
3. API-Routen: `/api/marktpreise/*`
4. Marktpreise-Seite (`/app/marktpreise/page.tsx`)
5. Dashboard-Widget
6. Artikel-Detail-Integration

### Phase 2: Agrarflächen
7. Overpass API Client (`/lib/overpass.ts`)
8. API-Routen: `/api/agrarflaechen/*`
9. Gebietsanalyse-Seite (`/app/gebietsanalyse/page.tsx`)
10. Kundenkarte: Farmland-Overlay
11. Kunden-Detail: Umgebungsanalyse

---

## 11. Erfolgskriterien

- [ ] Marktpreise-Seite zeigt aktuelle Eurostat-Daten für DE
- [ ] Preisindex-Verlauf als interaktives Liniendiagramm
- [ ] Dashboard zeigt Markttrend-Widget
- [ ] Artikel-Detailseite zeigt Marktpreis-Benchmark
- [ ] Gebietsanalyse-Seite funktioniert mit Karteninteraktion
- [ ] Kundenkarte zeigt Agrarflächen-Overlay
- [ ] Kunden-Detailseite zeigt Umgebungsanalyse
- [ ] Caching funktioniert für beide Datenquellen
- [ ] Fallback bei nicht-erreichbaren APIs
