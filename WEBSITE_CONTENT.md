# AgrarOffice – Website-Inhalt

Dieses Dokument enthält den strukturierten Inhalt für die Produktwebsite von AgrarOffice Röthemeier.

---

## Hero-Bereich (Startseite)

**Headline:**
> AgrarOffice — Die Warenwirtschaft für den modernen Landhandel

**Subheadline:**
> Kunden, Artikel, Lieferungen und Rechnungen — alles in einer Anwendung. Einfach, schnell, browserbasiert.

**Call-to-Action:**
- [Demo anfordern] [Mehr erfahren]

---

## Kernaussagen (3er-Block)

### Alles im Blick
Ob offene Lieferungen, Kundenbedarfe oder Lagerbestand — das Dashboard zeigt die wichtigsten Kennzahlen auf einen Blick. Kein Datenchaos, kein Papierstapel.

### Direkt im Browser
Kein Installation, kein Client. AgrarOffice läuft vollständig im Webbrowser — auf dem PC im Büro, dem Tablet beim Kunden oder dem Smartphone im Außendienst.

### Gemacht für den Landhandel
Futter, Dünger, Saatgut, Analysen: AgrarOffice kennt die Besonderheiten des Agrarhandels. Chargenrückverfolgung, Schlagkartei, AFIG-Agraranträge und Marktpreise sind Standard.

---

## Funktionen

### Kundenverwaltung & CRM

**Alle Kundendaten am selben Ort**
Stammdaten, Ansprechpartner, Lieferhistorie, Bedarfspläne und Preisvereinbarungen in einer übersichtlichen Kundenakte. Inklusive Kartenansicht mit allen Kunden-Standorten.

**Aktive Kundenbetreuung**
Verpasste Kontakte werden automatisch erkannt. Die Telefonmaske zeigt beim Eingang eines Anrufs sofort die relevanten Kundeninformationen: letzte Lieferung, offene Beträge und laufende Bedarfe.

**Schlagkartei**
Erfassen Sie Anbaudaten je Kunde und Schlag: Fruchtart, Sorte, Vorfrucht, Fläche und Aussaatjahr — für eine fundierte Beratung vor Ort.

**AFIG-Agraranträge**
Import und Auswertung der öffentlichen Förderdaten aus agrarzahlungen.de. Verknüpfbar mit Kundenstamm für die Bedarfsplanung.

---

### Artikel & Lagerverwaltung

**Strukturierter Artikelstamm**
Kategorien (Futter, Dünger, Saatgut, Analysen, Beratung, Pflege) und Unterkategorien frei konfigurierbar. Jeder Artikel mit Artikelnummer, VK, EK, Lagerort, Einheit und MwSt-Satz.

**Lagerampel**
Bestandsanzeige mit dreistufiger Ampel: grün (auf Lager), gelb (unter Mindestbestand), rot (kein Lager). Sofort sichtbar bei Lieferungserfassung.

**Chargenrückverfolgung**
Losnummern je Lieferposition ermöglichen die vollständige Rückverfolgung — von der Lieferung zurück zum Wareneingang.

**Inhaltsstoffe**
Strukturierte Erfassung von Wirkstoffzusammensetzungen mit optionaler KI-gestützter Recherche.

---

### Angebote & Lieferungen

**Angebote in Minuten**
Angebote mit automatischer Nummernvergabe (AN-YYYY-NNNN), Gültigkeitsdatum und Positionsrabatt. Per Klick in eine Lieferung umwandeln.

**Lieferschein & Rechnung per Klick**
Jede Lieferung erzeugt einen druckbaren Lieferschein (ohne Preise, mit Unterschriftsfeld) und eine Rechnung (mit MwSt-Aufteilung und Bankdaten). Kategorie-Präfix bei Positionen sorgt für klare Zuordnung.

**Marge & Deckungsbeitrag**
EK-Preise fließen automatisch ein — die Marge je Lieferung und Position ist sofort sichtbar.

---

### Rechnungswesen

**Sammelrechnungen**
Mehrere Lieferungen eines Kunden zu einer Sammelrechnung zusammenfassen — mit einem Klick.

**Mahnwesen**
Überfälligkeitsliste aller offenen Rechnungen mit Anzahl Tage seit Fälligkeit. Zahlungseingang mit Datum hinterlegen.

**Massenexport**
Rechnungen oder Lieferscheine als ZIP-Archiv exportieren — gefiltert nach Zeitraum, Kunde oder Nummernkreis.

---

### Tourenplanung

**Tagesansicht für den Außendienst**
Alle geplanten Lieferungen des Tages sortiert nach PLZ — mit Routenberechnung (Kilometer und Fahrtzeit) via OpenStreetMap-Routing.

**Tour-PDF**
Ausdruckbare Tourenliste für den Fahrer, konfigurierbare Tour-Namen.

---

### KI-Unterstützung

**Lieferschein-Erkennung per Foto**
Eingehende Lieferscheine einfach fotografieren — AgrarOffice erkennt Artikel, Mengen und Lieferant automatisch.

**CRM-Notizen aus dem Gespräch**
Gesprächsnotizen direkt nach dem Kundenbesuch per Foto oder Spracheingabe erfassen. Die KI strukturiert den Inhalt automatisch.

**Modell frei wählbar**
Nutzen Sie OpenAI (GPT-4o, GPT-4.1) oder Anthropic (Claude Sonnet, Haiku, Opus) — mit eigenem API-Key, ohne Datenweitergabe.

---

### Marktpreise

Aktuelle Eurostat-Preisindizes für Agrarrohstoffe (Dünger, Getreide, Treibstoff, Milch) direkt in der Anwendung — als Grundlage für Preisverhandlungen.

---

## Für wen ist AgrarOffice?

| Zielgruppe | Nutzen |
|---|---|
| **Landhandelsunternehmen** | Vollständige Warenwirtschaft ohne Medienbruch |
| **Außendienstmitarbeiter** | Mobile Kundenakte, Telefonmaske, Tagesansicht |
| **Lagerleiter** | Bestandsführung, Wareneingänge, Mindestbestands-Alerts |
| **Buchhaltung** | Rechnungen, Sammelrechnungen, Zahlungsstatus, Export |
| **Geschäftsführung** | Dashboard mit KPIs, Umsatz, Margenübersicht |

---

## Technische Details

- **Browserbasiert** — läuft auf jedem modernen Gerät ohne Installation
- **Self-hosted** — Ihre Daten bleiben auf Ihrem Server (Docker-Container)
- **SQLite-Datenbank** — einfaches Backup, kein Datenbankserver nötig
- **PWA** — installierbar auf Mobile und Desktop, Offline-fähig
- **Open Source** — transparenter Quellcode, keine Vendor-Lock-in

---

## Häufige Fragen (FAQ)

**Wo werden meine Daten gespeichert?**
AgrarOffice läuft auf Ihrem eigenen Server (on-premise oder Ihrem Webhosting). Daten verlassen Ihren Server nicht — es sei denn, Sie aktivieren freiwillig die KI-Funktion mit eigenem API-Key.

**Kann ich die Software auf dem Smartphone nutzen?**
Ja. AgrarOffice ist als Progressive Web App (PWA) ausgelegt und lässt sich auf Android und iOS wie eine native App installieren.

**Wie werden Updates eingespielt?**
Per Docker: Watchtower prüft regelmäßig auf neue Images und spielt Updates automatisch ein — ohne Datenverlust.

**Ist eine Schulung nötig?**
Die Oberfläche ist selbsterklärend und auf die Abläufe im Landhandel zugeschnitten. Eine kurze Einführung (1–2 Stunden) reicht für die meisten Nutzer.

**Kann ich bestehende Artikel und Kunden importieren?**
Ja. Artikel und Kunden können per Excel/CSV importiert werden. Beim Artikelimport werden EK-Preise und bevorzugte Lieferanten automatisch übernommen.

---

## Kontakt / Impressum

*(Hier Kontaktdaten von Röthemeier eintragen)*
