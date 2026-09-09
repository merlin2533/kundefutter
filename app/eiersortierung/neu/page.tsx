"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import { GUETEKLASSEN, GEWICHTSKLASSEN } from "@/lib/auswahllisten";
import { berechneEierMhd } from "@/lib/eier-mhd";
import * as Sentry from "@sentry/nextjs";

interface Artikel {
  id: number;
  name: string;
  einheit: string;
  kategorie: string;
}

interface Anlieferung {
  id: number;
  nummer: string;
  datum: string;
  menge: number;
  kunde: { id: number; name: string; firma: string | null; erzeugercode: string | null };
}

type Position = {
  artikelId: string;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string;
  legedatum: string;
  erzeugercode: string;
};

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

function leerePosition(erzeugercode = ""): Position {
  return { artikelId: "", gueteklasse: "A", gewichtsklasse: "M", menge: 0, chargeNr: "", legedatum: "", erzeugercode };
}

export default function EiersortierungNeuPage() {
  const router = useRouter();
  const [artikelList, setArtikelList] = useState<Artikel[]>([]);
  const [anlieferungenList, setAnlieferungenList] = useState<Anlieferung[]>([]);
  const [anlieferungId, setAnlieferungId] = useState("");
  const [datum, setDatum] = useState(new Date().toISOString().slice(0, 10));
  const [notiz, setNotiz] = useState("");
  const [positionen, setPositionen] = useState<Position[]>([leerePosition()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/artikel?limit=5000&relations=false")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setArtikelList(Array.isArray(d) ? d : []))
      .catch((err) => Sentry.captureException(err));
    fetch("/api/anlieferungen")
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setAnlieferungenList(Array.isArray(d) ? d : []))
      .catch((err) => Sentry.captureException(err));
  }, []);

  const gewaehlteAnlieferung = anlieferungenList.find((a) => String(a.id) === anlieferungId);
  const eierArtikelList = artikelList.filter((a) => a.kategorie === "Eier");

  // Übernimmt den Erzeugercode der gewählten Anlieferung nachträglich in alle Positionszeilen,
  // deren Erzeugercode noch leer ist — sonst bleibt z.B. die initial leere erste Zeile ohne
  // Erzeugercode, wenn die Anlieferung erst NACH dem Anlegen der Zeile ausgewählt wird.
  useEffect(() => {
    const code = gewaehlteAnlieferung?.kunde.erzeugercode;
    if (!code) return;
    setPositionen((prev) => prev.map((p) => (p.erzeugercode ? p : { ...p, erzeugercode: code })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anlieferungId]);

  function addPosition() {
    setPositionen([...positionen, leerePosition(gewaehlteAnlieferung?.kunde.erzeugercode ?? "")]);
  }

  function removePosition(idx: number) {
    setPositionen(positionen.filter((_, i) => i !== idx));
  }

  function updatePosition(idx: number, field: keyof Position, value: string | number) {
    setPositionen(positionen.map((p, i) => (i === idx ? { ...p, [field]: value } : p)));
  }

  function mhdFuer(legedatum: string): string | null {
    if (!legedatum) return null;
    return berechneEierMhd(new Date(legedatum)).toLocaleDateString("de-DE");
  }

  async function handleSubmit() {
    const gueltig = positionen.filter((p) => p.artikelId && p.menge > 0);
    if (gueltig.length === 0) {
      setError("Bitte mindestens eine Position mit Artikel und Menge erfassen.");
      return;
    }

    setSaving(true);
    setError("");
    const res = await fetch("/api/eiersortierung", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum,
        anlieferungId: anlieferungId ? Number(anlieferungId) : undefined,
        notiz: notiz || undefined,
        positionen: gueltig.map((p) => ({
          artikelId: Number(p.artikelId),
          gueteklasse: p.gueteklasse,
          gewichtsklasse: p.gewichtsklasse,
          menge: Number(p.menge),
          chargeNr: p.chargeNr.trim() || undefined,
          legedatum: p.legedatum || undefined,
          erzeugercode: p.erzeugercode.trim() || undefined,
        })),
      }),
    });
    setSaving(false);
    if (res.ok) {
      const d = await res.json();
      router.push(`/eiersortierung/${d.id}`);
    } else {
      const d = await res.json().catch((err) => {
        Sentry.captureException(err);
        return {};
      });
      setError(d.error ?? "Fehler beim Speichern.");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Neue Ei-Sortierung</h1>
        <Link href="/eiersortierung" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
          Abbrechen
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-4 sm:p-6 space-y-6">
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Anlieferung (optional)</label>
            <SearchableSelect
              options={anlieferungenList.map((a) => ({
                value: a.id,
                label: `${a.nummer} · ${a.kunde.firma || a.kunde.name} · ${a.menge}`,
              }))}
              value={anlieferungId}
              onChange={(v) => setAnlieferungId(v)}
              placeholder="-- keine, direkt aus eigener Erzeugung --"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Datum</label>
            <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
            <input type="text" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="Optional" className={inputCls} />
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Ausgangschargen</h3>
            <button onClick={addPosition} className="text-sm text-green-700 hover:text-green-900 font-medium">
              + Charge hinzufügen
            </button>
          </div>
          {eierArtikelList.length === 0 && (
            <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-3">
              Noch kein Artikel der Kategorie „Eier" angelegt.{" "}
              <Link href="/artikel/neu" className="underline font-medium">Jetzt anlegen →</Link>
            </p>
          )}
          <div className="space-y-3">
            {positionen.map((pos, idx) => {
              const mhd = mhdFuer(pos.legedatum);
              return (
                <div key={idx} className="border border-gray-200 rounded-lg p-3 space-y-2">
                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-2 items-end">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Artikel</label>
                      <SearchableSelect
                        options={eierArtikelList.map((a) => ({ value: a.id, label: a.name }))}
                        value={pos.artikelId}
                        onChange={(v) => updatePosition(idx, "artikelId", v)}
                        placeholder="-- Artikel --"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Güteklasse</label>
                      <select value={pos.gueteklasse} onChange={(e) => updatePosition(idx, "gueteklasse", e.target.value)} className={inputCls}>
                        {GUETEKLASSEN.map((g) => (
                          <option key={g.key} value={g.key}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Gewichtsklasse</label>
                      <select value={pos.gewichtsklasse} onChange={(e) => updatePosition(idx, "gewichtsklasse", e.target.value)} className={inputCls}>
                        {GEWICHTSKLASSEN.map((g) => (
                          <option key={g.key} value={g.key}>{g.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Menge</label>
                      <input
                        type="number"
                        value={pos.menge || ""}
                        onChange={(e) => updatePosition(idx, "menge", Number(e.target.value))}
                        className={inputCls}
                      />
                    </div>
                    <div className="flex items-end">
                      {positionen.length > 1 && (
                        <button onClick={() => removePosition(idx)} className="text-red-600 hover:text-red-800 text-sm px-2 py-2" title="Entfernen">
                          ✕
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Chargennummer</label>
                      <input type="text" value={pos.chargeNr} onChange={(e) => updatePosition(idx, "chargeNr", e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Legedatum {mhd && <span className="text-gray-400">(MHD: {mhd})</span>}</label>
                      <input type="date" value={pos.legedatum} onChange={(e) => updatePosition(idx, "legedatum", e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Erzeugercode</label>
                      <input
                        type="text"
                        value={pos.erzeugercode}
                        onChange={(e) => updatePosition(idx, "erzeugercode", e.target.value)}
                        placeholder="1-DE-0357701"
                        className={inputCls}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-6 py-2.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium disabled:opacity-60"
          >
            {saving ? "Speichern…" : "Sortierung speichern"}
          </button>
        </div>
      </div>
    </div>
  );
}
