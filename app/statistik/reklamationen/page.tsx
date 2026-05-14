"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import ZeitraumFilter from "@/components/ZeitraumFilter";

interface GruppenRow {
  label: string;
  anzahl: number;
}

interface Data {
  nachKategorie: GruppenRow[];
  nachStatus: GruppenRow[];
  nachPrioritaet: GruppenRow[];
  offeneAnzahl: number;
  summe: { anzahl: number };
}

const KATEGORIE_COLOR: Record<string, string> = {
  Qualitaet: "bg-red-500",
  Menge: "bg-orange-500",
  Lieferung: "bg-blue-500",
  Preis: "bg-purple-500",
  Sonstiges: "bg-gray-400",
};

const STATUS_COLOR: Record<string, string> = {
  OFFEN: "bg-amber-500",
  IN_BEARBEITUNG: "bg-blue-500",
  GELOEST: "bg-green-500",
  GESCHLOSSEN: "bg-gray-400",
};

const PRIO_COLOR: Record<string, string> = {
  kritisch: "bg-red-600",
  hoch: "bg-orange-500",
  normal: "bg-blue-500",
  niedrig: "bg-gray-400",
};

const STATUS_LABEL: Record<string, string> = {
  OFFEN: "Offen",
  IN_BEARBEITUNG: "In Bearbeitung",
  GELOEST: "Gelöst",
  GESCHLOSSEN: "Geschlossen",
};

const PRIO_LABEL: Record<string, string> = {
  kritisch: "Kritisch",
  hoch: "Hoch",
  normal: "Normal",
  niedrig: "Niedrig",
};

function BalkenGruppe({
  titel,
  zeilen,
  colorMap,
  labelMap,
}: {
  titel: string;
  zeilen: GruppenRow[];
  colorMap: Record<string, string>;
  labelMap?: Record<string, string>;
}) {
  const max = zeilen.reduce((m, z) => Math.max(m, z.anzahl), 1);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-4">{titel}</h2>
      {zeilen.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Daten.</p>
      ) : (
        <div className="space-y-3">
          {zeilen.map((z) => {
            const pct = max > 0 ? (z.anzahl / max) * 100 : 0;
            const barColor = colorMap[z.label] ?? "bg-gray-400";
            const displayLabel = labelMap ? (labelMap[z.label] ?? z.label) : z.label;
            return (
              <div key={z.label} className="flex items-center gap-3">
                <span className="text-xs text-gray-600 w-32 shrink-0 truncate">{displayLabel}</span>
                <div className="flex-1 h-5 bg-gray-100 rounded overflow-hidden">
                  <div
                    className={`h-full ${barColor} rounded`}
                    style={{ width: `${Math.min(100, pct)}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-gray-700 w-8 text-right">{z.anzahl}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function StatistikReklamationenPage() {
  const now = new Date();
  const [jahr, setJahr] = useState(String(now.getFullYear()));
  const [vonMonat, setVonMonat] = useState("01");
  const [bisMonat, setBisMonat] = useState(String(now.getMonth() + 1).padStart(2, "0"));
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const laden = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        von: `${jahr}-${vonMonat}`,
        bis: `${jahr}-${bisMonat}`,
      });
      const res = await fetch(`/api/statistik/reklamationen?${params}`);
      if (!res.ok) { setError("Auswertung konnte nicht geladen werden."); return; }
      const json = await res.json() as {
        nachKategorie: { kategorie: string; anzahl: number }[];
        nachStatus: { status: string; anzahl: number }[];
        nachPrioritaet: { prioritaet: string; anzahl: number }[];
        offeneAnzahl: number;
        summe: { anzahl: number };
      };
      setData({
        nachKategorie: (Array.isArray(json.nachKategorie) ? json.nachKategorie : []).map((r) => ({
          label: r.kategorie,
          anzahl: r.anzahl,
        })),
        nachStatus: (Array.isArray(json.nachStatus) ? json.nachStatus : []).map((r) => ({
          label: r.status,
          anzahl: r.anzahl,
        })),
        nachPrioritaet: (Array.isArray(json.nachPrioritaet) ? json.nachPrioritaet : []).map((r) => ({
          label: r.prioritaet,
          anzahl: r.anzahl,
        })),
        offeneAnzahl: json.offeneAnzahl ?? 0,
        summe: json.summe ?? { anzahl: 0 },
      });
    } catch {
      setError("Netzwerkfehler beim Laden.");
    } finally {
      setLoading(false);
    }
  }, [jahr, vonMonat, bisMonat]);

  useEffect(() => { laden(); }, [laden]);

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/statistik" className="hover:text-green-700">Statistik</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Reklamationen</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Reklamations-Auswertung</h1>
        <p className="text-sm text-gray-500 mt-1">
          Aufschlüsselung der Reklamationen nach Kategorie, Status und Priorität im gewählten Zeitraum.
        </p>
      </div>

      <ZeitraumFilter
        jahr={jahr} setJahr={setJahr}
        vonMonat={vonMonat} setVonMonat={setVonMonat}
        bisMonat={bisMonat} setBisMonat={setBisMonat}
        showQuickButtons
        loading={loading}
      />

      {error && (
        <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {data && (
        <>
          {/* KPI-Karten */}
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Reklamationen gesamt</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">{data.summe.anzahl}</p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Offen / In Bearbeitung</p>
              <p className={`text-2xl font-bold mt-1 ${data.offeneAnzahl > 0 ? "text-amber-600" : "text-green-700"}`}>
                {data.offeneAnzahl}
              </p>
            </div>
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">Lösungsquote</p>
              <p className="text-2xl font-bold mt-1 text-gray-900">
                {data.summe.anzahl > 0
                  ? `${Math.round(((data.summe.anzahl - data.offeneAnzahl) / data.summe.anzahl) * 100)} %`
                  : "—"}
              </p>
            </div>
          </div>

          {/* Balken-Aufschlüsselungen */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <BalkenGruppe
              titel="Nach Kategorie"
              zeilen={data.nachKategorie}
              colorMap={KATEGORIE_COLOR}
            />
            <BalkenGruppe
              titel="Nach Status"
              zeilen={data.nachStatus}
              colorMap={STATUS_COLOR}
              labelMap={STATUS_LABEL}
            />
            <BalkenGruppe
              titel="Nach Priorität"
              zeilen={data.nachPrioritaet}
              colorMap={PRIO_COLOR}
              labelMap={PRIO_LABEL}
            />
          </div>
        </>
      )}
    </div>
  );
}
