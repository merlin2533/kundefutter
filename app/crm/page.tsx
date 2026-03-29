"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Aktivitaet {
  id: number;
  typ: string;
  betreff: string;
  inhalt?: string | null;
  datum: string;
  erledigt: boolean;
  faelligAm?: string | null;
  kunde: { id: number; name: string; firma?: string | null };
}

interface Kunde {
  id: number;
  name: string;
  firma?: string | null;
}

const TYP_META: Record<string, { label: string; color: string; icon: string }> = {
  besuch:  { label: "Besuch",  color: "bg-green-100 text-green-800",  icon: "🏠" },
  anruf:   { label: "Anruf",   color: "bg-blue-100 text-blue-800",    icon: "📞" },
  email:   { label: "E-Mail",  color: "bg-yellow-100 text-yellow-800", icon: "✉️" },
  notiz:   { label: "Notiz",   color: "bg-gray-100 text-gray-700",    icon: "📝" },
  aufgabe: { label: "Aufgabe", color: "bg-orange-100 text-orange-800", icon: "✅" },
};

const TYPEN_KEYS = Object.keys(TYP_META);

export default function CrmPage() {
  const [items, setItems] = useState<Aktivitaet[]>([]);
  const [loading, setLoading] = useState(true);
  const [typFilter, setTypFilter] = useState("alle");
  const [searchText, setSearchText] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);

  // Schnellerfassung
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundenLoaded, setKundenLoaded] = useState(false);
  const [schnellKundeId, setSchnellKundeId] = useState<number | "">("");
  const [schnellTyp, setSchnellTyp] = useState("notiz");
  const [schnellBetreff, setSchnellBetreff] = useState("");
  const [schnellSaving, setSchnellSaving] = useState(false);
  const [schnellSuccess, setSchnellSuccess] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/kunden/aktivitaeten?offene=1");
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  useEffect(() => {
    if (!kundenLoaded) {
      fetch("/api/kunden?aktiv=true")
        .then((r) => r.json())
        .then((d) => { setKunden(Array.isArray(d) ? d : []); setKundenLoaded(true); });
    }
  }, [kundenLoaded]);

  async function toggleErledigt(item: Aktivitaet) {
    await fetch(`/api/kunden/aktivitaeten?id=${item.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ erledigt: !item.erledigt }),
    });
    fetchItems();
  }

  async function handleDelete(id: number) {
    setDeleting(id);
    try {
      await fetch(`/api/kunden/aktivitaeten?id=${id}`, { method: "DELETE" });
      fetchItems();
    } finally { setDeleting(null); }
  }

  async function handleSchnellerfassung(e: React.FormEvent) {
    e.preventDefault();
    if (!schnellKundeId || !schnellBetreff.trim()) return;
    setSchnellSaving(true);
    try {
      const res = await fetch("/api/kunden/aktivitaeten", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kundeId: schnellKundeId,
          typ: schnellTyp,
          betreff: schnellBetreff.trim(),
          datum: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        setSchnellBetreff("");
        setSchnellSuccess(true);
        setTimeout(() => setSchnellSuccess(false), 2000);
        fetchItems();
      }
    } finally {
      setSchnellSaving(false);
    }
  }

  const typen = ["alle", ...TYPEN_KEYS];

  // Filter by type and search
  const displayed = items
    .filter((i) => typFilter === "alle" || i.typ === typFilter)
    .filter((i) => {
      if (!searchText.trim()) return true;
      const q = searchText.toLowerCase();
      return (
        i.betreff.toLowerCase().includes(q) ||
        (i.inhalt ?? "").toLowerCase().includes(q) ||
        i.kunde.name.toLowerCase().includes(q) ||
        (i.kunde.firma ?? "").toLowerCase().includes(q)
      );
    });

  const overdueCount = items.filter((i) => i.faelligAm && !i.erledigt && new Date(i.faelligAm) < new Date()).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">CRM – Aktivitäten & Aufgaben</h1>
          <p className="text-sm text-gray-500 mt-0.5">Kundenbesuche, Anrufe, Notizen und offene Aufgaben im Überblick.</p>
          {overdueCount > 0 && (
            <p className="mt-1 text-sm font-medium text-red-600">{overdueCount} überfällige Aufgabe{overdueCount !== 1 ? "n" : ""}</p>
          )}
        </div>
      </div>

      {/* Schnellerfassung */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3">Schnellerfassung</h2>
        <form onSubmit={handleSchnellerfassung} className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="w-full sm:w-56">
            <label className="block text-xs text-gray-500 mb-1">Kunde</label>
            <SearchableSelect
              options={kunden.map((k) => ({
                value: k.id,
                label: k.firma ? `${k.firma} (${k.name})` : k.name,
              }))}
              value={schnellKundeId}
              onChange={(v) => setSchnellKundeId(v ? Number(v) : "")}
              placeholder="Kunde wählen…"
              required
            />
          </div>
          <div className="w-full sm:w-36">
            <label className="block text-xs text-gray-500 mb-1">Typ</label>
            <select
              value={schnellTyp}
              onChange={(e) => setSchnellTyp(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              {TYPEN_KEYS.map((t) => (
                <option key={t} value={t}>{TYP_META[t].icon} {TYP_META[t].label}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 w-full">
            <label className="block text-xs text-gray-500 mb-1">Betreff</label>
            <input
              type="text"
              value={schnellBetreff}
              onChange={(e) => setSchnellBetreff(e.target.value)}
              placeholder="Kurzbeschreibung…"
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <button
            type="submit"
            disabled={schnellSaving || !schnellKundeId || !schnellBetreff.trim()}
            className="w-full sm:w-auto px-4 py-2 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {schnellSaving ? "…" : schnellSuccess ? "✓ Gespeichert" : "Erfassen"}
          </button>
        </form>
      </div>

      {/* Suche + Typ-Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <input
          type="text"
          placeholder="Suche nach Betreff, Inhalt, Kunde…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full sm:w-72 focus:outline-none focus:ring-2 focus:ring-green-600"
        />
        <div className="flex gap-2 flex-wrap">
          {typen.map((t) => (
            <button
              key={t}
              onClick={() => setTypFilter(t)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${typFilter === t ? "bg-green-700 text-white" : "bg-white border border-gray-200 hover:bg-gray-50 text-gray-700"}`}
            >
              {t === "alle" ? "Alle Typen" : TYP_META[t].icon + " " + TYP_META[t].label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-sm">{searchText ? "Keine Treffer für die Suche" : "Keine offenen Aktivitäten"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {displayed.map((item) => {
            const meta = TYP_META[item.typ] ?? TYP_META.notiz;
            const isOverdue = item.faelligAm && !item.erledigt && new Date(item.faelligAm) < new Date();
            return (
              <div
                key={item.id}
                className={`flex gap-3 p-4 rounded-xl border bg-white transition-colors ${isOverdue ? "border-red-200" : "border-gray-200"}`}
              >
                <div className="text-xl leading-none mt-0.5 shrink-0">{meta.icon}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>{meta.label}</span>
                    <Link
                      href={`/kunden/${item.kunde.id}?tab=CRM`}
                      className="text-sm font-medium text-green-700 hover:underline"
                    >
                      {item.kunde.firma ? `${item.kunde.firma} (${item.kunde.name})` : item.kunde.name}
                    </Link>
                    {isOverdue && <span className="text-xs text-red-600 font-medium bg-red-50 px-1.5 py-0.5 rounded">Überfällig</span>}
                  </div>
                  <p className="mt-1 text-sm font-medium text-gray-900">{item.betreff}</p>
                  {item.inhalt && <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{item.inhalt}</p>}
                  <div className="mt-1.5 flex gap-3 text-xs text-gray-400">
                    <span>{new Date(item.datum).toLocaleString("de-DE", { dateStyle: "medium", timeStyle: "short" })}</span>
                    {item.faelligAm && (
                      <span className={isOverdue ? "text-red-500 font-medium" : ""}>
                        Fällig: {new Date(item.faelligAm).toLocaleDateString("de-DE")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1 items-end shrink-0">
                  {item.typ === "aufgabe" && (
                    <button
                      onClick={() => toggleErledigt(item)}
                      className="text-xs px-2 py-1 rounded border border-green-500 text-green-700 hover:bg-green-50 transition-colors"
                    >
                      Erledigen
                    </button>
                  )}
                  <Link
                    href={`/kunden/${item.kunde.id}?tab=CRM`}
                    className="text-xs text-gray-400 hover:text-gray-600"
                  >
                    Zum Kunden →
                  </Link>
                  <button
                    onClick={() => handleDelete(item.id)}
                    disabled={deleting === item.id}
                    className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                  >
                    {deleting === item.id ? "…" : "Löschen"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
