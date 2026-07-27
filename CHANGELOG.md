# Changelog

Alle nennenswerten Änderungen an AGRI-Office werden in dieser Datei dokumentiert.

Das Format orientiert sich an [Keep a Changelog](https://keepachangelog.com/de/1.1.0/),
und das Projekt folgt der [Semantischen Versionierung](https://semver.org/lang/de/).

## [Unreleased]

### Geändert
- **GlitchTip-DSN fest im Image hinterlegt** – `lib/sentry-dsn.ts` ist die einzige Quelle
  der Wahrheit; jeder Container meldet Fehler ohne jede Konfiguration. Übersteuern per
  `SENTRY_DSN=<eigene-dsn>`, abschalten per `SENTRY_DSN=off`. Betrifft Server, Edge,
  Browser, `docker-entrypoint.sh`, den CI-Reporter und den Service Worker.
- **Zentraler Logger `lib/logger.ts`** – `log.debug/info/warn/error/fatal` als einziger
  Einstieg für Log- und Fehlerausgaben. `error`/`fatal` erzeugen Log **und** GlitchTip-Issue
  in einem Aufruf.
- **`console.*` erreicht jetzt GlitchTip** – `enableLogs` + `consoleLoggingIntegration`
  überführen alle vorhandenen `console.*`-Aufrufe in den GlitchTip-Log-Strom (als Logs,
  nicht als Issues), ohne dass Aufrufstellen angefasst werden mussten.
- **Fehlgeschlagene API-Aufrufe im Browser werden automatisch gemeldet** –
  `lib/fetch-reporter.ts` umhüllt `window.fetch` einmalig und deckt damit die stillen
  `if (!res.ok)`-Pfade und `.then()`-Ketten ohne `.catch()` ab, ohne 231 Dateien zu ändern.
- **Browser-Init auf `instrumentation-client.ts` migriert** – `sentry.client.config.ts` ist
  ab SDK 9 deprecated und griff unter Turbopack (Next-16-Standard für `next dev`) nicht mehr.
- **CSP-Verstöße gehen an GlitchTip** – `report-uri` in `next.config.ts` (bewusst ohne
  `report-to`, das GlitchTip nicht versteht und das Chromium `report-uri` ignorieren ließe).

### Behoben
- **`geo-server.js` meldete nichts** – der Produktions-Entrypoint (PID 1, startet Next.js als
  Kindprozess) hatte keinerlei Fehler-Reporting, inklusive zweier leerer `.on('error')`-Handler.
  Startabbrüche führten damit zu stillen Container-Crash-Loops.
- **`middleware.ts`-Crashes erreichten GlitchTip nie** – `autoInstrumentMiddleware` war
  deaktiviert; jetzt aktiv (abgelehnte Sessions bleiben weiterhin bewusst stumm).
- **Service Worker meldete Deploy-Fehler nicht** – fehlgeschlagenes Cache-Busting im
  `activate`-Handler (läuft bei jedem Deploy) und fehlgeschlagenes Cachen der Offline-Seite
  waren komplett unsichtbar.
- **`lib/audit.ts` ohne Fehlerbehandlung** – wird an über einem Dutzend Stellen als
  `void auditLog(...)` aufgerufen; ein DB-Fehler war nur eine kontextlose Unhandled Rejection.
- **Fehler-Toasts kollabierten in GlitchTip zu einem Issue** – generische Texte wie „Fehler
  beim Speichern" gruppierten über alle Seiten hinweg zusammen. Der aussagekräftige Issue
  kommt jetzt vom Server bzw. vom Fetch-Reporter (mit Pfad und Status).
- **Stille Ladefehler ohne Nutzer-Rückmeldung** – in Artikel-Detail, Aufgaben, CRM,
  Bestellungen und Bestellliste sah ein HTTP-Fehler wie „keine Daten vorhanden" aus.
- Toter `withSentry`-Wrapper entfernt (0 von 276 API-Routen nutzten ihn), fehlende
  `try/catch`-Blöcke in `/api/prognose/bestellvorschlag` und `/api/artikel/import/vorlage`
  ergänzt, `res.ok`-Prüfung vor `res.json()` beim Upstream-Aufruf nachgezogen.
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
