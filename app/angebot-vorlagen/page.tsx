"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ArtikelInfo {
  id: number;
  name: string;
  einheit: string;
  standardpreis: number;
}

interface VorlagePosition {
  id: number;
  artikelId: number;
  menge: number;
  preis: number;
  rabatt: number;
  einheit: string;
  notiz: string | null;
  artikel: ArtikelInfo;
}

interface AngebotVorlage {
  id: number;
  name: string;
  beschreibung: string | null;
  notiz: string | null;
  aktiv: boolean;
  createdAt: string;
  positionen: VorlagePosition[];
}

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

function formatDatum(iso: string): string {
  return new Date(iso).toLocaleDateString("de-DE");
}

export default function AngebotVorlagenPage() {
  const router = useRouter();
  const [vorlagen, setVorlagen] = useState<AngebotVorlage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Apply-as-Angebot modal state
  const [applyVorlage, setApplyVorlage] = useState<AngebotVorlage | null>(null);
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundenLoading, setKundenLoading] = useState(false);
  const [selectedKundeId, setSelectedKundeId] = useState<string>("");
  const [kundeSearch, setKundeSearch] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/angebot-vorlagen");
      if (!res.ok) throw new Error("Fehler beim Laden");
      const data = await res.json();
      setVorlagen(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Laden");
    } finally {
      setLoading(false);
    }
  }

  async function loadKunden() {
    setKundenLoading(true);
    try {
      const res = await fetch("/api/kunden?limit=500");
      if (res.ok) {
        const d = await res.json();
        setKunden(Array.isArray(d) ? d : (d.kunden ?? []));
      }
    } catch { /* ignore */ } finally {
      setKundenLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Vorlage "${name}" wirklich löschen?`)) return;
    try {
      const res = await fetch(`/api/angebot-vorlagen/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert((d as { error?: string }).error ?? "Fehler beim Löschen");
        return;
      }
      await load();
    } catch {
      alert("Fehler beim Löschen");
    }
  }

  function openApplyModal(vorlage: AngebotVorlage) {
    setApplyVorlage(vorlage);
    setSelectedKundeId("");
    setKundeSearch("");
    setApplyError("");
    if (kunden.length === 0) loadKunden();
  }

  async function handleApply() {
    if (!applyVorlage) return;
    if (!selectedKundeId) { setApplyError("Bitte einen Kunden auswählen."); return; }
    setApplying(true);
    setApplyError("");
    try {
      const res = await fetch(`/api/angebot-vorlagen/${applyVorlage.id}/anwenden`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kundeId: Number(selectedKundeId) }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error ?? "Fehler");
      }
      const angebot = await res.json();
      setApplyVorlage(null);
      router.push(`/angebote/${angebot.id}`);
    } catch (e) {
      setApplyError(e instanceof Error ? e.message : "Fehler beim Erstellen des Angebots");
    } finally {
      setApplying(false);
    }
  }

  const filteredKunden = kunden.filter((k) => {
    const q = kundeSearch.toLowerCase();
    if (!q) return true;
    return (
      k.name.toLowerCase().includes(q) ||
      (k.firma?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div>
      <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
        <h1 className="text-2xl font-bold text-gray-900">Angebots-Vorlagen</h1>
        <Link
          href="/angebot-vorlagen/neu"
          className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Vorlage
        </Link>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-400 py-8 text-center">Lade Vorlagen…</div>
      ) : vorlagen.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 text-center text-gray-400">
          <p className="mb-3">Noch keine Vorlagen angelegt.</p>
          <Link href="/angebot-vorlagen/neu" className="text-green-700 hover:underline font-medium text-sm">
            Erste Vorlage erstellen →
          </Link>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Beschreibung</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Positionen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap hidden md:table-cell">Erstellt</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody>
              {vorlagen.map((v) => (
                <tr key={v.id} className={`border-b last:border-0 hover:bg-gray-50 transition-colors ${!v.aktiv ? "opacity-60" : ""}`}>
                  <td className="px-4 py-3 font-medium">
                    {v.name}
                    {!v.aktiv && (
                      <span className="ml-2 text-xs text-gray-400 font-normal">(inaktiv)</span>
                    )}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{v.beschreibung ?? "—"}</div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">
                    {v.beschreibung ?? <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-xs font-medium">
                      {v.positionen.length}
                    </span>
                    {v.positionen.length > 0 && (
                      <div className="hidden md:block text-xs text-gray-400 mt-0.5 max-w-[200px] truncate">
                        {v.positionen.map((p) => p.artikel.name).join(", ")}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDatum(v.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openApplyModal(v)}
                        className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-medium transition-colors whitespace-nowrap"
                        title="Als Angebot verwenden"
                      >
                        Als Angebot
                      </button>
                      <button
                        onClick={() => handleDelete(v.id, v.name)}
                        className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded text-xs font-medium transition-colors"
                        title="Vorlage löschen"
                      >
                        Löschen
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Apply-as-Angebot Modal */}
      {applyVorlage && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Als Angebot erstellen</h2>
              <button
                onClick={() => setApplyVorlage(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="bg-gray-50 rounded-lg p-3 text-sm">
                <span className="font-medium text-gray-700">{applyVorlage.name}</span>
                <span className="text-gray-500 ml-2">· {applyVorlage.positionen.length} Position(en)</span>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kunde <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={kundeSearch}
                  onChange={(e) => { setKundeSearch(e.target.value); setSelectedKundeId(""); }}
                  placeholder="Kunde suchen…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 mb-1"
                />
                {kundenLoading ? (
                  <p className="text-xs text-gray-400 px-1">Lade Kunden…</p>
                ) : (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredKunden.slice(0, 30).map((k) => (
                      <button
                        key={k.id}
                        type="button"
                        onClick={() => { setSelectedKundeId(String(k.id)); setKundeSearch(k.firma ?? k.name); }}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-green-50 transition-colors border-b border-gray-50 last:border-0 ${
                          selectedKundeId === String(k.id) ? "bg-green-50 text-green-800 font-medium" : "text-gray-700"
                        }`}
                      >
                        {k.firma ? `${k.firma} (${k.name})` : k.name}
                      </button>
                    ))}
                    {filteredKunden.length === 0 && (
                      <p className="text-xs text-gray-400 px-3 py-2">Keine Kunden gefunden</p>
                    )}
                    {filteredKunden.length > 30 && (
                      <p className="text-xs text-gray-400 px-3 py-2">Suche verfeinern…</p>
                    )}
                  </div>
                )}
              </div>
              {applyError && (
                <p className="text-sm text-red-600">{applyError}</p>
              )}
            </div>
            <div className="flex justify-end gap-3 p-5 pt-0">
              <button
                type="button"
                onClick={() => setApplyVorlage(null)}
                className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Abbrechen
              </button>
              <button
                type="button"
                onClick={handleApply}
                disabled={applying || !selectedKundeId}
                className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
              >
                {applying ? "Erstelle Angebot…" : "Angebot erstellen"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
