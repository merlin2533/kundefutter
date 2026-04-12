"use client";
import { useEffect, useState } from "react";
import { KpiCard, Card } from "@/components/Card";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";
import SearchableSelect from "@/components/SearchableSelect";

interface MarktTrend {
  kategorie: string;
  aktuell: number;
  veraenderung: number;
}

interface Wiedervorlage {
  id: number;
  betreff: string;
  typ: string;
  faelligAm: string | null;
  kundeId: number | null;
  kundeName: string | null;
}

interface KeinKontaktKunde {
  id: number;
  name: string;
  firma: string | null;
  letzterKontakt: string | null;
}

interface FaelligeRechnung {
  id: number;
  rechnungNr: string | null;
  kundeId: number;
  kundeName: string;
  betrag: number;
  faelligAm: string;
  ueberfaelligTage: number;
}

interface LagerKritischArtikel {
  id: number;
  name: string;
  aktuellerBestand: number;
  mindestbestand: number;
  einheit: string;
  status: "rot" | "gelb";
}

interface TimelineEntry {
  id: string;
  zeitpunkt: string;
  typ: "crm" | "lieferung" | "angebot" | "aufgabe";
  icon: string;
  titel: string;
  kundeName?: string;
  kundeId?: number;
  link?: string;
}

interface MatifProdukt {
  symbol: string;
  produktCode: string;
  produktName: string;
  preis: number;
  vorwoche: number | null;
  veraenderung: number | null;
  datum: string;
  prognose1W: number | null;
  statPrognose: {
    mittelwert: number;
    sigma: number;
    band68Lo: number;
    band68Hi: number;
    horizonDatum: string;
  } | null;
}

interface MatifData {
  preise: MatifProdukt[];
  letzteAktualisierung: string;
  quelle: string;
}

interface DashboardData {
  kundenAktiv: number;
  offeneLieferungen: number;
  umsatzMonat: number;
  umsatzVormonat: number;
  deckungsbeitragMonat: number;
  deckungsbeitragVormonat: number;
  lagerAlarme: number;
  faelligNaechste14Tage: number;
  offeneRechnungen: number;
  ueberfaelligeRechnungen: number;
  faelligeRechnungen: FaelligeRechnung[];
  faelligeRechnungenSumme: number;
  wiederkehrendFaellig: number;
  topKunden: { kundeId: number; name: string; umsatz: number }[];
  markttrend: MarktTrend[];
  artikelAlarme: { id: number; name: string; aktuellerBestand: number; mindestbestand: number; einheit: string; status: string }[];
  lagerKritisch: LagerKritischArtikel[];
  wiedervorlagen: Wiedervorlage[];
  keinKontakt: KeinKontaktKunde[];
  letzteAktivitaeten: TimelineEntry[];
  lieferungenOhneRechnung: { id: number; datum: string; kundeId: number; kundeName: string; betrag: number; tageOhneRechnung: number }[];
  unzugeordneteUmsaetze?: number;
}

const SCHNELLZUGRIFF = [
  { href: "/lieferungen/neu", label: "Neue Lieferung", icon: "📦", color: "bg-green-50 border-green-200 hover:bg-green-100" },
  { href: "/lager/wareneingang", label: "Wareneingang", icon: "🚚", color: "bg-blue-50 border-blue-200 hover:bg-blue-100" },
  { href: "/kunden/neu", label: "Neuer Kunde", icon: "👤", color: "bg-purple-50 border-purple-200 hover:bg-purple-100" },
  { href: "/crm", label: "CRM Aktivität", icon: "💬", color: "bg-orange-50 border-orange-200 hover:bg-orange-100" },
  { href: "/tourenplanung", label: "Tourenplanung", icon: "🗺️", color: "bg-yellow-50 border-yellow-200 hover:bg-yellow-100" },
  { href: "/prognose", label: "Bestellvorschlag", icon: "📊", color: "bg-indigo-50 border-indigo-200 hover:bg-indigo-100" },
  { href: "/agrarantraege", label: "AFIG-Anträge", icon: "🌾", color: "bg-amber-50 border-amber-200 hover:bg-amber-100" },
  { href: "/marktpreise", label: "Marktpreise", icon: "📈", color: "bg-teal-50 border-teal-200 hover:bg-teal-100" },
];

const TYP_BADGE: Record<string, string> = {
  besuch: "bg-purple-100 text-purple-700",
  anruf: "bg-blue-100 text-blue-700",
  email: "bg-teal-100 text-teal-700",
  notiz: "bg-gray-100 text-gray-600",
  aufgabe: "bg-orange-100 text-orange-700",
};

const TYP_LABEL: Record<string, string> = {
  besuch: "Besuch",
  anruf: "Anruf",
  email: "E-Mail",
  notiz: "Notiz",
  aufgabe: "Aufgabe",
};

const TIMELINE_TYP_BADGE: Record<string, string> = {
  crm: "bg-blue-100 text-blue-700",
  lieferung: "bg-green-100 text-green-700",
  angebot: "bg-purple-100 text-purple-700",
  aufgabe: "bg-orange-100 text-orange-700",
};

const TIMELINE_TYP_LABEL: Record<string, string> = {
  crm: "CRM",
  lieferung: "Lieferung",
  angebot: "Angebot",
  aufgabe: "Aufgabe",
};

// ─── CRM Schnellerfassung Widget ─────────────────────────────────────────────

const CRM_DEFAULT = { kundeId: "", typ: "anruf", betreff: "", inhalt: "" };

function CrmSchnellWidget() {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(CRM_DEFAULT);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [kunden, setKunden] = useState<{ value: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/kunden?limit=200&aktiv=true")
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d)) {
          setKunden(d.map((k: { id: number; name: string; firma?: string | null }) => ({
            value: String(k.id),
            label: k.firma ? `${k.firma} (${k.name})` : k.name,
          })));
        }
      })
      .catch(() => {});
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.kundeId) { setError("Bitte einen Kunden wählen."); return; }
    if (!form.betreff.trim()) { setError("Betreff ist Pflichtfeld."); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/kunden/aktivitaeten", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kundeId: Number(form.kundeId), typ: form.typ, betreff: form.betreff.trim(), inhalt: form.inhalt.trim() || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setForm(CRM_DEFAULT);
      setSaved(true);
      setOpen(false);
      setTimeout(() => setSaved(false), 2000);
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error ?? "Fehler beim Speichern.");
    }
  }

  return (
    <div className="mb-5 bg-white border border-blue-200 rounded-xl overflow-hidden shadow-sm">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-blue-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-blue-600 font-medium text-sm">📞 CRM Schnellerfassung</span>
          {saved && <span className="text-xs text-green-600 font-medium">Gespeichert ✓</span>}
        </div>
        <span className="text-gray-400 text-xs">{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <form onSubmit={handleSave} className="border-t border-blue-100 px-4 py-3 space-y-3 bg-blue-50">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kunde</label>
              <SearchableSelect
                options={kunden}
                value={form.kundeId}
                onChange={(v) => setForm({ ...form, kundeId: v })}
                placeholder="Kunde suchen…"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Typ</label>
              <select
                value={form.typ}
                onChange={(e) => setForm({ ...form, typ: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="anruf">📞 Anruf</option>
                <option value="besuch">🏠 Besuch</option>
                <option value="email">✉️ E-Mail</option>
                <option value="notiz">📝 Notiz</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Betreff *</label>
              <input
                type="text"
                value={form.betreff}
                onChange={(e) => setForm({ ...form, betreff: e.target.value })}
                placeholder="z.B. Rückruf wegen Lieferung"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Notiz (optional)</label>
              <input
                type="text"
                value={form.inhalt}
                onChange={(e) => setForm({ ...form, inhalt: e.target.value })}
                placeholder="Kurze Zusammenfassung…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            {error && <p className="text-xs text-red-600 shrink-0">{error}</p>}
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60 shrink-0"
            >
              {saving ? "…" : "Speichern"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? "Guten Morgen" : hour < 17 ? "Guten Tag" : "Guten Abend";
}

function formatHeaderDate(): string {
  return new Date().toLocaleDateString("de-DE", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function zeitVorText(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 2) return "gerade eben";
  if (min < 60) return `vor ${min} Min.`;
  const h = Math.floor(min / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  if (d < 7) return `vor ${d} Tag${d > 1 ? "en" : ""}`;
  return new Date(iso).toLocaleDateString("de-DE");
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [matif, setMatif] = useState<MatifData | null>(null);

  const loadData = () => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((dashboard) => {
        setData(dashboard);
        setLastUpdated(new Date());
      })
      .catch(() => {});
  };

  const loadMatif = () => {
    fetch("/api/marktpreise/spot")
      .then((r) => r.json())
      .then((d) => { if (d.preise) setMatif(d); })
      .catch(() => {});
  };

  useEffect(() => {
    loadData();
    loadMatif();
    const interval = setInterval(loadData, 60_000);
    const matifInterval = setInterval(loadMatif, 6 * 60 * 60_000); // 6h
    return () => { clearInterval(interval); clearInterval(matifInterval); };
  }, []);

  if (!data) return <p className="text-gray-400 mt-8">Lade Dashboard…</p>;

  const marge =
    data.umsatzMonat > 0
      ? ((data.deckungsbeitragMonat / data.umsatzMonat) * 100).toFixed(1)
      : "0.0";

  const dbVormonat = data.deckungsbeitragVormonat ?? 0;
  const dbDiff =
    dbVormonat > 0
      ? ((data.deckungsbeitragMonat - dbVormonat) / dbVormonat) * 100
      : null;
  const dbPfeil = dbDiff === null ? "" : dbDiff > 0 ? "▲" : dbDiff < 0 ? "▼" : "●";
  const dbDiffColor =
    dbDiff === null ? "" : dbDiff > 0 ? "text-green-600" : dbDiff < 0 ? "text-red-600" : "text-gray-400";

  const umsatzDiff =
    data.umsatzVormonat > 0
      ? ((data.umsatzMonat - data.umsatzVormonat) / data.umsatzVormonat) * 100
      : null;

  const umsatzPfeil =
    umsatzDiff === null ? "" : umsatzDiff > 0 ? "▲" : umsatzDiff < 0 ? "▼" : "●";
  const umsatzDiffColor =
    umsatzDiff === null ? "" : umsatzDiff > 0 ? "text-green-600" : umsatzDiff < 0 ? "text-red-600" : "text-gray-400";

  const umsatzSub = umsatzDiff !== null
    ? `${umsatzPfeil} ${Math.abs(umsatzDiff).toFixed(1)} % vs. Vormonat (${formatEuro(data.umsatzVormonat)})`
    : `Vormonat: ${formatEuro(data.umsatzVormonat)}`;

  const maxUmsatz = data.topKunden.length > 0 ? data.topKunden[0].umsatz : 1;

  const lagerRotCount = (data.lagerKritisch ?? []).filter((a) => a.status === "rot").length;
  const lagerGelbCount = (data.lagerKritisch ?? []).filter((a) => a.status === "gelb").length;
  const lagerSub =
    data.lagerAlarme === 0
      ? "Alles im grünen Bereich"
      : `${lagerRotCount > 0 ? `${lagerRotCount} leer` : ""}${lagerRotCount > 0 && lagerGelbCount > 0 ? " · " : ""}${lagerGelbCount > 0 ? `${lagerGelbCount} gering` : ""}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2 mb-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
            {getGreeting()} —{" "}
            <span className="text-gray-500 font-normal">{formatHeaderDate()}</span>
          </h1>
        </div>
        {lastUpdated && (
          <button
            onClick={loadData}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors shrink-0"
            title="Klicken zum sofortigen Neu laden"
          >
            Aktualisiert:{" "}
            {lastUpdated.getHours().toString().padStart(2, "0")}:
            {lastUpdated.getMinutes().toString().padStart(2, "0")} Uhr
          </button>
        )}
      </div>

      {/* CRM Schnellerfassung + Lieferungen ohne Rechnung */}
      <CrmSchnellWidget />
      {(data.lieferungenOhneRechnung ?? []).length > 0 && (
        <div className="mb-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="text-orange-600 font-semibold text-sm">⚠ Lieferungen ohne Rechnung</span>
              <span className="bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{data.lieferungenOhneRechnung.length}</span>
            </div>
            <Link href="/lieferungen" className="text-xs text-orange-700 hover:underline font-medium">Alle anzeigen →</Link>
          </div>
          <div className="space-y-1.5">
            {data.lieferungenOhneRechnung.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between gap-3 bg-white rounded-lg border border-orange-100 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-gray-900 truncate block">{l.kundeName}</span>
                  <span className="text-xs text-orange-600">{l.tageOhneRechnung} Tag{l.tageOhneRechnung !== 1 ? "e" : ""} ohne Rechnung · {new Date(l.datum).toLocaleDateString("de-DE")}</span>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-bold text-gray-800">{formatEuro(l.betrag)}</span>
                  <Link href={`/lieferungen/${l.id}`} className="text-xs px-2 py-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg font-medium transition-colors">→</Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Obere Reihe: KPI-Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        {/* Umsatz mit Monatsvergleich */}
        <div>
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 border-green-500`}>
            <p className="text-sm text-gray-500">Umsatz (Monat)</p>
            <p className="text-2xl font-bold mt-1">{formatEuro(data.umsatzMonat)}</p>
            {umsatzDiff !== null ? (
              <p className={`text-xs mt-1 font-medium ${umsatzDiffColor}`}>
                {umsatzPfeil} {Math.abs(umsatzDiff).toFixed(1)} % vs. Vormonat
                <span className="text-gray-400 font-normal ml-1">({formatEuro(data.umsatzVormonat)})</span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">Vormonat: {formatEuro(data.umsatzVormonat)}</p>
            )}
          </div>
        </div>

        {/* Deckungsbeitrag */}
        <Link href="/analyse/deckungsbeitrag" className="block">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 border-emerald-500 h-full hover:shadow-md transition-shadow">
            <p className="text-sm text-gray-500">Deckungsbeitrag (Monat)</p>
            <p className="text-2xl font-bold mt-1">{formatEuro(data.deckungsbeitragMonat)}</p>
            {dbDiff !== null ? (
              <p className={`text-xs mt-1 font-medium ${dbDiffColor}`}>
                {dbPfeil} {Math.abs(dbDiff).toFixed(1)} % vs. Vormonat
                <span className="text-gray-400 font-normal ml-1">· {marge} % Marge</span>
              </p>
            ) : (
              <p className="text-xs text-gray-400 mt-1">{marge} % Marge</p>
            )}
          </div>
        </Link>

        {/* Offene Rechnungen */}
        <Link href="/lieferungen" className="block">
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 ${data.ueberfaelligeRechnungen > 0 ? "border-red-500" : "border-yellow-500"} h-full`}>
            <p className="text-sm text-gray-500">Offene Rechnungen</p>
            <p className="text-2xl font-bold mt-1">{formatEuro(data.faelligeRechnungenSumme)}</p>
            <p className={`text-xs mt-1 ${data.ueberfaelligeRechnungen > 0 ? "text-red-600 font-medium" : "text-gray-400"}`}>
              {data.offeneRechnungen} Rechnung{data.offeneRechnungen !== 1 ? "en" : ""}
              {data.ueberfaelligeRechnungen > 0 ? ` · ${data.ueberfaelligeRechnungen} überfällig` : ""}
            </p>
          </div>
        </Link>

        {/* Lager-Status */}
        <Link href="/lager" className="block">
          <div className={`bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 ${data.lagerAlarme === 0 ? "border-green-500" : lagerRotCount > 0 ? "border-red-500" : "border-yellow-500"} h-full`}>
            <p className="text-sm text-gray-500">Lager-Status</p>
            <p className="text-2xl font-bold mt-1">{data.lagerAlarme}</p>
            <p className={`text-xs mt-1 ${data.lagerAlarme === 0 ? "text-gray-400" : lagerRotCount > 0 ? "text-red-600 font-medium" : "text-yellow-600 font-medium"}`}>
              {lagerSub}
            </p>
          </div>
        </Link>

        {/* Aktive Kunden */}
        <KpiCard
          label="Aktive Kunden"
          value={data.kundenAktiv}
          sub={`${data.offeneLieferungen} offene Lieferung${data.offeneLieferungen !== 1 ? "en" : ""}`}
          color="blue"
        />

        {/* Offene Bankbuchungen — nur anzeigen wenn vorhanden */}
        {(data.unzugeordneteUmsaetze ?? 0) > 0 && (
          <Link href="/bankabgleich" className="block">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 border-l-4 border-amber-500 h-full hover:shadow-md transition-shadow">
              <p className="text-sm text-gray-500">Offene Bankbuchungen</p>
              <p className="text-2xl font-bold mt-1">{data.unzugeordneteUmsaetze}</p>
              <p className="text-xs text-amber-600 font-medium mt-1">Nicht zugeordnet → Bankabgleich</p>
            </div>
          </Link>
        )}
      </div>

      {/* Mittlere Reihe: Fällige Rechnungen + Lager-Ampel */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Fällige Rechnungen */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Fällige Rechnungen</h2>
              {data.ueberfaelligeRechnungen > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                  {data.ueberfaelligeRechnungen}
                </span>
              )}
            </div>
            <Link href="/lieferungen" className="text-xs text-green-700 hover:underline">
              Alle Rechnungen →
            </Link>
          </div>
          {data.faelligeRechnungen.length === 0 ? (
            <p className="text-sm text-gray-400">Keine offenen Rechnungen</p>
          ) : (
            <div className="space-y-2">
              {data.faelligeRechnungen.map((r) => {
                const isRotOverdue = r.ueberfaelligTage > 30;
                const isGelbOverdue = r.ueberfaelligTage > 14;
                const rowColor = isRotOverdue
                  ? "border-red-200 bg-red-50"
                  : isGelbOverdue
                  ? "border-yellow-200 bg-yellow-50"
                  : "border-gray-100";
                const tagText = r.ueberfaelligTage > 0
                  ? `${r.ueberfaelligTage} Tage überfällig`
                  : `fällig ${new Date(r.faelligAm).toLocaleDateString("de-DE")}`;
                const tagColor = isRotOverdue
                  ? "text-red-700 font-semibold"
                  : isGelbOverdue
                  ? "text-yellow-700 font-medium"
                  : "text-gray-500";
                return (
                  <Link
                    key={r.id}
                    href={`/kunden/${r.kundeId}`}
                    className={`flex items-center justify-between p-2 rounded-lg border transition-colors hover:opacity-90 ${rowColor}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-800 truncate">{r.kundeName}</p>
                      <p className={`text-xs ${tagColor}`}>{tagText}</p>
                    </div>
                    <div className="text-right shrink-0 ml-3">
                      <p className="text-sm font-bold text-gray-900">{formatEuro(r.betrag)}</p>
                      {r.rechnungNr && (
                        <p className="text-xs text-gray-400">{r.rechnungNr}</p>
                      )}
                    </div>
                  </Link>
                );
              })}
              <div className="pt-1 border-t border-gray-100 flex justify-between text-xs text-gray-500">
                <span>Gesamt offen</span>
                <span className="font-bold text-gray-800">{formatEuro(data.faelligeRechnungenSumme)}</span>
              </div>
            </div>
          )}
        </Card>

        {/* Lager-Ampel-Widget */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold">Lager-Ampel</h2>
              <div className="flex items-center gap-1">
                {lagerRotCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                    {lagerRotCount} leer
                  </span>
                )}
                {lagerGelbCount > 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                    {lagerGelbCount} gering
                  </span>
                )}
                {data.lagerAlarme === 0 && (
                  <span className="inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 font-medium">
                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                    OK
                  </span>
                )}
              </div>
            </div>
            <Link href="/lager" className="text-xs text-green-700 hover:underline">
              → Lager
            </Link>
          </div>
          {(data.lagerKritisch ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Alle Artikel im grünen Bereich</p>
          ) : (
            <div className="space-y-2">
              {(data.lagerKritisch ?? []).map((a) => (
                <Link
                  key={a.id}
                  href={`/artikel/${a.id}`}
                  className={`flex items-center gap-3 p-2 rounded-lg border transition-colors hover:opacity-90 ${
                    a.status === "rot" ? "border-red-200 bg-red-50" : "border-yellow-200 bg-yellow-50"
                  }`}
                >
                  <span
                    className={`shrink-0 w-3 h-3 rounded-full ${
                      a.status === "rot" ? "bg-red-500" : "bg-yellow-400"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.aktuellerBestand.toLocaleString("de-DE")} {a.einheit}
                      {a.mindestbestand > 0 && (
                        <span className="ml-1 text-gray-400">/ mind. {a.mindestbestand.toLocaleString("de-DE")} {a.einheit}</span>
                      )}
                    </p>
                  </div>
                  <span className={`text-xs font-medium shrink-0 ${a.status === "rot" ? "text-red-700" : "text-yellow-700"}`}>
                    {a.status === "rot" ? "Kein Lager" : "Gering"}
                  </span>
                </Link>
              ))}
              {data.lagerAlarme > (data.lagerKritisch ?? []).length && (
                <p className="text-xs text-gray-400 pt-1 text-center">
                  + {data.lagerAlarme - (data.lagerKritisch ?? []).length} weitere Artikel
                </p>
              )}
            </div>
          )}
        </Card>
      </div>

      {/* Untere Reihe: Letzte Aktivitäten + Wiedervorlagen */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        {/* Letzte Aktivitäten Timeline */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Letzte Aktivitäten</h2>
            <Link href="/crm" className="text-xs text-green-700 hover:underline">
              → CRM
            </Link>
          </div>
          {(data.letzteAktivitaeten ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Noch keine Aktivitäten</p>
          ) : (
            <div className="space-y-2">
              {(data.letzteAktivitaeten ?? []).map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5 border-b last:border-0 pb-2 last:pb-0">
                  <span className="text-base leading-none mt-0.5 shrink-0">{entry.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap mb-0.5">
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium ${
                          TIMELINE_TYP_BADGE[entry.typ] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {TIMELINE_TYP_LABEL[entry.typ] ?? entry.typ}
                      </span>
                      <span className="text-xs text-gray-400">{zeitVorText(entry.zeitpunkt)}</span>
                    </div>
                    <p className="text-sm text-gray-800 truncate">{entry.titel}</p>
                    {entry.kundeName && entry.link ? (
                      <Link
                        href={entry.link}
                        className="text-xs text-green-700 hover:underline truncate block"
                      >
                        {entry.kundeName}
                      </Link>
                    ) : entry.kundeName ? (
                      <p className="text-xs text-gray-500 truncate">{entry.kundeName}</p>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Wiedervorlagen + ggf. Kein-Kontakt */}
        <div className="space-y-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h2 className="font-semibold">Wiedervorlagen</h2>
                {data.wiedervorlagen.length > 0 && (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-500 text-white text-xs font-bold">
                    {data.wiedervorlagen.length}
                  </span>
                )}
              </div>
              <Link href="/crm" className="text-xs text-green-700 hover:underline">
                → CRM
              </Link>
            </div>
            {data.wiedervorlagen.length === 0 ? (
              <p className="text-sm text-gray-400">Keine offenen Aufgaben</p>
            ) : (
              <div className="space-y-2">
                {data.wiedervorlagen.map((w) => {
                  const isOverdue = w.faelligAm ? new Date(w.faelligAm) < new Date() : false;
                  return (
                    <Link
                      key={w.id}
                      href={w.kundeId ? `/kunden/${w.kundeId}?tab=CRM` : "/crm"}
                      className="flex items-start gap-2 p-2 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                    >
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 mt-0.5 ${
                          TYP_BADGE[w.typ] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {TYP_LABEL[w.typ] ?? w.typ}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-800 truncate">{w.betreff}</p>
                        {w.kundeName && (
                          <p className="text-xs text-gray-500 truncate">{w.kundeName}</p>
                        )}
                      </div>
                      {w.faelligAm && (
                        <span
                          className={`text-xs shrink-0 font-medium ${
                            isOverdue ? "text-red-600" : "text-gray-400"
                          }`}
                        >
                          {new Date(w.faelligAm).toLocaleDateString("de-DE")}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            )}
          </Card>

          {data.keinKontakt.length > 0 && (
            <Card>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">Kein Kontakt (90+ Tage)</h2>
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-400 text-white text-xs font-bold">
                    {data.keinKontakt.length}
                  </span>
                </div>
                <Link href="/kunden" className="text-xs text-green-700 hover:underline">
                  → Kunden
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.keinKontakt.map((k) => (
                  <Link
                    key={k.id}
                    href={`/kunden/${k.id}`}
                    className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {k.firma ?? k.name}
                      </p>
                      {k.firma && (
                        <p className="text-xs text-gray-500 truncate">{k.name}</p>
                      )}
                    </div>
                    <span className="text-xs text-orange-600 font-medium shrink-0 ml-2">
                      {k.letzterKontakt
                        ? `zuletzt: ${new Date(k.letzterKontakt).toLocaleDateString("de-DE")}`
                        : "noch nie"}
                    </span>
                  </Link>
                ))}
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Reihe: Top Kunden + Schnellzugriff + Markttrend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top Kunden */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Top-Kunden (lfd. Monat)</h2>
            <Link href="/kunden" className="text-xs text-green-700 hover:underline">
              Alle →
            </Link>
          </div>
          {data.topKunden.length === 0 ? (
            <p className="text-sm text-gray-400">Noch keine Umsätze diesen Monat</p>
          ) : (
            <div className="space-y-3">
              {data.topKunden.map((k) => {
                const barWidth = maxUmsatz > 0 ? (k.umsatz / maxUmsatz) * 100 : 0;
                return (
                  <div key={k.kundeId}>
                    <div className="flex items-center justify-between text-sm mb-0.5">
                      <Link
                        href={`/kunden/${k.kundeId}`}
                        className="text-green-700 hover:underline truncate max-w-[55%]"
                      >
                        {k.name}
                      </Link>
                      <span className="font-mono text-gray-700 text-xs">{formatEuro(k.umsatz)}</span>
                    </div>
                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-400 rounded-full transition-all duration-300"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Schnellzugriff */}
        <Card>
          <h2 className="font-semibold mb-3">Schnellzugriff</h2>
          <div className="grid grid-cols-2 gap-2">
            {SCHNELLZUGRIFF.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-sm font-medium transition-colors ${item.color}`}
              >
                <span className="text-lg leading-none">{item.icon}</span>
                <span className="leading-tight">{item.label}</span>
              </Link>
            ))}
          </div>
        </Card>

        {/* MATIF Futures */}
        <Card>
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold">Futurespreise (MATIF)</h2>
            <Link href="/marktpreise" className="text-xs text-green-700 hover:underline">
              Details →
            </Link>
          </div>
          {!matif || matif.preise.length === 0 ? (
            <p className="text-sm text-gray-400">Lade MATIF-Kurse…</p>
          ) : (
            <div className="space-y-2.5">
              {matif.preise.map((p) => {
                const isUp = (p.veraenderung ?? 0) > 0;
                const isDown = (p.veraenderung ?? 0) < 0;
                const color = isUp ? "text-red-600" : isDown ? "text-green-600" : "text-gray-500";
                const arrow = isUp ? "▲" : isDown ? "▼" : "●";
                const progDiff = p.prognose1W != null ? p.prognose1W - p.preis : null;
                const progUp = (progDiff ?? 0) > 0;
                const progDown = (progDiff ?? 0) < 0;
                const progColor = progUp ? "text-red-500" : progDown ? "text-green-500" : "text-gray-400";
                const kurzName = p.produktName.replace(/ \(.*\)$/, "");
                return (
                  <div key={p.produktCode} className="border-b border-gray-50 last:border-0 pb-2 last:pb-0">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-gray-700 font-medium">{kurzName}</span>
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{p.preis.toLocaleString("de-DE")} €/t</span>
                        {p.veraenderung != null && (
                          <span className={`text-xs font-medium ${color}`}>
                            {arrow} {p.veraenderung > 0 ? "+" : ""}{p.veraenderung.toLocaleString("de-DE")}
                          </span>
                        )}
                      </div>
                    </div>
                    {p.prognose1W != null && (
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-gray-400">1W-Prognose</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`text-xs font-mono font-medium ${progColor}`}>
                            {p.prognose1W.toLocaleString("de-DE")} €/t
                          </span>
                          {p.statPrognose && (
                            <span className="text-xs text-gray-300">
                              ({p.statPrognose.band68Lo.toLocaleString("de-DE")}–{p.statPrognose.band68Hi.toLocaleString("de-DE")})
                            </span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between mt-2 pt-1 border-t border-gray-100">
            <p className="text-xs text-gray-400">Euronext MATIF via Yahoo Finance</p>
            {matif?.letzteAktualisierung && (
              <p className="text-xs text-gray-300">
                {new Date(matif.letzteAktualisierung).toLocaleDateString("de-DE")}
              </p>
            )}
          </div>
        </Card>
      </div>

      {/* Wiederkehrend fällig (wenn vorhanden) */}
      {data.wiederkehrendFaellig > 0 && (
        <div className="mt-6">
          <Link href="/lieferungen">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 flex items-center justify-between hover:bg-orange-100 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-2xl">🔄</span>
                <div>
                  <p className="font-semibold text-orange-800">
                    {data.wiederkehrendFaellig} wiederkehrende Lieferung{data.wiederkehrendFaellig !== 1 ? "en" : ""} fällig
                  </p>
                  <p className="text-sm text-orange-600">Bedarfspläne können jetzt ausgelöst werden</p>
                </div>
              </div>
              <span className="text-orange-600 font-medium text-sm shrink-0">Jetzt auslösen →</span>
            </div>
          </Link>
        </div>
      )}
    </div>
  );
}
