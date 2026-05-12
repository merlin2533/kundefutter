"use client";

import Link from "next/link";

const PFLICHT_SPALTEN = [
  { spalte: "Name / Produktname / Artikel / Bezeichnung", pflicht: true, beschreibung: "Artikelname — mindestens eine dieser Varianten muss vorhanden sein" },
];

const OPTIONALE_SPALTEN = [
  { spalte: "Artikelnummer / ArtNr / SKU", pflicht: false, beschreibung: "Wird automatisch vergeben wenn leer (z. B. ART-00001)" },
  { spalte: "Standardpreis / VK (Standardpreis) / Verkaufspreis / Preis", pflicht: false, beschreibung: "Verkaufspreis netto in Euro (Komma oder Punkt als Dezimaltrennzeichen)" },
  { spalte: "Einkaufspreis / EK (Einkaufspreis) / EK-Preis / EK", pflicht: false, beschreibung: "Einkaufspreis netto in Euro — wird als Lieferanten-Einkaufspreis gespeichert" },
  { spalte: "Bevorzugter Lieferant / Lieferant / Lieferantenname / Hersteller", pflicht: false, beschreibung: "Name des Lieferanten — wird angelegt falls noch nicht vorhanden" },
  { spalte: "Kategorie / Artikelkategorie / Warengruppe", pflicht: false, beschreibung: "z. B. Futter, Duenger, Saatgut, Analysen, Beratung, Pflege (Standard: Futter)" },
  { spalte: "Unterkategorie / Subkategorie / Kultur", pflicht: false, beschreibung: "Unterkategorie, z. B. bei Saatgut: Mais, Raps, Weizen …" },
  { spalte: "Einheit / Mengeneinheit / ME", pflicht: false, beschreibung: "Mengeneinheit, z. B. kg, t, L, Stk (Standard: kg)" },
  { spalte: "MwSt % / MwSt / MwSt-Satz", pflicht: false, beschreibung: "Mehrwertsteuersatz: 0, 7 oder 19 (Standard: 19)" },
  { spalte: "Lagerbestand / Bestand", pflicht: false, beschreibung: "Anfangsbestand beim Import" },
  { spalte: "Mindestbestand / Meldebestand", pflicht: false, beschreibung: "Lager-Alarm wenn Bestand darunter fällt" },
  { spalte: "Verpackungsgröße / Gebinde / Liefergröße", pflicht: false, beschreibung: "Verpackungseinheit, z. B. '25 kg Sack'" },
  { spalte: "Beschreibung / Bemerkung / Notiz", pflicht: false, beschreibung: "Freitext-Beschreibung des Artikels" },
  { spalte: "Aktiv / Active", pflicht: false, beschreibung: "Artikel aktiv: ja/true/1 (Standard) oder nein/false/0 für inaktiv" },
];

const HAEUFIGE_FEHLER = [
  {
    fehler: "Lieferant und Einkaufspreis gehen verloren",
    ursache: "Die Spalte heißt im Export \"Bevorzugter Lieferant\" statt \"Lieferant\"",
    loesung: "Beide Varianten werden erkannt: \"Lieferant\" UND \"Bevorzugter Lieferant\" — einfach die Spalte so lassen wie sie ist.",
  },
  {
    fehler: "Alle Zeilen werden übersprungen",
    ursache: "Keine Spalte mit Artikelname erkannt",
    loesung: "Stelle sicher, dass eine Spalte \"Name\", \"Produktname\", \"Artikel\" oder \"Bezeichnung\" heißt.",
  },
  {
    fehler: "Preise werden als 0 importiert",
    ursache: "Dezimaltrennzeichen nicht erkannt",
    loesung: "Sowohl Punkt (1.23) als auch Komma (1,23) werden erkannt. Tausendertrennzeichen (1.234,56 oder 1,234.56) ebenfalls.",
  },
  {
    fehler: "Duplikat-Artikel werden doppelt angelegt",
    ursache: "Dieses Problem ist behoben — der Import prüft auf gleichen Namen",
    loesung: "Artikel mit identischem Namen werden NICHT neu angelegt, sondern aktualisiert (Preis + Lieferant). Ein klarer Hinweis im Import-Ergebnis zeigt wie viele aktualisiert wurden.",
  },
  {
    fehler: "Artikelnummern doppelt vergeben",
    ursache: "Früher: Race Condition bei gleichzeitigen Importen. Jetzt behoben.",
    loesung: "Die Vergabe erfolgt atomisch innerhalb einer Datenbank-Transaktion.",
  },
  {
    fehler: "MwSt falsch",
    ursache: "Ungültiger Wert (z. B. 20 statt 19)",
    loesung: "Nur 0, 7 und 19 sind gültige Werte. Alle anderen Werte werden auf 19 % gesetzt.",
  },
  {
    fehler: "Excel-Datei wird nicht erkannt",
    ursache: ".ods oder anderes Format",
    loesung: "Nur .xlsx, .xls und .csv werden unterstützt. .ods in LibreOffice als .xlsx speichern.",
  },
];

const BEISPIEL_CSV = `Name,Artikelnummer,Standardpreis,Einkaufspreis,Bevorzugter Lieferant,Kategorie,Einheit,MwSt %,Mindestbestand,Beschreibung
Marstall Struktur Performance,MAR-001,48.50,32.00,marstall GmbH,Futter,kg,7,500,Hochleistungsfutter für Milchkühe
BvG Kalkammonsalpeter 27,BVG-001,24.90,18.50,BvG Agrar GmbH,Duenger,kg,19,1000,KAS 27 % N
Mais KWS Ambrosini,SAA-001,185.00,145.00,KWS Saat SE,Saatgut,EH,7,50,Silomais Z-Saatgut
`;

function downloadBeispielCsv() {
  const blob = new Blob([BEISPIEL_CSV], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "artikel-import-vorlage.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function ImportHilfePage() {
  return (
    <div className="max-w-4xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/hilfe" className="hover:text-green-700 transition-colors">Hilfe</Link>
        <span className="text-gray-300">/</span>
        <span className="text-gray-700 font-medium">Import-Anleitung</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Artikel-Import: Schritt-für-Schritt</h1>
      <p className="text-gray-500 text-sm mb-8">
        So importierst du Artikel aus CSV oder Excel, ohne Daten zu verlieren.
      </p>

      {/* Schritte */}
      <div className="grid gap-4 mb-10">
        {[
          {
            nr: 1,
            titel: "Datei vorbereiten",
            farbe: "bg-green-700",
            inhalt: (
              <>
                <p className="text-sm text-gray-600 mb-3">
                  Erstelle eine CSV- oder Excel-Datei (.xlsx). Die erste Zeile muss die Spaltenköpfe enthalten.
                  Groß-/Kleinschreibung und Sonderzeichen (Klammern, Bindestriche) werden ignoriert —
                  <strong> &ldquo;VK (Standardpreis)&rdquo;</strong> und <strong>&ldquo;vk-standardpreis&rdquo;</strong> werden gleich behandelt.
                </p>
                <button
                  onClick={downloadBeispielCsv}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-green-700 text-white rounded-lg text-sm font-medium hover:bg-green-800 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Beispiel-CSV herunterladen
                </button>
              </>
            ),
          },
          {
            nr: 2,
            titel: "Datei hochladen & Vorschau prüfen",
            farbe: "bg-blue-600",
            inhalt: (
              <p className="text-sm text-gray-600">
                Gehe zu <Link href="/artikel" className="text-green-700 underline hover:text-green-800">Artikelstamm</Link> und klicke auf &ldquo;Importieren&rdquo;.
                Bei CSV-Dateien erscheint eine <strong>Vorschau</strong> mit den ersten 5 Datenzeilen.
                Erkannte Spalten sind <span className="text-green-700 font-medium">grün</span> markiert,
                unbekannte <span className="text-gray-500 font-medium">grau</span>.
                Prüfe ob die richtigen Spalten erkannt wurden, bevor du auf &ldquo;Jetzt importieren&rdquo; klickst.
              </p>
            ),
          },
          {
            nr: 3,
            titel: "Ergebnis auswerten",
            farbe: "bg-amber-600",
            inhalt: (
              <p className="text-sm text-gray-600">
                Nach dem Import siehst du eine Zusammenfassung:
                wie viele Artikel <strong>neu angelegt</strong> wurden,
                wie viele <strong>aktualisiert</strong> (Duplikate — gleicher Name),
                wie viele <strong>Lieferanten-Verknüpfungen</strong> gesetzt wurden,
                und welche Zeilen übersprungen wurden (mit Fehlermeldung).
              </p>
            ),
          },
          {
            nr: 4,
            titel: "Preisliste aktualisieren",
            farbe: "bg-purple-600",
            inhalt: (
              <p className="text-sm text-gray-600">
                Für <strong>reine Einkaufspreisänderungen</strong> vom Lieferanten nutze den{" "}
                <Link href="/preislisten-import" className="text-green-700 underline hover:text-green-800">Preislisten-Import</Link>.
                Dort wählst du den Lieferanten aus, lädst seine Preisliste hoch,
                und siehst welche Preise sich geändert haben — mit alter und neuer Zahl und der Differenz.
                Du kannst einzelne Positionen abwählen, bevor du übernimmst.
              </p>
            ),
          },
        ].map((schritt) => (
          <div key={schritt.nr} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <div className={`${schritt.farbe} text-white px-4 py-2.5 flex items-center gap-3`}>
              <span className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center text-sm font-bold flex-shrink-0">
                {schritt.nr}
              </span>
              <span className="font-semibold">{schritt.titel}</span>
            </div>
            <div className="px-4 py-3">{schritt.inhalt}</div>
          </div>
        ))}
      </div>

      {/* Spalten-Tabelle */}
      <h2 className="text-lg font-bold mb-3">Erkannte Spalten</h2>
      <p className="text-sm text-gray-500 mb-4">
        Spaltennamen werden <strong>automatisch erkannt</strong> — Groß-/Kleinschreibung,
        Leerzeichen, Bindestriche und Klammern werden ignoriert.
        Die Reihenfolge der Varianten bestimmt die Priorität bei mehreren Treffern.
      </p>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-10">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 w-8"></th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700">Erkannte Spaltenname(n)</th>
              <th className="text-left px-4 py-3 font-semibold text-gray-700 hidden sm:table-cell">Beschreibung</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {[...PFLICHT_SPALTEN, ...OPTIONALE_SPALTEN].map((s, i) => (
              <tr key={i} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  {s.pflicht ? (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-xs font-bold" title="Pflichtfeld">!</span>
                  ) : (
                    <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-gray-100 text-gray-400 text-xs" title="Optional">o</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {s.spalte.split(" / ").map((v) => (
                      <code key={v} className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-700">{v}</code>
                    ))}
                  </div>
                  <div className="sm:hidden text-xs text-gray-500 mt-1">{s.beschreibung}</div>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs hidden sm:table-cell">{s.beschreibung}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500 flex items-center gap-3">
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-100 text-red-700 text-xs font-bold">!</span>
            Pflichtfeld
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-gray-100 text-gray-400 text-xs">o</span>
            Optional
          </span>
        </div>
      </div>

      {/* Duplikat-Verhalten */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-4 mb-10">
        <h3 className="font-semibold text-blue-800 mb-2">Was passiert bei Duplikaten?</h3>
        <ul className="text-sm text-blue-700 space-y-1.5">
          <li className="flex gap-2">
            <span className="text-blue-400 flex-shrink-0 mt-0.5">&#x2713;</span>
            <span>Artikel mit <strong>identischem Namen</strong> werden nicht doppelt angelegt.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 flex-shrink-0 mt-0.5">&#x2713;</span>
            <span>Stattdessen wird der <strong>Verkaufspreis aktualisiert</strong> (wenn eine Preis-Spalte vorhanden ist).</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 flex-shrink-0 mt-0.5">&#x2713;</span>
            <span>Die <strong>Lieferanten-Verknüpfung</strong> wird gesetzt oder der EK aktualisiert.</span>
          </li>
          <li className="flex gap-2">
            <span className="text-blue-400 flex-shrink-0 mt-0.5">&#x26a0;</span>
            <span>Andere Felder (Einheit, Kategorie, Beschreibung) werden bei Duplikaten <strong>nicht überschrieben</strong>.</span>
          </li>
        </ul>
      </div>

      {/* Häufige Fehler */}
      <h2 className="text-lg font-bold mb-3">Häufige Fehler & Lösungen</h2>
      <div className="space-y-3 mb-10">
        {HAEUFIGE_FEHLER.map((f, i) => (
          <details key={i} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            <summary className="px-4 py-3 cursor-pointer font-medium text-gray-800 hover:bg-gray-50 list-none flex items-center justify-between select-none">
              <span className="flex items-center gap-2">
                <span className="text-red-500 text-sm font-bold">&#x26a0;</span>
                {f.fehler}
              </span>
              <svg className="w-4 h-4 text-gray-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </summary>
            <div className="px-4 pb-4 pt-1 border-t border-gray-100">
              <p className="text-sm text-gray-500 mb-1.5"><strong>Ursache:</strong> {f.ursache}</p>
              <p className="text-sm text-green-700"><strong>Lösung:</strong> {f.loesung}</p>
            </div>
          </details>
        ))}
      </div>

      {/* Preislisten-Import Hinweis */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-4 mb-10">
        <h3 className="font-semibold text-amber-800 mb-2">Nur Einkaufspreise aktualisieren?</h3>
        <p className="text-sm text-amber-700 mb-3">
          Wenn du eine neue Lieferanten-Preisliste erhältst und nur die EK-Preise anpassen willst,
          nutze den <strong>Preislisten-Import</strong> — dort siehst du Preisänderungen übersichtlich
          und kannst einzelne Positionen auswählen.
        </p>
        <Link
          href="/preislisten-import"
          className="inline-flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
        >
          Zum Preislisten-Import
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Back link */}
      <div className="pt-4 border-t border-gray-200">
        <Link href="/hilfe" className="text-sm text-green-700 hover:text-green-800 hover:underline flex items-center gap-1">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Zurück zur Hilfe
        </Link>
      </div>
    </div>
  );
}
