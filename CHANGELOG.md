# Changelog

Alle nennenswerten Änderungen an AGRI-Office werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und das Projekt folgt der [Semantischen Versionierung](https://semver.org/lang/de/).

## [Unreleased]

### Geändert
- **KI-Integration auf Mistral AI umgestellt** – OpenAI und Anthropic entfernt,
  alle KI-Funktionen laufen jetzt über einen zentralen Mistral-Service
  (`lib/ai.ts`). Dokumenterkennung (Bild/PDF) läuft einheitlich über das
  dedizierte Mistral-OCR-Modell (`mistral-ocr-latest`).
- **Neu: Diktieren via Mistral Voxtral** – echte Server-seitige
  Audio-Transkription (`POST /api/ki/transcribe`, Modell `voxtral-mini-latest`)
  ersetzt die bisherige rein client-seitige Browser-Spracherkennung in
  `/ki/crm` und `/ki/sprache`.
- **KI-Einstellungen vereinfacht** – nur noch ein API-Key (Mistral), alle
  12 Feature-Prompts sind jetzt in der Prompt-Verwaltung editierbar
  (zuvor nur 4 von 12).

## [1.0.0] – 2026-06-02

Erste öffentliche Version (Public Release) des Warenwirtschafts- und CRM-Systems
für den Landhandel.

### Hinzugefügt
- **Kundenverwaltung & CRM** – Stammdaten, Kontakte, Notizen, Aktivitäten,
  Bedarfsplanung, Sonderpreise, Kundenbewertung (RFM), Kundenkarte und Kundenmappe.
- **Artikel & Lager** – Artikelstamm mit Inhaltsstoffen, Chargenrückverfolgung,
  Wareneingänge, Lagerbewegungen, Inventur, Umbuchungen und Mengenrabatte.
- **Angebote, Lieferungen & Rechnungswesen** – Angebote (AN-YYYY-NNNN),
  Lieferscheine, Rechnungen, Sammelrechnungen, Gutschriften, Mahnwesen,
  Ausgabenbuch, Bankabgleich und DATEV-Export.
- **ZUGFeRD / Factur-X** – Eingebettete E-Rechnung als PDF/A inkl. GiroCode.
- **Einkauf** – Lieferantenbestellungen, Eingangsrechnungen, Bestellliste,
  Anlieferungen/Erzeugerabrechnung und Bestellvorschläge.
- **Pflanzenbau & Agrar** – Schlagkartei, Bodenproben, Düngebedarfsermittlung
  (DüV Anlage 4), Albrecht-Bodenanalyse, Anbauplanung, PSM-Ausbringung und
  DüV-Sperrfristen.
- **Tierhaltung** – Tierbestand je Kunde und Rationsberechnung mit XLS-Export.
- **Qualität & Compliance** – Sachkundenachweise, Zertifizierungen,
  Reklamationsmanagement, Kontrakte und Sprengstoffvorläufer-Erklärungen.
- **Marktdaten** – MATIF-Futures (Euronext), Eurostat-Preisindizes und
  Wetter-/Spritzfenster-Prognosen.
- **KI-Integration** – Beleg-/Lieferschein-Erkennung, Inhaltsstoff-Recherche,
  CRM-Erfassung und Churn-Analyse (OpenAI oder Anthropic, konfigurierbar).
- **Mehrbenutzerbetrieb** – JWT-Sessions, Rollen/Berechtigungsmatrix und
  AuditLog-Änderungshistorie.
- **E-Mail-Versand** – Rechnungen, Mahnungen und Angebote per SMTP oder Resend,
  inkl. Digest-Mails und Mail-Log.
- **Kunden-Portal & Fahrer-Cockpit** – Eigenständige Logins, QR-Lieferschein-Scan
  und Unterschrift auf dem Lieferschein.
- **PWA** – Offline-Support via Service Worker, installierbar auf Mobilgeräten.
- **Marketing-Website** unter `web/` (statisches HTML, SEO-optimiert).

### Geändert
- Druckseiten (Lieferschein/Rechnung) A4-optimiert; Download nur als PDF.
- Chargennummern werden auf Rechnungen ausgewiesen.
- Dashboard-Widgets nach Priorität und Handlungsbedarf sortiert.
- Resend-SDK auf v6 aktualisiert (User-Agent-Anforderung der API).

### Behoben
- Webpack-Build für Docker (Turbopack auf Alpine linux/x64 nicht unterstützt).
- Korrektes Rechnungsdatum statt Lieferdatum bei Überfälligkeitsprüfung.
- Transaktionssichere Vergabe von Angebots- und Artikelnummern.
- Konsistente Kunden-Suche (Limit + `firma`/`name`-Label) in allen Formularen.

### Lizenzen
- Übersicht der verwendeten Drittanbieter-Bibliotheken in
  [`THIRD-PARTY-LICENSES.md`](./THIRD-PARTY-LICENSES.md) ergänzt und
  unter **Einstellungen › System** im Produkt einsehbar.

[1.0.0]: https://github.com/merlin2533/kundefutter/releases/tag/v1.0.0
