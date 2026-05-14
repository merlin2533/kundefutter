"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import { useToast } from "@/components/ToastProvider";

interface Futterwert {
  name: string;
  gruppe: string;
  tmGehalt: number;
  me?: number; nel?: number; rohprotein?: number; nxp?: number; dp?: number;
  rohfaser?: number; andfom?: number; lysin?: number; methionin?: number;
  ca?: number; p?: number; mg?: number; na?: number;
}

const FELDER: { key: keyof Futterwert; label: string }[] = [
  { key: "tmGehalt", label: "TM g/kg" },
  { key: "me", label: "ME MJ" },
  { key: "nel", label: "NEL MJ" },
  { key: "rohprotein", label: "XP g" },
  { key: "nxp", label: "nXP g" },
  { key: "dp", label: "DP g" },
  { key: "rohfaser", label: "XF g" },
  { key: "andfom", label: "aNDFom g" },
  { key: "lysin", label: "Lysin g" },
  { key: "methionin", label: "Methionin g" },
  { key: "ca", label: "Ca g" },
  { key: "p", label: "P g" },
  { key: "mg", label: "Mg g" },
  { key: "na", label: "Na g" },
];

function leererEintrag(): Futterwert {
  return { name: "", gruppe: "Sonstiges", tmGehalt: 880 };
}

export default function FutterwertePage() {
  const toast = useToast();
  const [standard, setStandard] = useState<Futterwert[]>([]);
  const [custom, setCustom] = useState<Futterwert[]>([]);
  const [gruppen, setGruppen] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/futterwerte")
      .then((r) => r.json())
      .then((d) => {
        setStandard(Array.isArray(d.standard) ? d.standard : []);
        setCustom(Array.isArray(d.custom) ? d.custom : []);
        setGruppen(Array.isArray(d.gruppen) ? d.gruppen : []);
      })
      .catch(() => toast.error("Laden fehlgeschlagen"))
      .finally(() => setLoading(false));
  }, [toast]);

  function setCustomFeld(i: number, key: keyof Futterwert, value: string) {
    setCustom((cs) =>
      cs.map((c, idx) => {
        if (idx !== i) return c;
        if (key === "name" || key === "gruppe") return { ...c, [key]: value };
        const num = value === "" ? undefined : Number(value);
        return { ...c, [key]: num };
      }),
    );
  }

  async function speichern() {
    setSaving(true);
    try {
      const res = await fetch("/api/futterwerte", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ custom }),
      });
      if (!res.ok) { toast.error("Speichern fehlgeschlagen"); return; }
      const d = await res.json();
      toast.success(`${d.anzahl} eigene Futtermittel gespeichert`);
    } catch {
      toast.error("Netzwerkfehler");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-2">
        <Link href="/einstellungen" className="text-sm text-gray-500 hover:underline">← Einstellungen</Link>
      </div>
      <h1 className="text-2xl font-bold mb-1">🌾 Futterwerte</h1>
      <p className="text-sm text-gray-500 mb-6">
        Eigene Futtermittel für die <Link href="/rationsberechnung" className="text-green-700 underline">Rationsberechnung</Link>.
        Alle Nähr-/Mineralstoffwerte je <strong>kg Trockenmasse</strong>, TM-Gehalt in g/kg Frischmasse.
      </p>

      {loading ? (
        <p className="text-gray-400">Lade…</p>
      ) : (
        <>
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold">Eigene Futtermittel ({custom.length})</h2>
              <div className="flex gap-2">
                <button onClick={() => setCustom([...custom, leererEintrag()])} className="text-sm bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700">+ Eintrag</button>
                <button onClick={speichern} disabled={saving} className="text-sm bg-green-700 text-white px-4 py-1 rounded hover:bg-green-800 disabled:opacity-50">
                  {saving ? "Speichere…" : "Speichern"}
                </button>
              </div>
            </div>
            {custom.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Noch keine eigenen Futtermittel — Standardtabelle wird verwendet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="text-xs">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-1 pr-2">Name</th>
                      <th className="py-1 pr-2">Gruppe</th>
                      {FELDER.map((f) => <th key={f.key} className="py-1 pr-2 text-right">{f.label}</th>)}
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {custom.map((c, i) => (
                      <tr key={i} className="border-b">
                        <td className="py-1 pr-2">
                          <input value={c.name} onChange={(e) => setCustomFeld(i, "name", e.target.value)} className="border rounded px-1.5 py-1 w-40" placeholder="Name" />
                        </td>
                        <td className="py-1 pr-2">
                          <select value={c.gruppe} onChange={(e) => setCustomFeld(i, "gruppe", e.target.value)} className="border rounded px-1 py-1">
                            {gruppen.map((g) => <option key={g} value={g}>{g}</option>)}
                          </select>
                        </td>
                        {FELDER.map((f) => (
                          <td key={f.key} className="py-1 pr-2">
                            <input
                              type="number"
                              step="0.1"
                              value={(c[f.key] as number | undefined) ?? ""}
                              onChange={(e) => setCustomFeld(i, f.key, e.target.value)}
                              className="border rounded px-1 py-1 w-16 text-right"
                            />
                          </td>
                        ))}
                        <td className="py-1">
                          <button onClick={() => setCustom(custom.filter((_, idx) => idx !== i))} className="text-red-600 px-1">✕</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card>
            <h2 className="font-semibold mb-3">Standard-Futterwerttabelle ({standard.length})</h2>
            <p className="text-xs text-gray-500 mb-3">
              Eingebaute Orientierungswerte (LfL-/DLG-angelehnt) — schreibgeschützt. Für eigene Werte oben einen Eintrag anlegen.
            </p>
            <div className="overflow-x-auto">
              <table className="text-xs">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-1 pr-2">Name</th>
                    <th className="py-1 pr-2">Gruppe</th>
                    {FELDER.map((f) => <th key={f.key} className="py-1 pr-2 text-right">{f.label}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {standard.map((s) => (
                    <tr key={s.name} className="border-b">
                      <td className="py-1 pr-2">{s.name}</td>
                      <td className="py-1 pr-2 text-gray-500">{s.gruppe}</td>
                      {FELDER.map((f) => (
                        <td key={f.key} className="py-1 pr-2 text-right">{(s[f.key] as number | undefined) ?? "–"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
