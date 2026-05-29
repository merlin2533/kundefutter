"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface MqttRegel {
  id: number;
  name: string;
  source: string;
  topicPattern: string;
  modus: string;
  aktion: string;
  aktiv: boolean;
}

const AKTIONEN: Record<string, { label: string; color: string }> = {
  lieferung:       { label: "Lieferung",       color: "bg-blue-100 text-blue-800" },
  wareneingang:    { label: "Wareneingang",     color: "bg-amber-100 text-amber-800" },
  benachrichtigung:{ label: "Benachrichtigung", color: "bg-purple-100 text-purple-800" },
};

const LEER: Omit<MqttRegel, "id"> = {
  name: "",
  source: "",
  topicPattern: "",
  modus: "ki",
  aktion: "lieferung",
  aktiv: true,
};

export default function MqttAutomatisierungPage() {
  const [regeln, setRegeln] = useState<MqttRegel[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState(LEER);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function laden() {
    setLoading(true);
    const res = await fetch("/api/mqtt-regeln");
    if (res.ok) setRegeln(await res.json());
    setLoading(false);
  }

  useEffect(() => { laden(); }, []);

  function oeffneNeu() {
    setEditId(null);
    setForm(LEER);
    setMsg("");
    setFormOpen(true);
  }

  function oeffneEdit(r: MqttRegel) {
    setEditId(r.id);
    setForm({ name: r.name, source: r.source, topicPattern: r.topicPattern, modus: r.modus, aktion: r.aktion, aktiv: r.aktiv });
    setMsg("");
    setFormOpen(true);
  }

  async function speichern() {
    setSaving(true);
    setMsg("");
    const url = editId !== null ? `/api/mqtt-regeln/${editId}` : "/api/mqtt-regeln";
    const method = editId !== null ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      setFormOpen(false);
      await laden();
    } else {
      const d = await res.json().catch(() => ({})) as { error?: string };
      setMsg(d.error ?? "Fehler beim Speichern");
    }
    setSaving(false);
  }

  async function loeschen(id: number) {
    if (!confirm("Regel wirklich löschen?")) return;
    await fetch(`/api/mqtt-regeln/${id}`, { method: "DELETE" });
    await laden();
  }

  async function exportieren() {
    const blob = new Blob([JSON.stringify(regeln, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "mqtt-regeln.json";
    a.click();
  }

  async function importieren(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const daten = JSON.parse(text) as Partial<MqttRegel>[];
      for (const r of daten) {
        if (!r.name || !r.topicPattern || !r.aktion) continue;
        await fetch("/api/mqtt-regeln", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(r),
        });
      }
      await laden();
    } catch {
      alert("Ungültiges JSON-Format");
    }
    e.target.value = "";
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="text-green-700 hover:underline">Einstellungen</Link>
        <span>/</span>
        <span>MQTT-Automatisierung</span>
      </div>

      <div className="flex items-start gap-4 mb-6">
        <div className="text-3xl">📡</div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">MQTT-Automatisierung</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Regeln für die automatische Verarbeitung eingehender MQTT-Nachrichten per KI
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={exportieren}
          disabled={regeln.length === 0}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 disabled:opacity-40"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
          Export
        </button>
        <label className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 cursor-pointer">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l4-4m0 0l4 4m-4-4v12" /></svg>
          Import
          <input type="file" accept=".json" className="hidden" onChange={importieren} />
        </label>
        <button
          onClick={oeffneNeu}
          className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium ml-auto"
        >
          <span className="text-lg leading-none">+</span>
          Neue Regel
        </button>
      </div>

      {formOpen && (
        <div className="bg-white border border-gray-200 rounded-xl p-5 mb-6 shadow-sm">
          <h2 className="font-semibold text-gray-800 mb-4">{editId !== null ? "Regel bearbeiten" : "Neue Regel"}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="z.B. Alamos"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source / Quelle</label>
              <input
                type="text"
                value={form.source}
                onChange={(e) => setForm((f) => ({ ...f, source: e.target.value }))}
                placeholder="z.B. mqtt://broker.example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Topic Pattern</label>
              <input
                type="text"
                value={form.topicPattern}
                onChange={(e) => setForm((f) => ({ ...f, topicPattern: e.target.value }))}
                placeholder="/extern/alamos/alarm"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Modus</label>
              <select
                value={form.modus}
                onChange={(e) => setForm((f) => ({ ...f, modus: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="ki">KI (automatisch)</option>
                <option value="direkt">Direkt (Rohdaten)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Aktion</label>
              <select
                value={form.aktion}
                onChange={(e) => setForm((f) => ({ ...f, aktion: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                <option value="lieferung">Lieferung erstellen</option>
                <option value="wareneingang">Wareneingang buchen</option>
                <option value="benachrichtigung">Benachrichtigung senden</option>
              </select>
            </div>
            <div className="flex items-center gap-3 pt-5">
              <input
                type="checkbox"
                id="aktiv"
                checked={form.aktiv}
                onChange={(e) => setForm((f) => ({ ...f, aktiv: e.target.checked }))}
                className="w-4 h-4 accent-green-700"
              />
              <label htmlFor="aktiv" className="text-sm font-medium text-gray-700">Regel aktiv</label>
            </div>
          </div>
          {msg && <p className="text-sm text-red-600 mt-3">{msg}</p>}
          <div className="flex gap-3 mt-4">
            <button
              onClick={speichern}
              disabled={saving}
              className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Speichern…" : "Speichern"}
            </button>
            <button
              onClick={() => setFormOpen(false)}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Abbrechen
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="text-sm text-gray-500 py-8 text-center">Lade Regeln…</div>
      ) : regeln.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm">Noch keine MQTT-Regeln angelegt.</p>
          <button onClick={oeffneNeu} className="mt-3 text-sm text-green-700 hover:underline">
            Erste Regel erstellen
          </button>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Name</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 hidden sm:table-cell">Source</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500 hidden md:table-cell">Topic Pattern</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Modus</th>
                <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Aktion</th>
                <th className="text-right px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {regeln.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="font-medium text-gray-900">{r.name}</span>
                    {!r.aktiv && <span className="ml-2 text-xs text-gray-400">(inaktiv)</span>}
                    <div className="sm:hidden text-xs text-gray-400 mt-0.5">{r.source || "—"}</div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    {r.source ? (
                      <span className="font-mono text-xs text-gray-600 bg-gray-100 px-2 py-0.5 rounded">{r.source}</span>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="font-mono text-xs text-gray-700 bg-gray-100 px-2 py-0.5 rounded">{r.topicPattern}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.modus === "ki" ? (
                      <span className="inline-flex items-center gap-1 text-xs bg-slate-800 text-white px-2 py-0.5 rounded-full">
                        🤖 KI
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">Direkt</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {AKTIONEN[r.aktion] ? (
                      <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${AKTIONEN[r.aktion].color}`}>
                        {AKTIONEN[r.aktion].label}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-500">{r.aktion}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => oeffneEdit(r)} className="text-xs text-green-700 hover:underline mr-3">
                      Bearbeiten
                    </button>
                    <button onClick={() => loeschen(r.id)} className="text-xs text-red-600 hover:underline">
                      Löschen
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
