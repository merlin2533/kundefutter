"use client";
import { useEffect, useState, useCallback } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { formatDatum } from "@/lib/utils";

interface ArtikelOption {
  id: number;
  name: string;
  artikelnummer: string;
  einheit: string;
}

interface Umbuchung {
  id: number;
  datum: string;
  notiz?: string | null;
  lagerortVon?: string | null;
  lagerortNach?: string | null;
  artikel: { id: number; name: string; einheit: string };
}

const inputCls =
  "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

export default function UmbuchungenPage() {
  const [artikel, setArtikel] = useState<ArtikelOption[]>([]);
  const [lagerorte, setLagerorte] = useState<string[]>([]);
  const [umbuchungen, setUmbuchungen] = useState<Umbuchung[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [form, setForm] = useState({
    artikelId: "",
    menge: "",
    vonLagerort: "",
    nachLagerort: "",
    bemerkung: "",
  });

  // For free-text lagerort entry
  const [vonCustom, setVonCustom] = useState("");
  const [nachCustom, setNachCustom] = useState("");
  const [vonMode, setVonMode] = useState<"select" | "custom">("select");
  const [nachMode, setNachMode] = useState<"select" | "custom">("select");

  const fetchArtikel = useCallback(async () => {
    const res = await fetch("/api/artikel?limit=500");
    const data = await res.json();
    setArtikel(data);
  }, []);

  const fetchLagerorte = useCallback(async () => {
    const res = await fetch("/api/lager/lagerorte");
    const data = await res.json();
    setLagerorte(data);
  }, []);

  const fetchUmbuchungen = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/lager/umbuchungen");
    const data = await res.json();
    setUmbuchungen(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchArtikel();
    fetchLagerorte();
    fetchUmbuchungen();
  }, [fetchArtikel, fetchLagerorte, fetchUmbuchungen]);

  const artikelOptions = artikel.map((a) => ({
    value: String(a.id),
    label: a.name,
    sub: a.artikelnummer,
  }));

  const lagerortOptions = [
    ...lagerorte.map((l) => ({ value: l, label: l })),
    { value: "__custom__", label: "Neuer Ort eingeben…" },
  ];

  const selectedArtikel = artikel.find((a) => String(a.id) === form.artikelId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const vonLagerort = vonMode === "custom" ? vonCustom.trim() : form.vonLagerort;
    const nachLagerort = nachMode === "custom" ? nachCustom.trim() : form.nachLagerort;

    if (!form.artikelId) { setError("Bitte einen Artikel auswählen."); return; }
    if (!form.menge || Number(form.menge) <= 0) { setError("Menge muss größer als 0 sein."); return; }
    if (!vonLagerort) { setError("Von-Lagerort ist erforderlich."); return; }
    if (!nachLagerort) { setError("Nach-Lagerort ist erforderlich."); return; }
    if (vonLagerort === nachLagerort) { setError("Von- und Nach-Lagerort dürfen nicht gleich sein."); return; }

    setSaving(true);
    try {
      const res = await fetch("/api/lager/umbuchungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: Number(form.artikelId),
          menge: Number(form.menge),
          vonLagerort,
          nachLagerort,
          bemerkung: form.bemerkung.trim() || undefined,
        }),
      });
      if (res.ok) {
        setSuccess("Umbuchung erfolgreich durchgeführt.");
        setForm({ artikelId: "", menge: "", vonLagerort: "", nachLagerort: "", bemerkung: "" });
        setVonCustom("");
        setNachCustom("");
        setVonMode("select");
        setNachMode("select");
        fetchUmbuchungen();
        fetchLagerorte();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error ?? "Fehler beim Speichern.");
      }
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Umbuchungen (Lagerorte)</h1>
      </div>

      {/* Form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 max-w-2xl mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-5">Neue Umbuchung</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
          {success && (
            <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
              {success}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Artikel <span className="text-red-500">*</span>
            </label>
            <SearchableSelect
              options={artikelOptions}
              value={form.artikelId}
              onChange={(v) => setForm({ ...form, artikelId: v })}
              placeholder="— Artikel wählen —"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Von Lagerort <span className="text-red-500">*</span>
              </label>
              {vonMode === "custom" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={vonCustom}
                    onChange={(e) => setVonCustom(e.target.value)}
                    placeholder="z.B. Halle 1"
                    className={inputCls}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setVonMode("select"); setVonCustom(""); }}
                    className="text-xs px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 whitespace-nowrap"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <SearchableSelect
                  options={lagerortOptions}
                  value={form.vonLagerort}
                  onChange={(v) => {
                    if (v === "__custom__") { setVonMode("custom"); setForm({ ...form, vonLagerort: "" }); }
                    else setForm({ ...form, vonLagerort: v });
                  }}
                  placeholder="— Lagerort wählen —"
                  allowClear
                  clearLabel="— Kein Lagerort —"
                />
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nach Lagerort <span className="text-red-500">*</span>
              </label>
              {nachMode === "custom" ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nachCustom}
                    onChange={(e) => setNachCustom(e.target.value)}
                    placeholder="z.B. Außenlager"
                    className={inputCls}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => { setNachMode("select"); setNachCustom(""); }}
                    className="text-xs px-2 py-1 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 whitespace-nowrap"
                  >
                    Abbrechen
                  </button>
                </div>
              ) : (
                <SearchableSelect
                  options={lagerortOptions}
                  value={form.nachLagerort}
                  onChange={(v) => {
                    if (v === "__custom__") { setNachMode("custom"); setForm({ ...form, nachLagerort: "" }); }
                    else setForm({ ...form, nachLagerort: v });
                  }}
                  placeholder="— Lagerort wählen —"
                  allowClear
                  clearLabel="— Kein Lagerort —"
                />
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Menge{selectedArtikel ? ` (${selectedArtikel.einheit})` : ""} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              value={form.menge}
              onChange={(e) => setForm({ ...form, menge: e.target.value })}
              placeholder="0"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bemerkung</label>
            <input
              type="text"
              value={form.bemerkung}
              onChange={(e) => setForm({ ...form, bemerkung: e.target.value })}
              placeholder="Optional…"
              className={inputCls}
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60 transition-colors"
            >
              {saving ? "Wird gespeichert…" : "Umbuchung durchführen"}
            </button>
          </div>
        </form>
      </div>

      {/* List */}
      <h2 className="text-lg font-semibold text-gray-900 mb-3">Letzte Umbuchungen</h2>
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Umbuchungen…</p>
        ) : umbuchungen.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">Noch keine Umbuchungen vorhanden.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Datum", "Artikel", "Von → Nach", "Notiz"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {umbuchungen.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-600">{formatDatum(u.datum)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{u.artikel.name}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center gap-1.5 text-sm">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded text-xs font-medium">
                        {u.lagerortVon ?? "—"}
                      </span>
                      <span className="text-gray-400">→</span>
                      <span className="px-2 py-0.5 bg-green-50 text-green-800 border border-green-200 rounded text-xs font-medium">
                        {u.lagerortNach ?? "—"}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 text-sm">{u.notiz ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
