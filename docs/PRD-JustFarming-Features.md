# PRD: JustFarming-Wettbewerbsfeatures

> **Status:** In Umsetzung  
> **Erstellt:** 2026-04-03  
> **Aktualisiert:** 2026-04-03 (nach Merge von `main`)  
> **Branch:** `claude/justfarming-comparison-uj6K2`  
> **Ziel:** Integration der fehlenden JustFarming-Kernfeatures in AgrarOffice

---

## 1. Zusammenfassung & Ist-Stand

JustFarming (LAND-DATA GmbH) bietet Landwirten digitale Vorbereitende Buchhaltung. AgrarOffice ist ein Agrarhandel-ERP.

| # | Feature | Status | Priorität |
|---|---------|--------|-----------|
| F1 | ZUGFeRD E-Rechnung (GoBD-konform) | ❌ Fehlt | Hoch |
| F2 | Belegdigitalisierung & Dokumentenarchiv | ✅ Implementiert als Ausgabenbuch | — |
| F3 | Bankkonten-Abgleich (Zahlungszuordnung) | ❌ Fehlt | Mittel |
| F4 | Steuerberater-Export (DATEV) | ✅ Implementiert | — |

### Was bereits existiert (nach main-Merge)

| Feature | Dateien |
|---------|---------|
| **Ausgabenbuch** (Belege, KI-OCR) | `app/ausgaben/`, `app/api/ausgaben/`, `app/api/ki/beleg/` |
| **DATEV-Export** | `app/api/exporte/datev/route.ts`, `app/einstellungen/datev/` |
| **Rechnungen** (Einzel + Sammel) | `app/rechnungen/`, `app/sammelrechnungen/`, `app/api/exporte/rechnung/` |
| **Mahnwesen** | `app/mahnwesen/` |

---

## 2. Feature F1: ZUGFeRD E-Rechnung

### 2.1 Problemstellung
Ab 2025 besteht E-Rechnungspflicht für B2B-Transaktionen in Deutschland. AgrarOffice erzeugt aktuell nur einfache jsPDF-Rechnungen ohne maschinenlesbares XML. Kunden und Steuerberater können Rechnungen nicht automatisch einlesen.

### 2.2 Anforderungen

**Muss:**
- ZUGFeRD BASIC-WL XML (Factur-X) erzeugen für Einzel- und Sammelrechnungen  
- XML-Download-Button auf allen Rechnungsseiten  
- GoBD-Pflichtfelder vollständig: Rechnungsnr, Datum, Verkäufer/Käufer (USt-IdNr), Positionen mit MwSt, Zahlungsbedingungen  
- `firma.ustIdNr` als neues Einstellungsfeld (Pflichtfeld für ZUGFeRD)  
- `Kunde.ustIdNr` als optionales Feld (für B2B-Pflicht)  

**Soll:**
- XRechnung-Export (reines XML) als zweite Option  
- ZIP-Download (PDF + XML) für Archivierung  

**Kann:**
- Eingehende ZUGFeRD-XMLs parsen (Eingangsrechnungen)  

### 2.3 Technisches Design

**Neue Dateien:**
```
lib/zugferd-xml.ts              — Factur-X XML-Generator (reine Strings, keine externen Deps)
app/api/exporte/zugferd/route.ts — GET ?lieferungId= oder ?sammelrechnungId= → XML-Download
```

**Geänderte Dateien:**
```
prisma/schema.prisma            — Kunde.ustIdNr String? hinzufügen
lib/firma.ts                    — ustIdNr in FirmaDaten Interface
app/einstellungen/firma/page.tsx — Feld USt-IdNr ergänzen
app/api/einstellungen/route.ts  — Prefix "firma." erlaubt (bereits ok)
app/lieferungen/[id]/rechnung/page.tsx — ZUGFeRD XML-Button
app/sammelrechnungen/page.tsx   — ZUGFeRD XML-Button je Rechnung
app/rechnungen/page.tsx         — ZUGFeRD XML-Button je Rechnung
app/kunden/[id]/page.tsx        — Feld ustIdNr im Stammdaten-Tab
app/api/kunden/[id]/route.ts    — ustIdNr im PUT speichern
```

**Implementierungsdetail (kein pdf-lib nötig):**
- XML wird als separater Download angeboten (`.xml`-Datei)
- Kein PDF/A-3 Embedding (würde `pdf-lib` erfordern) — marktübliche Alternative
- Steuerberater importieren XML direkt in DATEV

**Factur-X BASIC-WL XML-Struktur:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<rsm:CrossIndustryInvoice xmlns:rsm="urn:un:unece:uncefact:data:standard:CrossIndustryInvoice:100"
  xmlns:ram="urn:un:unece:uncefact:data:standard:ReusableAggregateBusinessInformationEntity:100"
  xmlns:udt="urn:un:unece:uncefact:data:standard:UnqualifiedDataType:100">
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basicwl</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>{rechnungNr}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>
      <udt:DateTimeString format="102">{YYYYMMDD}</udt:DateTimeString>
    </ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <!-- SellerTradeParty: firma.name, firma.strasse, firma.plz/ort, firma.ustIdNr -->
    <!-- BuyerTradeParty:  kunde.name, kunde.strasse, kunde.ustIdNr -->
    <!-- IncludedSupplyChainTradeLineItem: je Lieferposition -->
    <!-- ApplicableTradeTax: je MwSt-Satz (0/7/19%) -->
    <!-- SpecifiedTradeSettlementHeaderMonetarySummation: Netto, MwSt, Brutto -->
    <!-- PaymentTerms: zahlungsziel -->
    <!-- IBAN, BIC -->
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
```

### 2.4 API
```
GET /api/exporte/zugferd?lieferungId=N      → application/xml, RE-2026-0042.xml
GET /api/exporte/zugferd?sammelrechnungId=N → application/xml, RE-2026-0042.xml
```

### 2.5 UI-Integration
Auf jeder Rechnungszeile/-seite:
```
[📄 PDF]  [⬇ ZUGFeRD XML]
```

---

## 3. Feature F2: Belegdigitalisierung (✅ IMPLEMENTIERT)

### Ist-Stand

Vollständig implementiert als **Ausgabenbuch** (`/ausgaben`):

| Komponente | Status |
|-----------|--------|
| CRUD (Erstellen, Bearbeiten, Löschen) | ✅ |
| KI-OCR (Foto → Felder) | ✅ via `POST /api/ki/beleg` |
| Datei-Upload (Bild-Anhang) | ✅ `/public/uploads/belege/YYYY/` |
| Lieferant-Zuordnung | ✅ |
| Kategorie-Filter | ✅ 8 Kategorien |
| Bezahlt-Status | ✅ |
| DATEV-Export inklusive | ✅ Ausgaben erscheinen im DATEV-Export |

### Noch fehlend (Delta)

| Was | Wo | Prio |
|-----|----|------|
| Kategorien konfigurierbar machen | `/einstellungen/ausgaben/` | Mittel |
| Einstellungen-Kachel | `/einstellungen/page.tsx` | Niedrig |
| Aufbewahrungsfrist-Hinweis (GoBD 10 Jahre) | `/einstellungen/ausgaben/` | Niedrig |

---

## 4. Feature F3: Bankkonten-Abgleich

### 4.1 Problemstellung
Zahlungseingänge werden in AgrarOffice heute manuell gebucht (Datum-Picker in Rechnungsliste). Es gibt keinen Import von Kontoauszügen und keine automatische Zuordnung von Bankbuchungen zu Rechnungen.

### 4.2 Anforderungen

**Muss:**
- CSV-Import von Kontoauszügen (Sparkasse, Volksbank, DKB, generic)
- Kontoumsatz-Liste mit Filter (Zeitraum, Betrag, zugeordnet/offen)
- Manuelle Zuordnung: Umsatz → Rechnung (Lieferung oder Sammelrechnung)
- Bei Zuordnung: `bezahltAm` automatisch setzen
- Matching-Vorschläge basierend auf Betrag + Rechnungsnummer im Verwendungszweck

**Soll:**
- Automatisches Matching wenn Rechnungsnr. (`RE-YYYY-NNNN`) im Verwendungszweck
- Mehrere Bankkonten konfigurierbar (Einstellungen)

**Kann:**
- MT940-Import (SWIFT-Bankformat)
- Ausgaben (Eingangsrechnungen) über Bankabgleich als bezahlt markieren

### 4.3 Technisches Design

**Neue Dateien:**
```
lib/bankimport.ts                       — CSV/MT940 Parser (Auto-Detection)
app/bankabgleich/page.tsx               — Hauptseite: Umsatzliste + Zuordnung
app/bankabgleich/import/page.tsx        — CSV-Upload
app/api/bankabgleich/route.ts           — GET (Liste), POST (Import)
app/api/bankabgleich/[id]/route.ts      — PUT (Zuordnung), DELETE
app/api/bankabgleich/vorschlaege/route.ts — GET ?umsatzId= (Matching-Vorschläge)
app/einstellungen/bankkonten/page.tsx   — Bankkonten konfigurieren
```

**Geänderte Dateien:**
```
prisma/schema.prisma                    — Modell Kontoumsatz
components/Nav.tsx                      — "Bankabgleich" unter Finanzen
app/einstellungen/page.tsx              — Kachel "Bankkonten"
app/api/einstellungen/route.ts          — Prefix "bankabgleich." erlauben
app/rechnungen/page.tsx                 — Badge: offene Umsätze
app/api/dashboard/route.ts             — KPI: unzugeordnete Umsätze
```

**Datenmodell:**
```prisma
model Kontoumsatz {
  id                Int       @id @default(autoincrement())
  kontoBezeichnung  String?   // "Geschäftskonto Sparkasse"
  buchungsdatum     DateTime
  wertstellung      DateTime?
  betrag            Float     // + = Eingang, - = Ausgang
  waehrung          String    @default("EUR")
  verwendungszweck  String
  gegenkonto        String?   // IBAN Gegenpartei
  gegenkontoName    String?   // Name Gegenpartei
  saldo             Float?
  zugeordnet        Boolean   @default(false)
  lieferungId       Int?
  sammelrechnungId  Int?
  ausgabeId         Int?      // für Ausgaben-Zuordnung
  importDatum       DateTime  @default(now())
  importDatei       String?

  @@index([buchungsdatum])
  @@index([zugeordnet])
  @@index([betrag])
}
```

### 4.4 CSV-Format Auto-Detection

```
Sparkasse:   "Buchungstag";"Wertstellung";"Buchungstext";"Verwendungszweck";"Betrag";"Währung"
Volksbank:   Buchungstag;Valuta;Verwendungszweck;Betrag;Währung
DKB:         Buchungsdatum;Glaeubiger-ID;Betrag (EUR);Glaeubiger/Zahlungsempfaenger;Verwendungszweck
Generic:     Datum;Betrag;Verwendungszweck
```

### 4.5 Matching-Logik

```typescript
// Stufe 1 — Rechnungsnummer exakt (höchste Konfidenz)
/RE-\d{4}-\d{4}/.exec(verwendungszweck)

// Stufe 2 — Betrag + Kundenname (mittlere Konfidenz)
Math.abs(betrag - rechnungsBrutto) < 0.01
  && levenshtein(gegenkontoName, kunde.name) <= 3

// Stufe 3 — Betrag allein (niedrige Konfidenz)
Math.abs(betrag - rechnungsBrutto) < 0.01
```

### 4.6 Einstellungen: Bankkonten

Konfigurierbar in `/einstellungen/bankkonten/` (Einstellungs-Keys: `bankabgleich.*`):
- Liste der Bankkonten (Name, IBAN, BIC, Bank)
- Standard-Konto für Import-Vorauswahl

---

## 5. Feature F4: DATEV-Export (✅ IMPLEMENTIERT)

### Ist-Stand

Vollständig implementiert:

| Komponente | Status |
|-----------|--------|
| API `GET /api/exporte/datev` | ✅ |
| Einstellungen `/einstellungen/datev/` | ✅ (Beraternr, Mandantennr, SKR03/04, WJ-Beginn) |
| Export-Kachel in `/exporte/` | ✅ |
| Einnahmen (Rechnungen nach MwSt) | ✅ |
| Ausgaben (Betriebsausgaben) | ✅ |
| UTF-8 BOM CSV mit DATEV-Header | ✅ |

### Noch fehlend (Delta)

| Was | Wo | Prio |
|-----|----|------|
| Bankabgleich-Buchungen im Export | nach F3-Implementierung | Mittel |
| Erlöskonten konfigurierbar | `/einstellungen/datev/` erweitern | Niedrig |

---

## 6. Einstellungen-Integration (Querschnitt)

Alle neuen Features brauchen Einstellungs-Kacheln und -Seiten:

| Kachel | Seite | Inhalt | Status |
|--------|-------|--------|--------|
| 🏦 Bankkonten | `/einstellungen/bankkonten/` | Konten verwalten (Name, IBAN, BIC) | ❌ fehlt |
| 🧾 Ausgaben | `/einstellungen/ausgaben/` | Kategorien konfigurieren, GoBD-Hinweis | ❌ fehlt |
| 🏢 Firma (Erweiterung) | `/einstellungen/firma/` | USt-IdNr ergänzen | ❌ fehlt |

Settings-API erweitern: `ALLOWED_PREFIXES` um `"bankabgleich."` ergänzen.

---

## 7. Dashboard & Navigation

### Dashboard-KPIs (neu)
```
app/api/dashboard/route.ts:
- unzugeordneteUmsaetze: Kontoumsatz.count({ zugeordnet: false })
```

### Navigation (Finanzen-Gruppe erweitern)
```
components/Nav.tsx:
Finanzen:
  + { href: "/bankabgleich", label: "Bankabgleich" }     ← neu
```

---

## 8. Implementierungsplan (aktuell)

### Phase 1 — Schema & Grundlagen (sequenziell, sofort)

| # | Task | Datei |
|---|------|-------|
| 1 | `Kunde.ustIdNr String?` hinzufügen | `prisma/schema.prisma` |
| 2 | `Kontoumsatz` Modell hinzufügen | `prisma/schema.prisma` |
| 3 | Migration ausführen | `npx prisma migrate dev` |

### Phase 2 — Parallelimplementierung (4 unabhängige Stränge)

```
Strang A:  ZUGFeRD XML (F1)
  A1. lib/zugferd-xml.ts
  A2. app/api/exporte/zugferd/route.ts
  A3. UI: Buttons auf Rechnungsseiten + Kunden-Stammdaten-Tab

Strang B:  Bankabgleich (F3)
  B1. lib/bankimport.ts
  B2. app/api/bankabgleich/route.ts + [id]/route.ts + vorschlaege/route.ts
  B3. app/bankabgleich/page.tsx
  B4. app/bankabgleich/import/page.tsx

Strang C:  Einstellungen & Integration
  C1. app/einstellungen/firma/page.tsx — USt-IdNr
  C2. app/einstellungen/ausgaben/page.tsx — Kategorien
  C3. app/einstellungen/bankkonten/page.tsx — Bankkonten
  C4. app/einstellungen/page.tsx — neue Kacheln
  C5. app/api/einstellungen/route.ts — Prefix "bankabgleich."

Strang D:  Nav + Dashboard
  D1. components/Nav.tsx — Bankabgleich-Eintrag
  D2. app/api/dashboard/route.ts — unzugeordneteUmsaetze KPI
  D3. app/page.tsx (Dashboard) — neues KPI-Widget
```

### Phase 3 — Integration & Review
- Kunden-Stammdaten Tab: `ustIdNr` Feld + `api/kunden/[id]` PUT
- Build-Test
- Commit & Push

---

## 9. Parallelisierungs-Matrix

```
Phase 1 (seq.)         Phase 2 (parallel)              Phase 3
┌─────────────┐   ┌──── A: ZUGFeRD ─────────────┐
│  Schema-    │   │                               │   Integration
│  Migration  │──►├──── B: Bankabgleich ──────────┤──► & Build-Test
│  + Prisma   │   │                               │   & Push
│  generate   │   ├──── C: Einstellungen ─────────┤
└─────────────┘   │                               │
                  └──── D: Nav + Dashboard ────────┘
```

---

## 10. Nicht-Ziele

- FinTS/HBCI Live-Bankverbindung
- Vollständige Finanzbuchhaltung (Bilanz, GuV)
- ELSTER-Schnittstelle
- Steuerberater-Login-Portal
- PDF/A-3 ZUGFeRD-Embedding (XML-Download ist Standard-Alternative)
