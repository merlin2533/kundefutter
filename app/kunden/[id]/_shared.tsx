"use client";

// Gemeinsame Typen, Konstanten und Helfer für die Kundendetailseite und ihre Tabs.

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface KundeKontakt {
  id: number;
  kundeId: number;
  typ: string;
  wert: string;
  label?: string;
  vorname?: string;
  nachname?: string;
}

export interface Artikel {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
  standardpreis: number;
}

export interface KundeBedarf {
  id: number;
  artikelId: number;
  menge: number;
  intervallTage: number;
  notiz?: string;
  aktiv: boolean;
  artikel: Artikel;
}

export interface KundeArtikelPreis {
  id: number;
  artikelId: number;
  preis: number;
  rabatt: number;
  artikel: Artikel;
}

export interface Lieferposition {
  id: number;
  menge: number;
  verkaufspreis: number;
  artikel: Artikel;
}

export interface Lieferung {
  id: number;
  datum: string;
  status: string;
  notiz?: string;
  rechnungNr?: string | null;
  rechnungDatum?: string | null;
  bezahltAm?: string | null;
  zahlungsziel?: number | null;
  sammelrechnungId?: number | null;
  positionen: Lieferposition[];
}

export interface Kunde {
  id: number;
  name: string;
  firma?: string;
  kategorie: string;
  verantwortlicher?: string;
  strasse?: string;
  plz?: string;
  ort?: string;
  land: string;
  lat?: number;
  lng?: number;
  notizen?: string;
  tags?: string;
  ustIdNr?: string;
  kreditlimit?: number | null;
  sachkundeNr?: string | null;
  sachkundeGueltigBis?: string | null;
  vvvoNr?: string | null;
  aktiv: boolean;
  createdAt: string;
  updatedAt: string;
  kontakte: KundeKontakt[];
  bedarfe: KundeBedarf[];
  artikelPreise: KundeArtikelPreis[];
  lieferungen: Lieferung[];
}

export interface KundeNotiz {
  id: number;
  kundeId: number;
  text: string;
  thema?: string | null;
  erstellt: string;
}

export interface KundeSchlag {
  id: number;
  kundeId: number;
  name: string;
  flaeche: number;
  fruchtart?: string | null;
  sorte?: string | null;
  vorfrucht?: string | null;
  aussaatJahr?: number | null;
  aussaatMenge?: number | null;
  notiz?: string | null;
  erstellt: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

export const KATEGORIEN = ["Landwirt", "Pferdehof", "Kleintierhalter", "Großhändler", "Sonstige"];

export const TABS = ["Stammdaten", "Lieferhistorie", "CRM", "Angebote", "Aufgaben", "Bedarfe", "Sonderpreise", "Statistik", "Reklamationen", "Schlagkartei", "Düngebedarf", "Albrecht", "Tiere", "Agrarantrag", "Zertifizierungen", "Sachkundenachweise", "Dokumente", "Vorgangskette", "Erklärungen"] as const;
export type Tab = (typeof TABS)[number];

export const DIREKT_TABS: Tab[] = ["Stammdaten", "Lieferhistorie", "CRM", "Angebote", "Aufgaben"];

export const TAB_GRUPPEN: { label: string; icon: string; tabs: Tab[] }[] = [
  { label: "Vertrieb", icon: "📊", tabs: ["Bedarfe", "Sonderpreise", "Statistik", "Vorgangskette", "Reklamationen"] },
  { label: "Agrar",    icon: "🌾", tabs: ["Schlagkartei", "Düngebedarf", "Albrecht", "Tiere", "Agrarantrag"] },
  { label: "Mehr",     icon: "⋯",  tabs: ["Zertifizierungen", "Sachkundenachweise", "Dokumente", "Erklärungen"] },
];

export const inputClsSchlag =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

export const ANGEBOT_STATUS_LABELS: Record<string, string> = {
  OFFEN: "Offen",
  ANGENOMMEN: "Angenommen",
  ABGELEHNT: "Abgelehnt",
  ABGELAUFEN: "Abgelaufen",
};

export const ANGEBOT_STATUS_FARBEN: Record<string, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  ANGENOMMEN: "bg-green-100 text-green-800",
  ABGELEHNT: "bg-red-100 text-red-800",
  ABGELAUFEN: "bg-gray-100 text-gray-600",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function kontaktIcon(typ: string) {
  if (typ === "email") return "📧";
  if (typ === "fax") return "📠";
  return "📞";
}

export function statusBadge(status: string) {
  const map: Record<string, string> = {
    geplant: "bg-yellow-100 text-yellow-800",
    geliefert: "bg-green-100 text-green-800",
    storniert: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}>
      {status}
    </span>
  );
}

export function lieferungTotal(l: Lieferung) {
  return l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
}

// ─── Shared components ───────────────────────────────────────────────────────

export function Field({
  label,
  value,
  onChange,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
    </div>
  );
}

export function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className="text-sm text-gray-800 mt-0.5">{value || <span className="text-gray-400">—</span>}</p>
    </div>
  );
}

interface NaechsterBesuchItem {
  id: number;
  datum: string;
  betreff: string;
  inhalt: string | null;
}

export function NaechsterBesuchInfo({ kundeId }: { kundeId: number }) {
  const [besuche, setBesuche] = useState<NaechsterBesuchItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/besuchstermine?kundeId=${kundeId}`)
      .then((r) => r.json())
      .then((d) => setBesuche(Array.isArray(d) ? d : []))
      .finally(() => setLoading(false));
  }, [kundeId]);

  if (loading) return null;
  if (besuche.length === 0) return null;

  const naechster = besuche[0];
  return (
    <div className="mt-2 p-3 rounded-xl border border-blue-200 bg-blue-50">
      <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-1">Nächster Besuch</p>
      <p className="text-sm font-medium text-blue-900">
        {new Date(naechster.datum).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" })}
        {" — "}
        {naechster.betreff}
      </p>
      {naechster.inhalt && <p className="text-xs text-blue-600 mt-0.5">{naechster.inhalt}</p>}
      {besuche.length > 1 && (
        <p className="text-xs text-blue-500 mt-1">+{besuche.length - 1} weitere geplante Besuche</p>
      )}
    </div>
  );
}

export function KategorieBadge({ kategorie }: { kategorie: string }) {
  const styles: Record<string, string> = {
    Landwirt: "bg-green-100 text-green-800",
    Pferdehof: "bg-blue-100 text-blue-800",
    Kleintierhalter: "bg-orange-100 text-orange-800",
    Großhändler: "bg-purple-100 text-purple-800",
    Sonstige: "bg-gray-100 text-gray-700",
  };
  const cls = styles[kategorie] ?? "bg-gray-100 text-gray-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cls}`}>
      {kategorie}
    </span>
  );
}
