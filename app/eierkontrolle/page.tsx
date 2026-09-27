"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Card, KpiCard } from "@/components/Card";
import { formatDatum } from "@/lib/utils";
import { berechneEierMhd, eierMhdStatus, type EierMhdStatus } from "@/lib/eier-mhd";
import { haltungsformLabel, ERZEUGERCODE_FORMAT } from "@/lib/auswahllisten";

interface Charge {
  id: number;
  sortierungId: number;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  legedatum: string | null;
  erzeugercode: string | null;
}

interface Erzeuger {
  id: number;
  name: string;
  firma: string | null;
  erzeugercode: string | null;
  haltungsform: number | null;
}

interface KontrollDaten {
  chargen: Charge[];
  erzeuger: Erzeuger[];
  meldepflichtenOffen: number;
  meldepflichtenUeberfaellig: number;
}

const MHD_STYLE: Record<EierMhdStatus, string> = {
  abgelaufen: "bg-red-50 text-red-700 border-red-200",
  ablaufend: "bg-amber-50 text-amber-700 border-amber-200",
  gueltig: "bg-green-50 text-green-700 border-green-200",
  unbekannt: "bg-gray-50 text-gray-500 border-gray-200",
};

const MHD_LABEL: Record<EierMhdStatus, string> = {
  abgelaufen: "Abgelaufen",
  ablaufend: "Läuft bald ab",
  gueltig: "Gültig",
  unbekannt: "Kein Legedatum",
};

type ErzeugerBefund = "ok" | "fehlendesFeld" | "ungueltigesFormat" | "mismatch";

// Erste Ziffer des Erzeugercodes muss der gepflegten Haltungsform entsprechen (0=Bio, 1=Freiland,
// 2=Boden, 3=Käfig/Kleingruppe) — gleiche Ableitung wie haltungsformAusErzeugercode()
// (lib/kat-meldung.ts), hier direkt auf den numerischen Code statt dem Label geprüft. Ein Code,
// der schon formal nicht dem erwarteten Muster entspricht (z.B. eine führende Ziffer 4-9 oder
// ganz andere Schreibweise), wird als "ungueltigesFormat" statt fälschlich als "mismatch"
// eingestuft — ein Format-Fehler ist etwas anderes als eine zur Haltungsform passende, aber
// falsch gepflegte Ziffer.
function erzeugerBefund(erzeugercode: string | null, haltungsform: number | null): ErzeugerBefund {
  const hatCode = !!erzeugercode;
  const hatHaltungsform = haltungsform !== null;
  if (hatCode !== hatHaltungsform) return "fehlendesFeld";
  if (!hatCode) return "ok";
  const code = erzeugercode!.trim();
  if (!ERZEUGERCODE_FORMAT.test(code)) return "ungueltigesFormat";
  const ersteZiffer = parseInt(code.charAt(0), 10);
  return ersteZiffer !== haltungsform ? "mismatch" : "ok";
}

const BEFUND_LABEL: Record<Exclude<ErzeugerBefund, "ok">, string> = {
  fehlendesFeld: "Nur eines der beiden Felder gesetzt",
  ungueltigesFormat: "Erzeugercode-Format ungültig",
  mismatch: "Ziffer passt nicht zur Haltungsform",
};

const FILTER_STORAGE_KEY = "eierkontrolle-mhd-filter";

export default function EierKontrollePage() {
  const [data, setData] = useState<KontrollDaten | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"alle" | EierMhdStatus>(() => {
    if (typeof window === "undefined") return "alle";
    try {
      const stored = window.sessionStorage.getItem(FILTER_STORAGE_KEY);
      return stored === "abgelaufen" || stored === "ablaufend" || stored === "gueltig" || stored === "unbekannt"
        ? stored
        : "alle";
    } catch {
      return "alle";
    }
  });

  useEffect(() => {
    try {
      window.sessionStorage.setItem(FILTER_STORAGE_KEY, filter);
    } catch {
      // sessionStorage kann in privaten/eingeschränkten Kontexten fehlschlagen — reiner
      // Komfortmechanismus, kein Fehler wert.
    }
  }, [filter]);

  useEffect(() => {
    fetch("/api/eierkontrolle")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Laden fehlgeschlagen"))))
      .then((d) => setData(d))
      .catch(() => {
        // Netzwerk-/Serverfehler auf /api/* werden bereits automatisch von
        // lib/fetch-reporter.ts gemeldet (siehe AGENTS.md Regel 24) — hier nur Nutzer-Feedback.
        setError("Kontroll-Daten konnten nicht geladen werden.");
      })
      .finally(() => setLoading(false));
  }, []);

  const chargenMitStatus = useMemo(
    () => (data?.chargen ?? []).map((c) => ({ ...c, status: eierMhdStatus(c.legedatum) })),
    [data]
  );
  const gefiltert = useMemo(
    () => (filter === "alle" ? chargenMitStatus : chargenMitStatus.filter((c) => c.status === filter)),
    [chargenMitStatus, filter]
  );

  const abgelaufen = chargenMitStatus.filter((c) => c.status === "abgelaufen").length;
  const ablaufend = chargenMitStatus.filter((c) => c.status === "ablaufend").length;

  const erzeugerMitPruefung = useMemo(
    () =>
      (data?.erzeuger ?? []).map((e) => ({
        ...e,
        befund: erzeugerBefund(e.erzeugercode, e.haltungsform),
      })),
    [data]
  );
  const erzeugerAuffaellig = erzeugerMitPruefung.filter((e) => e.befund !== "ok");

  return (
    <div className="max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">🥚 Eier-Kontrolle</h1>
        <p className="text-sm text-gray-500">
          MHD-Ampel für sortierte Chargen, Erzeugercode-Validierung und Meldepflichten-Status an
          einer Stelle. Zeigt alle sortierten Chargen — nicht nur die noch am Lager befindliche
          Menge (dafür gibt es kein Restmengen-Feld je Charge).
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : error ? (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>
      ) : (
        data && (
          <>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <KpiCard label="Chargen gesamt" value={chargenMitStatus.length} color="blue" />
              <KpiCard label="Läuft bald ab (≤7 Tage)" value={ablaufend} color="yellow" />
              <KpiCard label="Abgelaufen" value={abgelaufen} color="red" />
              <KpiCard
                label="Meldepflichten offen"
                value={data.meldepflichtenOffen}
                sub={data.meldepflichtenUeberfaellig > 0 ? `${data.meldepflichtenUeberfaellig} überfällig` : undefined}
                color={data.meldepflichtenUeberfaellig > 0 ? "red" : "green"}
              />
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">MHD-Ampel</h2>
              <div className="flex gap-2 mb-3 flex-wrap">
                {(["alle", "abgelaufen", "ablaufend", "gueltig"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-3 py-1.5 text-sm rounded-lg border font-medium transition-colors ${
                      filter === f ? "bg-green-700 text-white border-green-700" : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {f === "alle" ? "Alle" : MHD_LABEL[f]}
                  </button>
                ))}
              </div>
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <tr>
                      <th className="text-left px-4 py-2">Charge</th>
                      <th className="text-left px-4 py-2">Güte</th>
                      <th className="text-left px-4 py-2 hidden sm:table-cell">Gewicht</th>
                      <th className="text-left px-4 py-2 hidden md:table-cell">Erzeugercode</th>
                      <th className="text-left px-4 py-2 hidden sm:table-cell">Legedatum</th>
                      <th className="text-left px-4 py-2">MHD</th>
                      <th className="text-right px-4 py-2 hidden md:table-cell">Menge</th>
                      <th className="text-left px-4 py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {gefiltert.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-6 text-center text-gray-400 italic">Keine Chargen in dieser Ansicht.</td>
                      </tr>
                    ) : (
                      gefiltert.map((c) => (
                        <tr key={c.id}>
                          <td className="px-4 py-2">
                            <Link href={`/eiersortierung/${c.sortierungId}`} className="text-green-700 hover:underline">
                              {c.chargeNr ?? `#${c.id}`}
                            </Link>
                          </td>
                          <td className="px-4 py-2">{c.gueteklasse}</td>
                          <td className="px-4 py-2 hidden sm:table-cell">{c.gewichtsklasse}</td>
                          <td className="px-4 py-2 hidden md:table-cell">{c.erzeugercode ?? "—"}</td>
                          <td className="px-4 py-2 hidden sm:table-cell">{c.legedatum ? formatDatum(c.legedatum) : "—"}</td>
                          <td className="px-4 py-2">{c.legedatum ? formatDatum(berechneEierMhd(new Date(c.legedatum)).toISOString()) : "—"}</td>
                          <td className="px-4 py-2 text-right hidden md:table-cell">{c.menge}</td>
                          <td className="px-4 py-2">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${MHD_STYLE[c.status]}`}>
                              {MHD_LABEL[c.status]}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-lg font-semibold mb-3">Erzeugercode-Validierung</h2>
              <p className="text-sm text-gray-500 mb-3">
                Prüft, ob die erste Ziffer des Erzeugercodes zur gepflegten Haltungsform passt
                (0=Bio, 1=Freiland, 2=Boden, 3=Käfig/Kleingruppe) und ob beide Felder gesetzt sind.
              </p>
              {erzeugerAuffaellig.length === 0 ? (
                <p className="text-sm text-gray-400 italic">Keine Auffälligkeiten bei den Erzeuger-Stammdaten.</p>
              ) : (
                <Card className="!p-0 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <tr>
                        <th className="text-left px-4 py-2">Erzeuger</th>
                        <th className="text-left px-4 py-2">Erzeugercode</th>
                        <th className="text-left px-4 py-2">Haltungsform</th>
                        <th className="text-left px-4 py-2">Befund</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {erzeugerAuffaellig.map((e) => (
                        <tr key={e.id}>
                          <td className="px-4 py-2">
                            <Link href={`/kunden/${e.id}`} className="text-green-700 hover:underline">{e.firma ?? e.name}</Link>
                          </td>
                          <td className="px-4 py-2">{e.erzeugercode ?? "—"}</td>
                          <td className="px-4 py-2">{haltungsformLabel(e.haltungsform) ?? "—"}</td>
                          <td className="px-4 py-2">
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium border bg-red-50 text-red-700 border-red-200">
                              {e.befund !== "ok" ? BEFUND_LABEL[e.befund] : null}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              )}
            </div>

            <div>
              <h2 className="text-lg font-semibold mb-3">Meldepflichten-Status</h2>
              <Card>
                <p className="text-sm text-gray-700">
                  {data.meldepflichtenOffen === 0
                    ? "Aktuell keine offene Meldepflicht."
                    : `${data.meldepflichtenOffen} offene Meldepflicht(en)${data.meldepflichtenUeberfaellig > 0 ? `, davon ${data.meldepflichtenUeberfaellig} überfällig` : ""}.`}
                </p>
                <Link href="/meldepflichten" className="text-sm text-green-700 hover:text-green-900 font-medium mt-2 inline-block">
                  → Zum Fristen-Tracker
                </Link>
              </Card>
            </div>
          </>
        )
      )}
    </div>
  );
}
