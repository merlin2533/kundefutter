"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatEuro, MONATE_KURZ } from "@/lib/utils";
import ZeitraumFilter from "@/components/ZeitraumFilter";

// ─── Types ────────────────────────────────────────────────────────────────────

interface UmsatzMonat {
  monat: string; // "YYYY-MM"
  umsatz: number;
  anzahl: number;
}

interface TopArtikel {
  artikelId: number;
  name: string;
  menge: number;
  umsatz: number;
}

interface TopKunde {
  kundeId: number;
  name: string;
  umsatz: number;
  anzahl: number;
}

interface KategorieUmsatz {
  kategorie: string;
  umsatz: number;
  menge: number;
}

interface StatistikData {
  umsatzNachMonat: UmsatzMonat[];
  topArtikel: TopArtikel[];
  topKunden: TopKunde[];
  umsatzNachKategorie: KategorieUmsatz[];
  saisonaleVerteilung: { monat: number; umsatz: number }[];
  kpi: {
    umsatz: number;
    marge: number;
    margeProzent: number;
    anzahlLieferungen: number;
    durchschnittProLieferung: number;
  };
  lieferStatus: { status: string; anzahl: number }[];
  offenePosten: { anzahl: number; summe: number };
  ausgabenNachKategorie: { kategorie: string; summe: number }[];
  lager: { artikelUnterMindest: number; lagerwert: number };
  vorjahr: { umsatz: number; veraenderungProzent: number | null };
}

// ─── Quick Links ──────────────────────────────────────────────────────────────

const QUICK_LINKS = [
  { href: "/statistik/kunden", icon: "👥", title: "Kunden" },
  { href: "/statistik/artikel", icon: "📦", title: "Artikel" },
  { href: "/statistik/abc", icon: "🔤", title: "ABC-Analyse" },
  { href: "/statistik/saisonal", icon: "🗓️", title: "Saisonal" },
  { href: "/statistik/angebote", icon: "📝", title: "Angebote" },
  { href: "/statistik/crm", icon: "📞", title: "CRM-Aktivität" },
  { href: "/statistik/vorbestellungen", icon: "⏱", title: "Vorbestellungen" },
  { href: "/statistik/deckungsbeitrag", icon: "💶", title: "Deckungsbeitrag" },
  { href: "/statistik/aging", icon: "⏳", title: "Offene Posten" },
  { href: "/statistik/ausgaben", icon: "🧾", title: "Ausgaben" },
  { href: "/statistik/budget", icon: "🎯", title: "Budget" },
  { href: "/statistik/lieferanten", icon: "🚚", title: "Lieferanten" },
  { href: "/statistik/lager", icon: "🏭", title: "Lager" },
  { href: "/statistik/reklamationen", icon: "⚠️", title: "Reklamationen" },
  { href: "/prognose", icon: "🔮", title: "Prognose" },
  { href: "/marktpreise", icon: "📈", title: "Marktpreise" },
];

// ─── Kennzahl-Kachel ──────────────────────────────────────────────────────────

function KpiKachel({ label, wert, sub, farbe }: { label: string; wert: string; sub?: string; farbe?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${farbe ?? "text-gray-900"}`}>{wert}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ─── Generischer Prozentbalken ────────────────────────────────────────────────

const BALKEN_FARBEN = ["bg-green-500", "bg-blue-500", "bg-amber-500", "bg-purple-500", "bg-rose-500", "bg-teal-500", "bg-gray-400"];

function ProzentBalken({ data }: { data: { label: string; wert: number }[] }) {
  if (data.length === 0) return <p className="text-sm text-gray-400">Keine Daten</p>;
  const gesamt = data.reduce((s, d) => s + d.wert, 0);
  return (
    <div className="space-y-3">
      {data.map((d, i) => {
        const pct = gesamt > 0 ? (d.wert / gesamt) * 100 : 0;
        return (
          <div key={d.label}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{d.label}</span>
              <span className="text-sm text-gray-500">{pct.toFixed(1)}% &middot; {formatEuro(d.wert)}</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className={`${BALKEN_FARBEN[i % BALKEN_FARBEN.length]} h-4 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Saison-Mini-Balken (12 Monate) ───────────────────────────────────────────

const MONATS_KUERZEL = MONATE_KURZ;

function SaisonBalken({ data }: { data: { monat: number; umsatz: number }[] }) {
  const max = Math.max(...data.map((d) => d.umsatz), 1);
  return (
    <div className="flex items-end gap-1.5 h-40">
      {data.map((d) => (
        <div key={d.monat} className="flex-1 flex flex-col items-center gap-1" title={`${MONATS_KUERZEL[d.monat - 1]}: ${formatEuro(d.umsatz)}`}>
          <div className="w-full bg-green-100 rounded-t flex items-end" style={{ height: "100%" }}>
            <div className="w-full bg-green-500 rounded-t transition-all duration-500" style={{ height: `${(d.umsatz / max) * 100}%` }} />
          </div>
          <span className="text-[10px] text-gray-400">{MONATS_KUERZEL[d.monat - 1]}</span>
        </div>
      ))}
    </div>
  );
}

// ─── SVG Balkenchart ──────────────────────────────────────────────────────────

function BalkenChart({ data }: { data: UmsatzMonat[] }) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; text: string } | null>(null);

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-sm text-gray-400">
        Keine Daten im gewählten Zeitraum
      </div>
    );
  }

  const W = 700;
  const H = 220;
  const paddingLeft = 70;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 50;
  const chartW = W - paddingLeft - paddingRight;
  const chartH = H - paddingTop - paddingBottom;

  const maxUmsatz = Math.max(...data.map((d) => d.umsatz), 1);
  const barW = Math.min(40, chartW / data.length - 4);
  const step = chartW / data.length;

  // Y-axis ticks
  const tickCount = 5;
  const yTicks: number[] = [];
  for (let i = 0; i <= tickCount; i++) {
    yTicks.push((maxUmsatz / tickCount) * i);
  }

  function formatMonat(m: string) {
    const [y, mo] = m.split("-");
    const monate = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];
    return `${monate[Number(mo) - 1]} ${y}`;
  }

  return (
    <div className="relative overflow-x-auto">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        style={{ minWidth: Math.max(400, data.length * 60) }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* Y-axis grid + labels */}
        {yTicks.map((tick, i) => {
          const y = paddingTop + chartH - (tick / maxUmsatz) * chartH;
          return (
            <g key={i}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={W - paddingRight}
                y2={y}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              <text
                x={paddingLeft - 6}
                y={y + 4}
                textAnchor="end"
                fontSize={10}
                fill="#9ca3af"
              >
                {tick >= 1000 ? `${(tick / 1000).toFixed(0)}k` : tick.toFixed(0)}
              </text>
            </g>
          );
        })}

        {/* X-axis line */}
        <line
          x1={paddingLeft}
          y1={paddingTop + chartH}
          x2={W - paddingRight}
          y2={paddingTop + chartH}
          stroke="#d1d5db"
          strokeWidth={1}
        />

        {/* Bars */}
        {data.map((d, i) => {
          const barH = Math.max(2, (d.umsatz / maxUmsatz) * chartH);
          const cx = paddingLeft + i * step + step / 2;
          const x = cx - barW / 2;
          const y = paddingTop + chartH - barH;
          return (
            <g key={d.monat}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={barH}
                fill="#16a34a"
                rx={3}
                className="cursor-pointer hover:fill-green-500 transition-colors"
                onMouseEnter={() => {
                  setTooltip({
                    x: cx,
                    y: y - 8,
                    text: `${formatMonat(d.monat)}: ${formatEuro(d.umsatz)} (${d.anzahl} Lief.)`,
                  });
                }}
              />
              {/* X-axis label */}
              <text
                x={cx}
                y={paddingTop + chartH + 16}
                textAnchor="middle"
                fontSize={9}
                fill="#6b7280"
                transform={`rotate(-30 ${cx} ${paddingTop + chartH + 16})`}
              >
                {formatMonat(d.monat)}
              </text>
            </g>
          );
        })}

        {/* Tooltip */}
        {tooltip && (
          <g>
            <rect
              x={Math.min(tooltip.x - 80, W - paddingRight - 160)}
              y={tooltip.y - 24}
              width={200}
              height={26}
              rx={4}
              fill="#1f2937"
              opacity={0.9}
            />
            <text
              x={Math.min(tooltip.x - 80, W - paddingRight - 160) + 8}
              y={tooltip.y - 8}
              fontSize={10}
              fill="white"
            >
              {tooltip.text}
            </text>
          </g>
        )}
      </svg>
    </div>
  );
}

// ─── Kategorie Balken ─────────────────────────────────────────────────────────

function KategorieProzentBalken({ data }: { data: KategorieUmsatz[] }) {
  if (data.length === 0) {
    return <p className="text-sm text-gray-400">Keine Daten</p>;
  }
  const gesamtUmsatz = data.reduce((s, d) => s + d.umsatz, 0);
  const farben: Record<string, string> = {
    Futter: "bg-green-500",
    Duenger: "bg-blue-500",
    Saatgut: "bg-yellow-500",
  };

  return (
    <div className="space-y-3">
      {data.map((d) => {
        const pct = gesamtUmsatz > 0 ? (d.umsatz / gesamtUmsatz) * 100 : 0;
        const farbe = farben[d.kategorie] ?? "bg-gray-400";
        return (
          <div key={d.kategorie}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{d.kategorie}</span>
              <span className="text-sm text-gray-500">
                {pct.toFixed(1)}% &middot; {formatEuro(d.umsatz)}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-4 overflow-hidden">
              <div
                className={`${farbe} h-4 rounded-full transition-all duration-500`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatistikPage() {
  const now = new Date();
  const defaultMonat = String(now.getMonth() + 1).padStart(2, "0");

  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(defaultMonat);
  const [data, setData] = useState<StatistikData | null>(null);
  const [loading, setLoading] = useState(false);

  const laden = useCallback(async () => {
    setLoading(true);
    try {
      const von = `${jahr}-${vonMonat}`;
      const bis = `${jahr}-${bisMonat}`;
      const res = await fetch(`/api/statistik?von=${von}&bis=${bis}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => {
    laden();
  }, [laden]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Statistik & Auswertungen</h1>
        <p className="text-sm text-gray-500 mt-1">Umsatzauswertungen und Kennzahlen</p>
      </div>

      {/* Filter */}
      <ZeitraumFilter
        jahr={jahr} setJahr={setJahr}
        vonMonat={vonMonat} setVonMonat={setVonMonat}
        bisMonat={bisMonat} setBisMonat={setBisMonat}
        showQuickButtons
        loading={loading}
      />

      {data && (
        <>
          {/* KPI-Kacheln */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiKachel label="Umsatz" wert={formatEuro(data.kpi.umsatz)} sub="im Zeitraum (geliefert)" />
            <KpiKachel
              label="Rohertrag"
              wert={formatEuro(data.kpi.marge)}
              sub={`${data.kpi.margeProzent.toLocaleString("de-DE")} % Marge`}
              farbe={data.kpi.marge >= 0 ? "text-green-700" : "text-red-600"}
            />
            <KpiKachel label="Lieferungen" wert={String(data.kpi.anzahlLieferungen)} sub="geliefert im Zeitraum" />
            <KpiKachel label="Ø pro Lieferung" wert={formatEuro(data.kpi.durchschnittProLieferung)} />
          </div>

          {/* Vorjahresvergleich + Offene Posten + Lager */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Vorjahresvergleich</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{formatEuro(data.vorjahr.umsatz)}</p>
              {data.vorjahr.veraenderungProzent === null ? (
                <p className="text-xs text-gray-400 mt-0.5">Kein Vorjahresumsatz im Zeitraum</p>
              ) : (
                <p className={`text-xs mt-0.5 font-medium ${data.vorjahr.veraenderungProzent >= 0 ? "text-green-700" : "text-red-600"}`}>
                  {data.vorjahr.veraenderungProzent >= 0 ? "▲" : "▼"} {Math.abs(data.vorjahr.veraenderungProzent).toLocaleString("de-DE")} % ggü. Vorjahr
                </p>
              )}
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Offene Posten</p>
              <p className="text-2xl font-bold mt-1 text-amber-700">{formatEuro(data.offenePosten.summe)}</p>
              <p className="text-xs text-gray-400 mt-0.5">{data.offenePosten.anzahl} unbezahlte Rechnungen (Stichtag)</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lager</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{formatEuro(data.lager.lagerwert)}</p>
              <p className={`text-xs mt-0.5 ${data.lager.artikelUnterMindest > 0 ? "text-red-600" : "text-gray-400"}`}>
                {data.lager.artikelUnterMindest} Artikel unter Mindestbestand
              </p>
            </div>
          </div>

          {/* Umsatz Balkenchart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Umsatz nach Monat</h2>
            <BalkenChart data={data.umsatzNachMonat} />
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Top 5 Artikel */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Top 5 Artikel</h2>
              {data.topArtikel.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten im gewählten Zeitraum</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 font-medium text-gray-600">Artikel</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Menge</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Umsatz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topArtikel.map((a, i) => (
                      <tr key={a.artikelId} className="hover:bg-gray-50">
                        <td className="py-2.5">
                          <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                          {a.name}
                        </td>
                        <td className="py-2.5 text-right font-mono text-gray-600">
                          {a.menge.toLocaleString("de-DE")}
                        </td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {formatEuro(a.umsatz)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top 5 Kunden */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Top 5 Kunden</h2>
              {data.topKunden.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Daten im gewählten Zeitraum</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-2 font-medium text-gray-600">Kunde</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Lieferungen</th>
                      <th className="text-right pb-2 font-medium text-gray-600">Umsatz</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {data.topKunden.map((k, i) => (
                      <tr key={k.kundeId} className="hover:bg-gray-50">
                        <td className="py-2.5">
                          <span className="text-xs text-gray-400 mr-2">#{i + 1}</span>
                          {k.name}
                        </td>
                        <td className="py-2.5 text-right text-gray-600">{k.anzahl}</td>
                        <td className="py-2.5 text-right font-mono font-semibold">
                          {formatEuro(k.umsatz)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Umsatz nach Kategorie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Umsatz nach Kategorie</h2>
              <KategorieProzentBalken data={data.umsatzNachKategorie} />
            </div>

            {/* Ausgaben nach Kategorie */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Ausgaben nach Kategorie</h2>
              <ProzentBalken data={data.ausgabenNachKategorie.map((a) => ({ label: a.kategorie, wert: a.summe }))} />
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            {/* Lieferungen nach Status */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-4">Lieferungen nach Status</h2>
              {data.lieferStatus.length === 0 ? (
                <p className="text-sm text-gray-400">Keine Lieferungen im gewählten Zeitraum</p>
              ) : (
                <div className="space-y-2">
                  {data.lieferStatus.map((s) => (
                    <div key={s.status} className="flex items-center justify-between text-sm">
                      <span className="capitalize text-gray-700">{s.status}</span>
                      <span className="font-mono font-semibold text-gray-900">{s.anzahl}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Saisonale Verteilung */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-base font-semibold text-gray-800 mb-1">Saisonale Verteilung</h2>
              <p className="text-xs text-gray-400 mb-4">Umsatz je Kalendermonat im gewählten Zeitraum</p>
              <SaisonBalken data={data.saisonaleVerteilung} />
            </div>
          </div>

          {/* Weitere Auswertungen */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-base font-semibold text-gray-800 mb-4">Weitere Auswertungen</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {QUICK_LINKS.map((l) => (
                <Link key={l.href} href={l.href} className="flex items-center gap-2 p-3 rounded-lg border border-gray-100 hover:border-green-400 hover:bg-green-50 transition-colors text-sm text-gray-700 hover:text-green-700">
                  <span>{l.icon}</span>
                  <span>{l.title}</span>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
