"use client";
import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { MONATE_LANG, getJahreListeNum } from "@/lib/utils";

const MONATE = MONATE_LANG;
const TYP_LABEL: Record<string, string> = { festgehalt: "Festgehalt", minijob: "Minijob", stundenbasis: "Stundenbasis" };

interface Mitarbeiter {
  id: number;
  vorname: string;
  nachname: string;
  typ: string;
  grundgehalt: number | null;
  minijobPauschale: number | null;
  stundenlohn: number | null;
}

function NeuAbrechnungInner() {
  const router = useRouter();
  const params = useSearchParams();
  const now = new Date();

  const [mitarbeiter, setMitarbeiter] = useState<Mitarbeiter[]>([]);
  const [mitarbeiterId, setMitarbeiterId] = useState(params.get("mitarbeiterId") ?? "");
  const [monat, setMonat] = useState(params.get("monat") ? parseInt(params.get("monat")!, 10) : now.getMonth() + 1);
  const [jahr, setJahr] = useState(params.get("jahr") ? parseInt(params.get("jahr")!, 10) : now.getFullYear());
  const [brutto, setBrutto] = useState("");
  const [netto, setNetto] = useState("");
  const [abzuege, setAbzuege] = useState("0");
  const [notiz, setNotiz] = useState("");
  const [saving, setSaving] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/personal/mitarbeiter?aktiv=true")
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setMitarbeiter(Array.isArray(d) ? d : []));
  }, []);

  const selectedMA = mitarbeiter.find((m) => String(m.id) === mitarbeiterId);

  async function handleAutoBerechnen() {
    if (!mitarbeiterId) { setError("Bitte Mitarbeiter auswählen"); return; }
    setCalculating(true);
    setError("");
    try {
      const res = await fetch(`/api/personal/abrechnungen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "abrechnen", mitarbeiterId: parseInt(mitarbeiterId, 10), monat, jahr }),
      });
      const d = await res.json();
      if (!res.ok) {
        setError(d.error ?? "Fehler bei Auto-Berechnung");
      } else {
        router.push(`/personal/abrechnungen`);
      }
    } finally {
      setCalculating(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!mitarbeiterId) { setError("Bitte Mitarbeiter auswählen"); return; }
    const bruttoVal = parseFloat(brutto);
    const nettoVal = parseFloat(netto);
    if (isNaN(bruttoVal) || isNaN(nettoVal)) { setError("Brutto und Netto sind Pflichtfelder"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/personal/abrechnungen", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mitarbeiterId: parseInt(mitarbeiterId, 10),
        monat,
        jahr,
        brutto: bruttoVal,
        netto: nettoVal,
        abzuege: parseFloat(abzuege) || 0,
        notiz: notiz || null,
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json();
      setError(d.error ?? "Fehler beim Speichern");
      return;
    }
    router.push("/personal/abrechnungen");
  }

  // Auto-fill brutto when MA and month are set
  function prefillBrutto() {
    if (!selectedMA) return;
    if (selectedMA.typ === "festgehalt" && selectedMA.grundgehalt) {
      setBrutto(String(selectedMA.grundgehalt));
      setNetto(String(selectedMA.grundgehalt));
    } else if (selectedMA.typ === "minijob" && selectedMA.minijobPauschale) {
      setBrutto(String(selectedMA.minijobPauschale));
      setNetto(String(selectedMA.minijobPauschale));
    }
  }

  useEffect(() => { prefillBrutto(); }, [mitarbeiterId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-lg mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/personal/abrechnungen" className="text-gray-400 hover:text-gray-600 text-sm">
          ← Abrechnungen
        </Link>
        <h1 className="text-xl font-bold">Neue Abrechnung</h1>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border rounded-lg p-6 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mitarbeiter *</label>
          <select
            required
            value={mitarbeiterId}
            onChange={(e) => setMitarbeiterId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Bitte wählen…</option>
            {mitarbeiter.map((m) => (
              <option key={m.id} value={m.id}>
                {m.vorname} {m.nachname} ({TYP_LABEL[m.typ] ?? m.typ})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monat *</label>
            <select
              value={monat}
              onChange={(e) => setMonat(parseInt(e.target.value, 10))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Jahr *</label>
            <select
              value={jahr}
              onChange={(e) => setJahr(parseInt(e.target.value, 10))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
            >
              {getJahreListeNum().map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {selectedMA && selectedMA.typ !== "stundenbasis" && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-green-700">
              Auto-Berechnung verfügbar ({TYP_LABEL[selectedMA.typ]})
            </div>
            <button
              type="button"
              onClick={handleAutoBerechnen}
              disabled={calculating}
              className="text-sm bg-green-700 text-white px-3 py-1 rounded hover:bg-green-800 disabled:opacity-50"
            >
              {calculating ? "Berechne…" : "Auto-Berechnen & Speichern"}
            </button>
          </div>
        )}

        {selectedMA && selectedMA.typ === "stundenbasis" && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center justify-between">
            <div className="text-sm text-blue-700">
              Stundenbasis: Abrechnung aus erfassten Stunden berechnen
            </div>
            <button
              type="button"
              onClick={handleAutoBerechnen}
              disabled={calculating}
              className="text-sm bg-blue-700 text-white px-3 py-1 rounded hover:bg-blue-800 disabled:opacity-50"
            >
              {calculating ? "Berechne…" : "Stunden abrufen & Speichern"}
            </button>
          </div>
        )}

        <div className="border-t pt-4">
          <p className="text-xs text-gray-500 mb-3">Oder manuell erfassen:</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brutto €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={brutto}
                onChange={(e) => {
                  setBrutto(e.target.value);
                  const ab = parseFloat(abzuege) || 0;
                  if (ab > 0 && e.target.value) setNetto(String((parseFloat(e.target.value) - ab).toFixed(2)));
                  else if (e.target.value) setNetto(e.target.value);
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Abzüge €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={abzuege}
                onChange={(e) => {
                  setAbzuege(e.target.value);
                  if (brutto) setNetto(String((parseFloat(brutto) - parseFloat(e.target.value || "0")).toFixed(2)));
                }}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Netto €</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={netto}
                onChange={(e) => setNetto(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
          <input
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <Link href="/personal/abrechnungen" className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving || !brutto || !netto}
            className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50"
          >
            {saving ? "Speichern…" : "Manuell speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function NeuAbrechnungPage() {
  return (
    <Suspense>
      <NeuAbrechnungInner />
    </Suspense>
  );
}
