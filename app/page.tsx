"use client";
import { useEffect, useState } from "react";
import { KpiCard, Card } from "@/components/Card";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

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

interface DashboardData {
  kundenAktiv: number;
  offeneLieferungen: number;
  umsatzMonat: number;
  deckungsbeitragMonat: number;
  lagerAlarme: number;
  faelligNaechste14Tage: number;
  offeneRechnungen: number;
  ueberfaelligeRechnungen: number;
  wiederkehrendFaellig: number;
  topKunden: { kundeId: number; name: string; umsatz: number }[];
  markttrend: MarktTrend[];
  artikelAlarme: { id: number; name: string; aktuellerBestand: number; mindestbestand: number; einheit: string; status: string }[];
  wiedervorlagen: Wiedervorlage[];
  keinKontakt: KeinKontaktKunde[];
}

interface Aktivitaet {
  id: number;
  datum: string;
  typ: string;
  betreff: string;
  kunde: { id: number; name: string; firma: string | null } | null;
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

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [aktivitaeten, setAktivitaeten] = useState<Aktivitaet[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadData = () => {
    Promise.all([
      fetch("/api/dashboard").then((r) => r.json()),
      fetch("/api/kunden/aktivitaeten?offene=1").then((r) => r.json()),
    ]).then(([dashboard, akt]) => {
      setData(dashboard);
      // Sort by datum desc, take last 5
      const sorted = Array.isArray(akt)
        ? [...akt].sort(
            (a: Aktivitaet, b: Aktivitaet) =>
              new Date(b.datum).getTime() - new Date(a.datum).getTime()
          ).slice(0, 5)
        : [];
      setAktivitaeten(sorted);
      setLastUpdated(new Date());
    });
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 60_000);
    return () => clearInterval(interval);
  }, []);

  if (!data) return <p className="text-gray-400 mt-8">Lade Dashboard…</p>;

  const marge =
    data.umsatzMonat > 0
      ? ((data.deckungsbeitragMonat / data.umsatzMonat) * 100).toFixed(1)
      : "0.0";

  const maxUmsatz = data.topKunden.length > 0 ? data.topKunden[0].umsatz : 1;

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

      {/* Row 1: Core KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <KpiCard
          label="Umsatz (Monat)"
          value={formatEuro(data.umsatzMonat)}
          color="green"
        />
        <KpiCard
          label="Deckungsbeitrag"
          value={formatEuro(data.deckungsbeitragMonat)}
          sub={`${marge} % Marge`}
          color="green"
        />
        <KpiCard
          label="Aktive Kunden"
          value={data.kundenAktiv}
          color="blue"
        />
        <KpiCard
          label="Offene Lieferungen"
          value={data.offeneLieferungen}
          color="yellow"
        />
      </div>

      {/* Row 2: Alert KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <KpiCard
          label="Lager-Alarme"
          value={data.lagerAlarme}
          sub={data.lagerAlarme > 0 ? "→ Lagerübersicht" : "Alles im grünen Bereich"}
          color={data.lagerAlarme > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Überfällige Rechnungen"
          value={data.ueberfaelligeRechnungen}
          sub={data.ueberfaelligeRechnungen > 0 ? "→ Mahnwesen" : undefined}
          color={data.ueberfaelligeRechnungen > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Fällig (14 Tage)"
          value={data.faelligNaechste14Tage}
          sub="geplante Lieferungen"
          color={data.faelligNaechste14Tage > 0 ? "yellow" : "green"}
        />
        {data.wiederkehrendFaellig > 0 && (
          <Link href="/lieferungen" className="block">
            <KpiCard
              label="Wiederkehrend fällig"
              value={data.wiederkehrendFaellig}
              sub="→ Jetzt auslösen"
              color="orange"
            />
          </Link>
        )}
      </div>

      {/* Row 3: 3-column grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Col 1: Top Kunden with progress bars */}
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

        {/* Col 2: Schnellzugriff */}
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

        {/* Col 3: Letzte CRM-Aktivitäten or Markttrend */}
        {aktivitaeten.length > 0 ? (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Letzte CRM-Aktivitäten</h2>
              <Link href="/crm" className="text-xs text-green-700 hover:underline">
                Alle →
              </Link>
            </div>
            <div className="space-y-3">
              {aktivitaeten.map((a) => (
                <div key={a.id} className="text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div className="flex items-center justify-between gap-1 flex-wrap mb-0.5">
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded font-medium ${TYP_BADGE[a.typ] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      {TYP_LABEL[a.typ] ?? a.typ}
                    </span>
                    <span className="text-xs text-gray-400 shrink-0">{formatDatum(a.datum)}</span>
                  </div>
                  {a.kunde && (
                    <Link
                      href={`/kunden/${a.kunde.id}`}
                      className="text-green-700 hover:underline text-xs font-medium"
                    >
                      {a.kunde.firma ?? a.kunde.name}
                    </Link>
                  )}
                  <p className="text-gray-600 truncate">{a.betreff}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : data.markttrend.length > 0 ? (
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Markttrend (Eurostat)</h2>
              <Link href="/marktpreise" className="text-xs text-green-700 hover:underline">
                Details →
              </Link>
            </div>
            <div className="space-y-2">
              {data.markttrend.map((t) => {
                const isUp = t.veraenderung > 2;
                const isDown = t.veraenderung < -2;
                const color = isUp ? "text-red-600" : isDown ? "text-green-600" : "text-gray-500";
                const arrow = isUp ? "▲" : isDown ? "▼" : "●";
                return (
                  <div key={t.kategorie} className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">{t.kategorie}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium">{t.aktuell}</span>
                      <span className={`text-xs font-medium ${color}`}>
                        {arrow} {t.veraenderung > 0 ? "+" : ""}{t.veraenderung}%
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-xs text-gray-400 mt-2">Index 2015 = 100</p>
          </Card>
        ) : (
          <Card>
            <h2 className="font-semibold mb-3">Markttrend</h2>
            <p className="text-sm text-gray-400">Keine Marktdaten verfügbar</p>
          </Card>
        )}
      </div>

      {/* Row 4: Lager-Alarme detail widget (only when alarms exist) */}
      {data.artikelAlarme.length > 0 && (
        <div className="mt-6">
          <Card>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Lager-Alarme</h2>
              <Link href="/lager" className="text-xs text-green-700 hover:underline">
                → Lager
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              {data.artikelAlarme.map((a) => (
                <Link
                  key={a.id}
                  href={`/artikel/${a.id}`}
                  className="flex items-start gap-2 p-2.5 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors"
                >
                  <span
                    className={`mt-0.5 shrink-0 w-2.5 h-2.5 rounded-full ${
                      a.status === "rot" ? "bg-red-500" : "bg-yellow-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{a.name}</p>
                    <p className="text-xs text-gray-500">
                      {a.aktuellerBestand.toLocaleString("de-DE")} {a.einheit} / mind.{" "}
                      {a.mindestbestand.toLocaleString("de-DE")} {a.einheit}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Row 5: Wiedervorlagen + Kein Kontakt */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Wiedervorlagen */}
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

        {/* Kein Kontakt */}
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
  );
}
