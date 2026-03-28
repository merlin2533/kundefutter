# PRD: KundeFutter – Verwaltungssystem für Futter, Dünger & Saatgut

**Version**: 1.1
**Stand**: 2026-03-28
**Status**: In Entwicklung

---

## 1. Kontext & Ziel

Wir sind Wiederverkäufer von Tierfutter, Dünger und Saatgut. Dieses Tool zentralisiert Kunden-, Artikel-, Lieferanten- und Lagerverwaltung, berechnet Margen, prognostiziert Lagerreichweiten und schlägt Nachbestellungen automatisch vor.

---

## 2. Nutzergruppen

| Rolle | Beschreibung |
|---|---|
| **Disponent** | Plant Lieferungen, verwaltet Artikel, Lager & Lieferanten |
| **Außendienst** | Pflegt Kundendaten, erfasst Bedarfe |
| **Geschäftsführung** | Benötigt Gesamtübersichten, Margenberichte & Exporte |

---

## 3. Kernmodule

### 3.1 Kundenverwaltung
- Anlegen, Bearbeiten, Archivieren von Kunden
- Stammdaten: Name, Adresse, Kontaktperson, Telefon, E-Mail, Notizen
- Kundenkategorie (Landwirt, Pferdehof, Kleintierhalter, etc.)
- Übersicht aller Artikel, die ein Kunde regelmäßig bezieht
- Lieferhistorie pro Kunde (Datum, Artikel, Menge, Preis)
- **Individuelles Preismanagement** pro Kunde pro Artikel (Sonderpreise, Rabatte)

### 3.2 Artikelverwaltung
- Anlegen mit: Name, Artikelnummer, Kategorie (Futter / Dünger / Saatgut), Einheit (kg, t, Sack, Liter), Beschreibung
- Zuweisung zu einem oder mehreren Lieferanten inkl. Lieferanten-Artikelnummer und **Einkaufspreis**
- **Standardverkaufspreis** & automatische Margenberechnung
- Kundenspezifischer Preis überschreibt Standardpreis
- Status: aktiv / inaktiv

### 3.3 Lieferantenverwaltung
- Stammdaten: Name, Ansprechpartner, Kontakt, Adresse
- Übersicht aller Artikel, die bei diesem Lieferanten bestellbar sind
- Mindestbestellmenge, Lieferzeit (in Tagen)
- Notizen

### 3.4 Lagerverwaltung
- **Lagerbestand** pro Artikel (aktueller Bestand in Einheiten)
- **Mindestbestand** (Meldebestand) pro Artikel – unterhalb dessen wird Alarm ausgelöst
- **Wareneingänge** erfassen: Datum, Artikel, Menge, Einkaufspreis (aktualisiert Bestand)
- **Warenausgänge** automatisch durch Auslieferungen (Bestandsreduzierung)
- Lagerkorrektur manuell möglich (Inventur, Schwund)
- Übersicht: welche Artikel sind unter Mindestbestand (Ampelsystem: grün / gelb / rot)

### 3.5 Lieferungsverwaltung
- Erfassen von Auslieferungen an Kunden: Datum, Artikel, Menge, **Verkaufspreis**
- Automatische Bestandsreduzierung im Lager
- Status: geplant / geliefert / storniert
- Freitextnotiz pro Lieferung

### 3.6 Prognose & Disposition

#### Lagerreichweite
- Berechnung des **durchschnittlichen Verbrauchs pro Artikel** (aus Lieferhistorie, konfigurierbar: letzte 30 / 60 / 90 Tage)
- **Reichweite in Tagen** = Aktueller Bestand ÷ Ø Tagesverbrauch (über alle Kunden)
- Anzeige: „Artikel X reicht noch ca. 14 Tage"

#### Bestellvorschlag
- Automatischer Vorschlag wenn: Lagerbestand < Mindestbestand **oder** Reichweite < konfigurierbarer Schwellwert (z.B. < 21 Tage)
- Bestellmenge = (Ø Tagesverbrauch × Zielhorizont in Tagen) – aktueller Bestand
- Vorschlag gruppiert nach Lieferant mit Mindestbestellmenge
- Manuelle Anpassung vor Export möglich

#### Kundenbedarfsplanung
- Regelmäßiger Bedarf pro Kunde pro Artikel (z.B. 500 kg Rinderfutter alle 14 Tage)
- Prognose: Nächste fällige Lieferungen in den kommenden X Tagen

### 3.7 Preismanagement & Margen

#### Preishierarchie (von oben nach unten)
1. **Kundenspezifischer Preis** (höchste Priorität)
2. **Kundengruppenpreis** (z.B. Großkunde, Stammkunde)
3. **Standardverkaufspreis** des Artikels

#### Margenberechnung
- Marge (€) = Verkaufspreis – Einkaufspreis
- Marge (%) = (Marge € / Verkaufspreis) × 100
- Anzeige in: Artikelübersicht, Lieferungserfassung, Kundendetail
- **Margenwarnung** wenn Kundenpreis unter definierten Mindestmarge fällt

#### Margenberichte
- Marge pro Kunde (Zeitraum wählbar)
- Marge pro Artikel
- Marge pro Lieferant (Einkaufspreisvergleich)
- Gesamtübersicht Deckungsbeitrag

---

## 4. Datenschema

```
Kunde
  ├── Stammdaten (Name, Adresse, Kategorie, ...)
  ├── KundeBedarf (→ Artikel, Menge, Intervall)
  ├── KundeArtikelPreis (→ Artikel, Sonderpreis)
  └── Lieferungen

Artikel
  ├── Kategorie, Einheit, Standardpreis
  ├── Lagerbestand (aktuell, Mindestbestand)
  ├── ArtikelLieferant (→ Lieferant, Einkaufspreis, Min-Menge)
  └── Lagerbewegungen (Eingang / Ausgang / Korrektur)

Lieferant
  └── ArtikelLieferant (Preis, Lieferzeit, Min-Menge)

Lieferung
  ├── Datum, Kunde, Status, Notiz
  └── Lieferpositionen (→ Artikel, Menge, Verkaufspreis)

Lagerbewegung
  ├── Typ: Wareneingang | Auslieferung | Korrektur
  ├── Datum, Artikel, Menge (+/-)
  └── Referenz (→ Lieferung oder Wareneingang)
```

---

## 5. Exportfunktionen

| Export | Format | Inhalt |
|---|---|---|
| Kundenliste | CSV / XLSX | Alle Kundenstammdaten |
| Lieferhistorie | CSV / XLSX | Alle Lieferungen, filterbar nach Zeitraum & Kunde |
| Artikelliste | CSV / XLSX | Alle Artikel inkl. Lieferant & Preise |
| Bestellvorschlag | PDF / XLSX | Artikel gruppiert nach Lieferant, Bestellmengen |
| Kundenbedarf | PDF | Pro Kunde: Artikel + Lieferhistorie |
| Lagerübersicht | CSV / XLSX | Bestand, Mindestbestand, Reichweite, Status |
| Margenbericht | XLSX | Marge pro Kunde / Artikel / Zeitraum |
| Lagerbewegungen | CSV / XLSX | Alle Eingänge und Ausgänge im Zeitraum |

---

## 6. Technischer Stack

| Schicht | Technologie |
|---|---|
| Frontend | Next.js 14 (App Router), TailwindCSS, shadcn/ui |
| Backend | Next.js API Routes (Full-Stack) |
| Datenbank | SQLite via Prisma ORM |
| Exporte | xlsx (Excel), jsPDF (PDF) |
| Auth | NextAuth.js (Username + Passwort) |
| Deployment | Lokal (Node.js) oder einfacher VPS |

---

## 7. MVP-Umfang (Phase 1)

1. Kunden-CRUD
2. Artikel-CRUD mit Lieferantenzuordnung & Preisen
3. Lieferanten-CRUD
4. Lagerverwaltung (Bestand, Mindestbestand, Wareneingänge)
5. Lieferungserfassung mit automatischer Bestandsreduzierung
6. Prognose: Reichweite & Bestellvorschlag
7. Preismanagement (Standard + kundenspezifisch) & Margenanzeige
8. Exporte: CSV/XLSX für alle Kernbereiche

## Phase 2

- Margenbericht als PDF
- Dashboard mit KPIs (Umsatz, Top-Kunden, Lageralarm-Übersicht)
- Benutzerrollen (Admin / Disponent / Außendienst)
- E-Mail-Benachrichtigung bei Lagerunterschreitung
