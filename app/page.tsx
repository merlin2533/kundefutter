"use client";
import { useEffect, useState } from "react";
import { KpiCard, Card } from "@/components/Card";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";

interface DashboardData {
  kundenAktiv: number;
  offeneLieferungen: number;
  umsatzMonat: number;
  deckungsbeitragMonat: number;
  lagerAlarme: number;
  faelligNaechste14Tage: number;
  topKunden: { kundeId: number; name: string; umsatz: number }[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    fetch("/api/dashboard").then((r) => r.json()).then(setData);
  }, []);

  if (!data) return <p className="text-gray-400 mt-8">Lade Dashboard…</p>;

  const marge =
    data.umsatzMonat > 0
      ? ((data.deckungsbeitragMonat / data.umsatzMonat) * 100).toFixed(1)
      : "0.0";

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
        <KpiCard label="Aktive Kunden" value={data.kundenAktiv} color="blue" />
        <KpiCard label="Offene Lieferungen" value={data.offeneLieferungen} color="yellow" />
        <KpiCard label="Umsatz (Monat)" value={formatEuro(data.umsatzMonat)} color="green" />
        <KpiCard
          label="Deckungsbeitrag"
          value={formatEuro(data.deckungsbeitragMonat)}
          sub={`${marge} % Marge`}
          color="green"
        />
        <KpiCard
          label="Lager-Alarme"
          value={data.lagerAlarme}
          color={data.lagerAlarme > 0 ? "red" : "green"}
        />
        <KpiCard
          label="Fällig (14 Tage)"
          value={data.faelligNaechste14Tage}
          sub="geplante Lieferungen"
          color="blue"
        />
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-semibold mb-3">Top-Kunden (laufender Monat)</h2>
          {data.topKunden.length === 0 ? (
            <p className="text-sm text-gray-400">Noch keine Umsätze diesen Monat</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b">
                  <th className="pb-1">Kunde</th>
                  <th className="pb-1 text-right">Umsatz</th>
                </tr>
              </thead>
              <tbody>
                {data.topKunden.map((k) => (
                  <tr key={k.kundeId} className="border-b last:border-0">
                    <td className="py-1.5">
                      <Link href={`/kunden/${k.kundeId}`} className="text-green-700 hover:underline">
                        {k.name}
                      </Link>
                    </td>
                    <td className="py-1.5 text-right font-mono">{formatEuro(k.umsatz)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card>
          <h2 className="font-semibold mb-3">Schnellzugriff</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: "/lieferungen", label: "Neue Lieferung", icon: "📦" },
              { href: "/lager", label: "Lagerübersicht", icon: "🏭" },
              { href: "/prognose", label: "Bestellvorschlag", icon: "📊" },
              { href: "/kunden/karte", label: "Kundenkarte", icon: "🗺️" },
              { href: "/exporte", label: "Exporte", icon: "📥" },
              { href: "/artikel", label: "Artikel", icon: "🌾" },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-2 p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-sm"
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
