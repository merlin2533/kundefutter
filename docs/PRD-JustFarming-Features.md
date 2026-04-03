# PRD: JustFarming-Wettbewerbsfeatures

> **Status:** Planung  
> **Erstellt:** 2026-04-03  
> **Branch:** `claude/justfarming-comparison-uj6K2`  
> **Ziel:** Integration der fehlenden JustFarming-Kernfeatures in AgrarOffice

---

## 1. Zusammenfassung

JustFarming (LAND-DATA GmbH) bietet Landwirten digitale Vorbereitende Buchhaltung. AgrarOffice ist ein Agrarhandel-ERP. Es fehlen vier Features, die AgrarOffice als Komplettlösung positionieren:

| # | Feature | Priorität | Aufwand |
|---|---------|-----------|---------|
| F1 | ZUGFeRD E-Rechnung (GoBD-konform) | Hoch | Mittel |
| F2 | Belegdigitalisierung & Dokumentenarchiv | Mittel | Mittel |
| F3 | Bankkonten-Abgleich (Zahlungszuordnung) | Mittel | Hoch |
| F4 | Steuerberater-Export (DATEV/CSV) | Hoch | Niedrig |

---

## 2. Feature F1: ZUGFeRD E-Rechnung

### 2.1 Problemstellung
Ab 2025 besteht in Deutschland E-Rechnungspflicht für B2B-Transaktionen. AgrarOffice erzeugt aktuell nur einfache HTML/PDF-Rechnungen ohne maschinenlesbares XML.

### 2.2 Anforderungen

**Muss (MVP):**
- ZUGFeRD 2.1.1 / Factur-X PDF/A-3 Erzeugung für Einzel- und Sammelrechnungen
- Einbettung der XML-Datei (`factur-x.xml`) in bestehende PDF-Rechnung
- GoBD-Pflichtfelder: Rechnungsnr, Datum, Verkäufer/Käufer mit USt-IdNr, Positionen mit MwSt, Zahlungsbedingungen
- Neues Feld `Einstellung`: `firma.ustIdNr` (USt-Identifikationsnummer)
- Neues Feld `Kunde`: `ustIdNr` (optional)
- Download als ZUGFeRD-PDF auf Rechnungsseiten
- Profil: ZUGFeRD BASIC (ausreichend für Agrarbereich)

**Soll:**
- XRechnung-Export (XML-only) für öffentliche Auftraggeber
- ZUGFeRD COMFORT Profil (mit Skonto-Informationen)
- Validierung gegen ZUGFeRD-Schema vor Ausgabe

**Kann:**
- Eingangsrechnungen: ZUGFeRD-Import & XML-Parsing
- Leitweg-ID Feld für öffentliche Auftraggeber

### 2.3 Technisches Design

**Neue Dateien:**
```
lib/zugferd.ts                              — XML-Generator & PDF-Einbettung
lib/zugferd-xml.ts                          — Factur-X XML Template Engine
app/api/exporte/zugferd/route.ts            — API: GET ?lieferungId= oder ?sammelrechnungId=
```

**Geänderte Dateien:**
```
prisma/schema.prisma                        — Kunde.ustIdNr, Einstellung (firma.ustIdNr)
app/lieferungen/[id]/rechnung/page.tsx      — ZUGFeRD-Download-Button
app/sammelrechnungen/page.tsx               — ZUGFeRD-Download je Rechnung
app/einstellungen/firma/page.tsx            — Feld: USt-IdNr
lib/firma.ts                                — ustIdNr in FirmaDaten
```

**Abhängigkeiten (npm):**
```
pdflib           — PDF/A-3 Erzeugung + XML-Einbettung (statt jsPDF)
```

**Datenmodell-Erweiterung:**
```prisma
// Kunde — neues Feld
ustIdNr     String?

// Einstellung — neuer Key
// firma.ustIdNr = "DE123456789"
```

**XML-Struktur (Factur-X BASIC):**
```xml
<rsm:CrossIndustryInvoice>
  <rsm:ExchangedDocumentContext>
    <ram:GuidelineSpecifiedDocumentContextParameter>
      <ram:ID>urn:factur-x.eu:1p0:basic</ram:ID>
    </ram:GuidelineSpecifiedDocumentContextParameter>
  </rsm:ExchangedDocumentContext>
  <rsm:ExchangedDocument>
    <ram:ID>{rechnungNr}</ram:ID>
    <ram:TypeCode>380</ram:TypeCode>
    <ram:IssueDateTime>...</ram:IssueDateTime>
  </rsm:ExchangedDocument>
  <rsm:SupplyChainTradeTransaction>
    <!-- Verkäufer, Käufer, Positionen, MwSt, Summen, Zahlungsbedingungen -->
  </rsm:SupplyChainTradeTransaction>
</rsm:CrossIndustryInvoice>
```

### 2.4 API-Design

```
GET /api/exporte/zugferd?lieferungId=N
GET /api/exporte/zugferd?sammelrechnungId=N
→ Response: application/pdf (PDF/A-3 mit eingebettetem XML)
→ Filename: RE-2026-0042_zugferd.pdf
```

### 2.5 UI-Integration

Bestehende Rechnungsseiten bekommen einen zusätzlichen Button:
```
[📄 PDF]  [📧 ZUGFeRD-PDF]  [📤 XML Export]
```

---

## 3. Feature F2: Belegdigitalisierung & Dokumentenarchiv

### 3.1 Problemstellung
Eingangsbelege (Lieferantenrechnungen, Quittungen) werden nicht digital erfasst. Kein zentrales Belegarchiv.

### 3.2 Anforderungen

**Muss (MVP):**
- Upload-Seite für Belege (Foto/PDF/Scan)
- Belegtypen: Eingangsrechnung, Quittung, Gutschrift, Sonstiges
- Metadaten: Datum, Betrag, Lieferant (optional zuordnen), Notiz
- Belegliste mit Filtern (Typ, Zeitraum, Lieferant, Betrag)
- Volltextsuche über Belegnotizen
- Dateispeicherung im Dateisystem (`/data/belege/YYYY/MM/`)
- GoBD-konform: keine Löschung, nur Storno-Markierung

**Soll:**
- KI-Texterkennung (OCR) über bestehende `lib/ai.ts` Integration
  - Automatische Extraktion: Datum, Betrag, Lieferant, Positionen
- Duplikaterkennung (Betrag + Datum + Lieferant)
- Zuordnung zu Wareneingang

**Kann:**
- Barcode/QR-Code-Erkennung auf Belegen
- E-Mail-Import (IMAP-Abruf von Rechnungsmails)

### 3.3 Technisches Design

**Neue Dateien:**
```
prisma: Modell Beleg                        — Belegstamm
app/belege/page.tsx                         — Belegliste
app/belege/neu/page.tsx                     — Beleg-Upload (kein Modal!)
app/belege/[id]/page.tsx                    — Belegdetail + Vorschau
app/api/belege/route.ts                     — GET (Liste), POST (Upload multipart)
app/api/belege/[id]/route.ts                — GET, PUT, DELETE (Storno)
app/api/belege/[id]/datei/route.ts          — GET (Datei-Download/Vorschau)
```

**Geänderte Dateien:**
```
prisma/schema.prisma                        — Modell Beleg
components/Nav.tsx                          — Menüpunkt "Belege" unter Finanzen
app/einstellungen/page.tsx                  — Kachel "Belege" (Aufbewahrungsfrist)
```

**Datenmodell:**
```prisma
model Beleg {
  id            Int       @id @default(autoincrement())
  typ           String    // eingangsrechnung | quittung | gutschrift | sonstiges
  nummer        String?   // Externe Belegnummer
  datum         DateTime
  betrag        Float?
  mwstBetrag    Float?
  mwstSatz      Float?
  lieferantId   Int?
  lieferant     Lieferant? @relation(fields: [lieferantId], references: [id])
  wareneingangId Int?
  dateiname     String    // Original-Dateiname
  dateipfad     String    // Serverpfad /data/belege/...
  dateigroesse  Int
  mimeType      String    // application/pdf, image/jpeg, etc.
  notiz         String?
  ocrText       String?   // Extrahierter Text (KI)
  ocrVerarbeitet Boolean  @default(false)
  storniert     Boolean   @default(false)
  stornoGrund   String?
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  @@index([lieferantId])
  @@index([datum])
  @@index([typ])
}
```

### 3.4 Datei-Storage

```
/data/belege/
  2026/
    04/
      beleg-0001-rechnung-mueller.pdf
      beleg-0002-quittung-scan.jpg
```

- Dateiname: `beleg-{id}-{typ}-{kurzname}.{ext}`
- Max. Dateigröße: 20 MB
- Erlaubte Typen: PDF, JPEG, PNG, TIFF
- Kein Löschen (GoBD) — nur `storniert=true`

---

## 4. Feature F3: Bankkonten-Abgleich

### 4.1 Problemstellung
Zahlungseingänge werden manuell auf Rechnungen zugeordnet. JustFarming bietet automatischen Abgleich.

### 4.2 Anforderungen

**Muss (MVP):**
- CSV/MT940-Import von Kontoauszügen (alle deutschen Banken exportieren CSV)
- Kontoumsatz-Liste mit Filter (Zeitraum, Betrag, Zuordnungsstatus)
- Manuelle Zuordnung: Umsatz → Rechnung (Lieferung/Sammelrechnung)
- Bei Zuordnung: automatisch `bezahltAm` setzen
- Matching-Vorschläge: Betrag + Kundenname im Verwendungszweck

**Soll:**
- Automatisches Matching (Rechnungsnummer im Verwendungszweck)
- Teilzahlungen erkennen
- CAMT.053 XML-Import (ISO 20022 Standard)

**Kann:**
- FinTS/HBCI-Anbindung (direkte Bankverbindung)
- Mehrere Bankkonten verwalten

### 4.3 Technisches Design

**Neue Dateien:**
```
prisma: Modell Kontoumsatz                  — Importierte Bankbuchungen
app/bankabgleich/page.tsx                   — Hauptseite: Import + Zuordnung
app/bankabgleich/import/page.tsx            — CSV/MT940 Upload
app/api/bankabgleich/route.ts               — GET (Umsätze), POST (Import)
app/api/bankabgleich/[id]/route.ts          — PUT (Zuordnung), DELETE
app/api/bankabgleich/vorschlaege/route.ts   — GET ?umsatzId= (Matching)
lib/bankimport.ts                           — CSV/MT940 Parser
```

**Geänderte Dateien:**
```
prisma/schema.prisma                        — Modell Kontoumsatz
components/Nav.tsx                          — Menüpunkt unter Finanzen
app/rechnungen/page.tsx                     — Hinweis auf unzugeordnete Umsätze
```

**Datenmodell:**
```prisma
model Kontoumsatz {
  id              Int       @id @default(autoincrement())
  kontoBezeichnung String?  // z.B. "Geschäftskonto Sparkasse"
  buchungsdatum   DateTime
  wertstellung    DateTime?
  betrag          Float     // positiv = Eingang, negativ = Ausgang
  waehrung        String    @default("EUR")
  verwendungszweck String
  gegenkonto      String?   // IBAN des Gegenkontos
  gegenkontoName  String?   // Name des Kontoinhabers
  saldo           Float?
  zugeordnet      Boolean   @default(false)
  lieferungId     Int?
  sammelrechnungId Int?
  importDatum     DateTime  @default(now())
  importDatei     String?   // Name der Importdatei
  
  @@index([buchungsdatum])
  @@index([zugeordnet])
  @@index([betrag])
}
```

### 4.4 CSV-Import-Format

Unterstützte Spaltenformate (Auto-Detection):
```
Sparkasse:  "Buchungstag";"Wertstellung";"Buchungstext";"Verwendungszweck";
            "Begünstigter/Zahlungspflichtiger";"Kontonummer";"BLZ";"Betrag";"Währung"
Volksbank:  Buchungstag;Valuta;Textschlüssel;Primanota;Zahlungsempfänger;
            IBAN;BIC;Verwendungszweck;Betrag;Währung
Generic:    Datum;Betrag;Verwendungszweck;Gegenkonto
```

### 4.5 Matching-Algorithmus

```typescript
function findeZuordnung(umsatz: Kontoumsatz): Vorschlag[] {
  // 1. Rechnungsnummer im Verwendungszweck suchen (RE-YYYY-NNNN)
  const reMatch = umsatz.verwendungszweck.match(/RE-\d{4}-\d{4}/);
  if (reMatch) → Exakter Match

  // 2. Betrag + Kundenname
  const offeneRechnungen = findMany({ bezahltAm: null });
  → Betrag-Match (±0.01€) + Levenshtein(gegenkontoName, kunde.name) < 3

  // 3. Betrag allein (niedrigste Konfidenz)
  → Alle offenen Rechnungen mit gleichem Betrag
}
```

---

## 5. Feature F4: Steuerberater-Export (DATEV)

### 5.1 Problemstellung
Steuerberater benötigen strukturierte Daten. Aktuell kein Export für Buchhaltungssoftware.

### 5.2 Anforderungen

**Muss (MVP):**
- DATEV-CSV-Export (Buchungsstapel) für Ausgangsrechnungen
- Zeitraum-Filter (Monat/Quartal/Jahr)
- Felder: Umsatz, Soll/Haben-Kz, BU-Schlüssel, Gegenkonto, Belegdatum, Belegnummer, Buchungstext
- DATEV-Kontenrahmen SKR03/SKR04 Zuordnung (konfigurierbar)
- Export-Seite unter `/exporte/datev`

**Soll:**
- Eingangsrechnungen (Belege) im Export
- DATEV-Format "Buchungsstapel" (Header + Datenzeilen)
- Erlöskonten je MwSt-Satz konfigurierbar (Einstellungen)

**Kann:**
- DATEV XML-Online Export
- GDPdU/GoBD-Datenträgerüberlassung (XML + Daten)

### 5.3 Technisches Design

**Neue Dateien:**
```
app/exporte/datev/page.tsx                  — Export-UI mit Zeitraum + Kontenrahmen
app/api/exporte/datev/route.ts              — GET ?von=&bis=&kontenrahmen=
lib/datev.ts                                — DATEV-CSV-Generator
```

**Geänderte Dateien:**
```
app/exporte/page.tsx                        — Kachel "DATEV-Export"
app/einstellungen/page.tsx                  — Kachel "Steuerberater / DATEV"
app/einstellungen/datev/page.tsx            — Kontenrahmen-Konfiguration
```

**DATEV-CSV-Format:**
```csv
Umsatz;Soll/Haben;BU-Schlüssel;Gegenkonto;Belegdatum;Belegnummer;Buchungstext
1190,00;S;3;10000;0104;RE-2026-0042;Lieferung Müller GmbH
```

**Kontenrahmen-Mapping (Einstellung):**
```json
{
  "kontenrahmen": "SKR03",
  "erloes_19": "8400",
  "erloes_7": "8300",
  "erloes_0": "8100",
  "forderungen": "10000",
  "bank": "1200"
}
```

---

## 6. Implementierungsplan

### Phase 1: Grundlagen (parallel ausführbar)

| Task | Datei(en) | Abhängigkeit |
|------|-----------|-------------|
| 1a. Schema-Migration: Kunde.ustIdNr | schema.prisma | — |
| 1b. Schema-Migration: Beleg-Modell | schema.prisma | — |
| 1c. Schema-Migration: Kontoumsatz-Modell | schema.prisma | — |
| 1d. firma.ustIdNr Einstellung + UI | einstellungen/firma | — |

> **Hinweis:** 1a–1c müssen in EINER Migration zusammengefasst werden (Prisma).

### Phase 2: Feature-Entwicklung (parallel pro Feature)

**Strang A — ZUGFeRD (F1):**
| Step | Task |
|------|------|
| A1 | `lib/zugferd-xml.ts` — Factur-X XML-Template |
| A2 | `lib/zugferd.ts` — PDF/A-3 mit XML-Einbettung |
| A3 | `app/api/exporte/zugferd/route.ts` — API-Route |
| A4 | UI: ZUGFeRD-Buttons auf Rechnungsseiten |

**Strang B — Belegdigitalisierung (F2):**
| Step | Task |
|------|------|
| B1 | `app/api/belege/route.ts` + `[id]/route.ts` — CRUD |
| B2 | `app/api/belege/[id]/datei/route.ts` — Datei-Serving |
| B3 | `app/belege/page.tsx` — Liste mit Filtern |
| B4 | `app/belege/neu/page.tsx` — Upload-Formular |
| B5 | `app/belege/[id]/page.tsx` — Detailansicht |
| B6 | KI-OCR Integration (optional, via `lib/ai.ts`) |

**Strang C — Bankabgleich (F3):**
| Step | Task |
|------|------|
| C1 | `lib/bankimport.ts` — CSV/MT940 Parser |
| C2 | `app/api/bankabgleich/route.ts` — Import + Liste |
| C3 | `app/api/bankabgleich/vorschlaege/route.ts` — Matching |
| C4 | `app/bankabgleich/page.tsx` — Hauptseite |
| C5 | `app/bankabgleich/import/page.tsx` — Upload |

**Strang D — DATEV-Export (F4):**
| Step | Task |
|------|------|
| D1 | `lib/datev.ts` — CSV-Generator |
| D2 | `app/api/exporte/datev/route.ts` — API |
| D3 | `app/exporte/datev/page.tsx` — UI |
| D4 | `app/einstellungen/datev/page.tsx` — Konfiguration |

### Phase 3: Integration & Navigation

| Task | Datei(en) |
|------|-----------|
| 3a. Nav-Einträge für alle Features | components/Nav.tsx |
| 3b. Einstellungen-Kacheln | app/einstellungen/page.tsx |
| 3c. Dashboard-KPIs (offene Belege, unzugeordnete Umsätze) | app/api/dashboard/route.ts |
| 3d. Exporte-Seite: DATEV-Kachel | app/exporte/page.tsx |

### Phase 4: Test & Review

| Task |
|------|
| Build-Test (`npm run build`) |
| Manuelle Feature-Tests |
| GoBD-Compliance-Review (ZUGFeRD Schema-Validierung) |
| Mobile-Responsive-Check |

---

## 7. Parallelisierungs-Matrix

```
         Phase 1          Phase 2                    Phase 3    Phase 4
         ┌──────┐    ┌─── Strang A (ZUGFeRD) ──────┐
         │Schema│    │                               │
         │Migra-│───►├─── Strang B (Belege) ────────┤───► Nav ───► Test
         │tion  │    │                               │    Einst.
         │      │    ├─── Strang C (Bankabgleich) ──┤    Dashb.
         │      │    │                               │
         └──────┘    └─── Strang D (DATEV) ─────────┘
```

Stränge A–D sind **vollständig unabhängig** und können parallel von separaten Agents bearbeitet werden.

---

## 8. Risiken & Entscheidungen

| Risiko | Mitigation |
|--------|-----------|
| pdf-lib vs. jsPDF Inkonsistenz | ZUGFeRD nutzt pdf-lib, bestehende PDFs bleiben bei jsPDF |
| ZUGFeRD-Schema komplex | Nur BASIC-Profil, handgeschriebenes XML-Template |
| GoBD bei Belegen | Keine echte Löschung, nur Storno-Flag |
| CSV-Bankformate variieren | Auto-Detection mit Fallback auf manuelle Spaltenzuordnung |
| DATEV-Kontenrahmen | Default SKR03, konfigurierbar in Einstellungen |

---

## 9. Nicht-Ziele (explizit ausgeschlossen)

- FinTS/HBCI Live-Bankverbindung (zu komplex, Sicherheitsrisiko)
- Vollständige Finanzbuchhaltung (Soll/Haben, Kontenplan, Bilanz)
- ELSTER-Schnittstelle (Finanzamt-Meldung)
- Steuerberater-Login (Portal)
- Automatische Umsatzsteuervoranmeldung
