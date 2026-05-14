"use client";

import { useEffect, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { KundeNotiz } from "../_shared";

const THEMEN = ["Info", "Wichtig", "Offener Punkt", "Erledigt", "Rückruf", "Angebot"];
const THEMA_FARBEN: Record<string, string> = {
  "Info": "bg-blue-50 text-blue-700 border-blue-200",
  "Wichtig": "bg-red-50 text-red-700 border-red-200",
  "Offener Punkt": "bg-orange-50 text-orange-700 border-orange-200",
  "Erledigt": "bg-green-50 text-green-700 border-green-200",
  "Rückruf": "bg-purple-50 text-purple-700 border-purple-200",
  "Angebot": "bg-yellow-50 text-yellow-700 border-yellow-200",
};

export default function NotizenTab({ kundeId }: { kundeId: number }) {
  const { showToast } = useToast();
  const [notizen, setNotizen] = useState<KundeNotiz[]>([]);
  const [themen, setThemen] = useState<string[]>(THEMEN);
  const [newText, setNewText] = useState("");
  const [newThema, setNewThema] = useState("");
  const [loading, setLoading] = useState(true);
  const [filterThema, setFilterThema] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/kunden/${kundeId}/notizen`)
      .then((r) => r.json())
      .then((data) => {
        setNotizen(data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [kundeId]);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.notiz_themen"]) {
          try {
            const parsed = JSON.parse(d["system.notiz_themen"]);
            if (Array.isArray(parsed) && parsed.length) setThemen(parsed);
          } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  async function handleAdd() {
    if (!newText.trim()) return;
    // Optimistic update: add a temporary note immediately
    const tempId = -Date.now();
    const tempNotiz: KundeNotiz = {
      id: tempId,
      kundeId,
      text: newText,
      thema: newThema || null,
      erstellt: new Date().toISOString(),
    };
    setNotizen((prev) => [tempNotiz, ...prev]);
    const savedText = newText;
    const savedThema = newThema;
    setNewText("");
    setNewThema("");
    setSaving(true);
    try {
      const res = await fetch(`/api/kunden/${kundeId}/notizen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: savedText, thema: savedThema || null }),
      });
      if (res.ok) {
        const notiz = await res.json();
        // Replace temp note with real one from server
        setNotizen((prev) => prev.map((n) => (n.id === tempId ? notiz : n)));
        showToast("Notiz gespeichert", "success");
      } else {
        // Revert on error
        setNotizen((prev) => prev.filter((n) => n.id !== tempId));
        setNewText(savedText);
        setNewThema(savedThema);
        showToast("Fehler beim Speichern", "error");
      }
    } catch {
      // Revert on network error
      setNotizen((prev) => prev.filter((n) => n.id !== tempId));
      setNewText(savedText);
      setNewThema(savedThema);
      showToast("Fehler beim Speichern", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(notizId: number) {
    // Optimistic delete
    setNotizen((prev) => prev.filter((n) => n.id !== notizId));
    try {
      const res = await fetch(`/api/kunden/${kundeId}/notizen?notizId=${notizId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Revert: re-fetch to restore
        fetch(`/api/kunden/${kundeId}/notizen`)
          .then((r) => r.json())
          .then(setNotizen)
          .catch(() => {});
        showToast("Fehler beim Löschen", "error");
      }
    } catch {
      fetch(`/api/kunden/${kundeId}/notizen`)
        .then((r) => r.json())
        .then(setNotizen)
        .catch(() => {});
      showToast("Fehler beim Löschen", "error");
    }
  }

  const filtered = filterThema ? notizen.filter((n) => n.thema === filterThema) : notizen;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-800">Notizen</h3>

      {/* Add form */}
      <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
        <textarea
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          placeholder="Neue Notiz eingeben…"
          rows={3}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
        />
        <div className="flex items-center gap-3">
          <select
            value={newThema}
            onChange={(e) => setNewThema(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          >
            <option value="">Kein Thema</option>
            {themen.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <button
            onClick={handleAdd}
            disabled={!newText.trim() || saving}
            className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichern…" : "Notiz hinzufügen"}
          </button>
        </div>
      </div>

      {/* Filter buttons */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setFilterThema(null)}
          className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
            filterThema === null
              ? "bg-gray-800 text-white border-gray-800"
              : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
          }`}
        >
          Alle ({notizen.length})
        </button>
        {themen.map((t) => {
          const count = notizen.filter((n) => n.thema === t).length;
          if (count === 0) return null;
          return (
            <button
              key={t}
              onClick={() => setFilterThema(filterThema === t ? null : t)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                filterThema === t
                  ? "bg-gray-800 text-white border-gray-800"
                  : `${THEMA_FARBEN[t] ?? "bg-gray-50 text-gray-700 border-gray-200"} hover:opacity-80`
              }`}
            >
              {t} ({count})
            </button>
          );
        })}
      </div>

      {/* Notes list */}
      {loading ? (
        <p className="text-sm text-gray-400">Lade Notizen…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-gray-400">Keine Notizen vorhanden.</p>
      ) : (
        <div className="space-y-3">
          {filtered.map((notiz) => (
            <div key={notiz.id} className="border border-gray-200 rounded-lg p-4 bg-white space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">
                    {new Date(notiz.erstellt).toLocaleString("de-DE", {
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                  {notiz.thema && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium border ${
                        THEMA_FARBEN[notiz.thema] ?? "bg-gray-50 text-gray-700 border-gray-200"
                      }`}
                    >
                      {notiz.thema}
                    </span>
                  )}
                </div>
                <button
                  onClick={() => handleDelete(notiz.id)}
                  className="text-gray-400 hover:text-red-500 transition-colors text-sm"
                  title="Notiz löschen"
                >
                  ✕
                </button>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{notiz.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
