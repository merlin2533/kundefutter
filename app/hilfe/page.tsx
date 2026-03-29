"use client";

import { useState } from "react";
import Link from "next/link";

interface Feature {
  text: string;
  anchor?: string;
}

interface Section {
  id: string;
  icon: string;
  title: string;
  color: string;
  features: Feature[];
  link?: string;
}

const sections: Section[] = [
  {
    id: "kundenverwaltung",
    icon: "👥",
    title: "Kundenverwaltung",
    color: "green",
    link: "/kunden",
    features: [
      { text: "Kundenstammdaten: Name, Firma, Adresse, Betriebsnummer, Fläche" },
      { text: "Geo-Koordinaten für Kartenansicht (automatisches Geocoding)" },
      { text: "Kontaktverwaltung: Telefon, Mobil, E-Mail, Fax (mehrere Ansprechpartner)" },
      { text: "Kundennotizen mit Kategorien: Wichtig, Info, Wettbewerber, Offener Punkt" },
      { text: "Kundenbewertung: Umsatz, Häufigkeit, Zahlungsmoral (ABC-Analyse)" },
      { text: "Kundenmappe: Druckansicht aller Kundendaten auf einen Blick" },
      { text: "Kunden-Import aus CSV/Excel (Massenimport)" },
      { text: "Kundenkarte: Leaflet-Karte aller Kunden mit Filterung" },
      { text: "Schlagkartei: Felder je Kunde mit Fläche, Fruchtart, Sorte, Vorfrucht" },
      { text: "Bedarfsplanung: Bedarfe aus Anbauplan ableiten" },
      { text: "Sonderpreise pro Kunde und Artikel" },
    ],
  },
  {
    id: "crm",
    icon: "📞",
    title: "CRM & Aufgaben",
    color: "blue",
    link: "/crm",
    features: [
      { text: "CRM-Aktivitäten erfassen: Anruf, Besuch, E-Mail, Notiz, Aufgabe" },
      { text: "Wiedervorlagen erstellen mit Fälligkeitsdatum" },
      { text: "Aufgaben/TODO mit Prioritäten (niedrig, normal, hoch, kritisch)" },
      { text: "Telefonmaske: schnelle Anruf-Suche nach Kunde, Ort oder Rufnummer" },
      { text: "Tagesansicht: Übersicht für Außendienst mit offenen Aufgaben und Touren" },
      { text: "Kein-Kontakt-Widget: Kunden ohne Kontakt in den letzten 30/60/90 Tagen" },
      { text: "Inline-CRM direkt aus der globalen Suche (Ctrl+K)" },
      { text: "Kalender-Tab in der CRM-Übersicht für Besuchsplanung" },
    ],
  },
  {
    id: "artikel",
    icon: "📦",
    title: "Artikel & Lager",
    color: "amber",
    link: "/artikel",
    features: [
      { text: "Artikelstamm mit Preisen, MwSt.-Satz (0%/7%/19%), Kategorien (Futter, Dünger, Saatgut)" },
      { text: "Lieferantenverwaltung mit Einkaufspreisen je Lieferant" },
      { text: "Lagerverwaltung mit Bestandsampel: rot (leer), gelb (unter Mindestbestand), grün (ok)" },
      { text: "Wareneingang buchen mit Chargen-Nummer" },
      { text: "Lagerbewegungen: vollständige Buchungshistorie" },
      { text: "Chargenrückverfolgung: Wo wurde welche Charge geliefert?" },
      { text: "Umbuchungen zwischen Lagerorten" },
      { text: "Inventur: Lagerbestand erfassen, Leerliste drucken, Differenzen buchen" },
      { text: "Preishistorie je Artikel" },
      { text: "Preiskalkulation mit Margen-Analyse" },
      { text: "Mengenrabatte (Staffelpreise) verwalten" },
    ],
  },
  {
    id: "lieferungen",
    icon: "🚚",
    title: "Lieferungen & Angebote",
    color: "purple",
    link: "/lieferungen",
    features: [
      { text: "Angebotserstellung mit automatischer Nummernvergabe (AN-YYYY-NNNN)" },
      { text: "Angebot direkt in Lieferung konvertieren" },
      { text: "Angebotsstatus: Offen, Angenommen, Abgelehnt, Abgelaufen" },
      { text: "Lieferungserstellung mit Artikel-Verfügbarkeitsampel" },
      { text: "Lieferschein drucken (ohne Preise, mit Unterschriftsfeld)" },
      { text: "Rechnung drucken (MwSt. gruppiert, IBAN/BIC)" },
      { text: "Angebots-Druck mit Firmenlogo" },
      { text: "Sonderpreise pro Kunde werden automatisch angewendet" },
      { text: "Lieferpositionen mit Chargen-Nummer" },
    ],
  },
  {
    id: "finanzen",
    icon: "💶",
    title: "Finanzen",
    color: "emerald",
    link: "/rechnungen",
    features: [
      { text: "Rechnungsverwaltung mit Zahlungsstatus" },
      { text: "Sammelrechnungen über mehrere Lieferungen" },
      { text: "Gutschriften: Reklamation, Retoure, Preiskorrektur" },
      { text: "Mahnwesen mit automatischen Mahnstufen" },
      { text: "DATEV-Export für Steuerberater" },
      { text: "Offene Beträge je Kunde in der Schnellübersicht" },
    ],
  },
  {
    id: "tourenplanung",
    icon: "🗺️",
    title: "Tourenplanung",
    color: "cyan",
    link: "/tourenplanung",
    features: [
      { text: "Tourenplanung mit interaktiver Kartenansicht (Leaflet)" },
      { text: "Routenoptimierung über OSRM" },
      { text: "Gespeicherte Tour-Namen verwalten" },
      { text: "Tour-PDF Export mit Kundenliste und Adressen" },
      { text: "Tagesansicht zeigt heutige Touren und offene Aufgaben" },
    ],
  },
  {
    id: "analyse",
    icon: "📊",
    title: "Analyse & Berichte",
    color: "indigo",
    link: "/statistik",
    features: [
      { text: "Dashboard mit KPIs: Umsatz, Lieferungen, offene Angebote, Lagerwert" },
      { text: "ABC-Kundenanalyse: Kunden nach Umsatz kategorisieren" },
      { text: "Deckungsbeitragsanalyse je Artikel und Kunde" },
      { text: "Saisonale Bedarfsprognose aus Vorjahreswerten" },
      { text: "Bestandsprognose mit automatischen Bestellvorschlägen" },
      { text: "Marktpreise in Echtzeit (Eurostat-Daten, Input- und Output-Preisindizes)" },
      { text: "Gebietsanalyse: Umsatz und Kunden nach Region" },
      { text: "Änderungshistorie (Audit-Log): Alle Stammdatenänderungen nachverfolgen" },
    ],
  },
  {
    id: "agrarantraege",
    icon: "🌾",
    title: "Agraranträge (AFIG)",
    color: "lime",
    link: "/agrarantraege",
    features: [
      { text: "Import von agrarzahlungen.de-Daten (CSV-Datei bis 250 MB, Streaming)" },
      { text: "Empfänger-Suche nach Name, Ort oder Betriebsnummer" },
      { text: "Verknüpfung mit Kundenstammdaten" },
      { text: "Anzeige der Agrar-Zahlungsdaten je Kunde im Kunden-Tab" },
      { text: "PDF-Export der AFIG-Daten je Kunde" },
    ],
  },
  {
    id: "schlagkartei",
    icon: "🌱",
    title: "Schlagkartei & Bedarfsplanung",
    color: "teal",
    link: "/kunden",
    features: [
      { text: "Schlagverwaltung je Kunde: Name, Fläche, Fruchtart, Sorte, Vorfrucht, Aussaatjahr" },
      { text: "Bedarfsableitung aus Anbauplan (Fläche × Aufwandmenge)" },
      { text: "Bedarfsbasierte Angebotserstellung direkt aus der Schlagkartei" },
      { text: "Mehrere Schläge pro Kunde, beliebig erweiterbar" },
    ],
  },
  {
    id: "weitere",
    icon: "⚙️",
    title: "Weitere Features",
    color: "gray",
    link: "/einstellungen",
    features: [
      { text: "Globale Suche mit Ctrl+K / Cmd+K: Kunden, Artikel, Lieferungen" },
      { text: "PWA-Unterstützung: App auf Smartphone installierbar, offline-fähig" },
      { text: "Google Drive Integration: Dokumente für Kunden und Artikel ablegen" },
      { text: "Mailverteiler: Kunden für E-Mail-Kampagnen segmentieren" },
      { text: "Breadcrumb-Navigation auf allen Seiten" },
      { text: "Responsive Design: optimiert für Desktop, Tablet und Smartphone" },
      { text: "Druckoptimierte Seiten: Lieferschein, Rechnung, Angebot, Kundenmappe" },
      { text: "Preisauskunft: schnelle Auskunft über Preise inkl. Sonderpreise" },
    ],
  },
];

const colorMap: Record<string, { badge: string; header: string; icon: string; border: string }> = {
  green:   { badge: "bg-green-100 text-green-800",   header: "bg-green-50 border-green-200",   icon: "text-green-600",   border: "border-green-200 hover:border-green-400" },
  blue:    { badge: "bg-blue-100 text-blue-800",     header: "bg-blue-50 border-blue-200",     icon: "text-blue-600",    border: "border-blue-200 hover:border-blue-400" },
  amber:   { badge: "bg-amber-100 text-amber-800",   header: "bg-amber-50 border-amber-200",   icon: "text-amber-600",   border: "border-amber-200 hover:border-amber-400" },
  purple:  { badge: "bg-purple-100 text-purple-800", header: "bg-purple-50 border-purple-200", icon: "text-purple-600",  border: "border-purple-200 hover:border-purple-400" },
  emerald: { badge: "bg-emerald-100 text-emerald-800", header: "bg-emerald-50 border-emerald-200", icon: "text-emerald-600", border: "border-emerald-200 hover:border-emerald-400" },
  cyan:    { badge: "bg-cyan-100 text-cyan-800",     header: "bg-cyan-50 border-cyan-200",     icon: "text-cyan-600",    border: "border-cyan-200 hover:border-cyan-400" },
  indigo:  { badge: "bg-indigo-100 text-indigo-800", header: "bg-indigo-50 border-indigo-200", icon: "text-indigo-600",  border: "border-indigo-200 hover:border-indigo-400" },
  lime:    { badge: "bg-lime-100 text-lime-800",     header: "bg-lime-50 border-lime-200",     icon: "text-lime-600",    border: "border-lime-200 hover:border-lime-400" },
  teal:    { badge: "bg-teal-100 text-teal-800",     header: "bg-teal-50 border-teal-200",     icon: "text-teal-600",    border: "border-teal-200 hover:border-teal-400" },
  gray:    { badge: "bg-gray-100 text-gray-800",     header: "bg-gray-50 border-gray-200",     icon: "text-gray-600",    border: "border-gray-200 hover:border-gray-400" },
};

function SectionCard({ section, defaultOpen }: { section: Section; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const c = colorMap[section.color] ?? colorMap.gray;

  return (
    <div id={section.id} className={`border rounded-xl overflow-hidden transition-shadow hover:shadow-md ${c.border}`}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between p-5 text-left transition-colors ${c.header}`}
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="text-2xl">{section.icon}</span>
          <div>
            <h2 className="font-semibold text-gray-800 text-base">{section.title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{section.features.length} Features</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {section.link && (
            <Link
              href={section.link}
              onClick={(e) => e.stopPropagation()}
              className={`hidden sm:inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${c.badge} hover:opacity-80 transition-opacity`}
            >
              Zur Seite
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          )}
          <svg
            className={`w-5 h-5 text-gray-500 transition-transform flex-shrink-0 ${open ? "rotate-180" : ""}`}
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-5 py-4 bg-white border-t border-gray-100">
          <ul className="space-y-2">
            {section.features.map((f, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <svg className={`w-4 h-4 mt-0.5 flex-shrink-0 ${c.icon}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{f.text}</span>
              </li>
            ))}
          </ul>
          {section.link && (
            <div className="mt-4 pt-4 border-t border-gray-100 sm:hidden">
              <Link
                href={section.link}
                className={`inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg font-medium ${c.badge}`}
              >
                Zur Seite
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function HilfePage() {
  const [search, setSearch] = useState("");
  const [expandAll, setExpandAll] = useState(false);

  const query = search.trim().toLowerCase();

  const filtered = query
    ? sections
        .map((s) => ({
          ...s,
          features: s.features.filter((f) => f.text.toLowerCase().includes(query)),
        }))
        .filter((s) => s.features.length > 0 || s.title.toLowerCase().includes(query))
    : sections;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Hilfe & Features</h1>
        </div>
        <p className="text-gray-500 text-sm ml-13">
          Alle Funktionen von AgrarOffice Röthemeier auf einen Blick. Klicken Sie auf einen Bereich, um die Details anzuzeigen.
        </p>
      </div>

      {/* Schnellnavigation */}
      <div className="mb-6 flex flex-wrap gap-2">
        {sections.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full bg-gray-100 hover:bg-green-100 hover:text-green-800 text-gray-700 transition-colors font-medium"
          >
            <span>{s.icon}</span>
            <span>{s.title}</span>
          </a>
        ))}
      </div>

      {/* Suchfeld + Alle auf-/zuklappen */}
      <div className="flex flex-wrap gap-3 mb-6 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Features durchsuchen…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Suche zurücksetzen"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        {!query && (
          <button
            onClick={() => setExpandAll((v) => !v)}
            className="text-sm text-gray-600 hover:text-green-700 font-medium whitespace-nowrap flex items-center gap-1"
          >
            <svg className={`w-4 h-4 transition-transform ${expandAll ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
            </svg>
            {expandAll ? "Alle zuklappen" : "Alle aufklappen"}
          </button>
        )}
      </div>

      {/* Keine Ergebnisse */}
      {filtered.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <svg className="w-12 h-12 mx-auto mb-4 opacity-40" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <p className="text-lg font-medium">Keine Features gefunden</p>
          <p className="text-sm mt-1">Versuchen Sie einen anderen Suchbegriff.</p>
        </div>
      )}

      {/* Bereichs-Kacheln */}
      <div className="space-y-3">
        {filtered.map((section) => (
          <SectionCard
            key={section.id}
            section={section}
            defaultOpen={!!query || expandAll}
          />
        ))}
      </div>

      {/* Footer-Hinweis */}
      <div className="mt-10 p-4 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="font-medium">Tipp: Globale Suche</p>
            <p className="mt-0.5 text-green-700">
              Mit <kbd className="px-1.5 py-0.5 bg-white border border-green-300 rounded text-xs font-mono">Ctrl+K</kbd> (Windows/Linux) oder{" "}
              <kbd className="px-1.5 py-0.5 bg-white border border-green-300 rounded text-xs font-mono">Cmd+K</kbd> (Mac) öffnen Sie jederzeit die globale Suche, um schnell Kunden, Artikel oder Lieferungen zu finden.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
