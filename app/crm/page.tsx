"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";

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

const TYP_META: Record<string, { label: string; color: string; icon: string }> = {
  besuch:  { label: "Besuch",  color: "bg-green-100 text-green-800",  icon: "🏠" },
  anruf:   { label: "Anruf",   color: "bg-blue-100 text-blue-800",    icon: "📞" },
  email:   { label: "E-Mail",  color: "bg-yellow-100 text-yellow-800", icon: "✉️" },
  notiz:   { label: "Notiz",   color: "bg-gray-100 text-gray-700",    icon: "📝" },
  aufgabe: { label: "Aufgabe", color: "bg-orange-100 text-orange-800", icon: "✅" },
};

export default function CrmPage() {
  const [items, setItems] = useState<Aktivitaet[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"offen" | "alle">("offen");
  const [typFilter, setTypFilter] = useState("alle");
  const [deleting, setDeleting] = useState<number | null>(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const url = filter === "offen"
      ? "/api/kunden/aktivitaeten?offene=1"
      : "/api/kunden/aktivitaeten?offene=1"; // TODO: allgemeine Route
    const res = await fetch(url);
    const data = await res.json();
    setItems(Array.isArray(data) ? data : []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

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

  const typen = ["alle", ...Object.keys(TYP_META)];
  const displayed = typFilter === "alle" ? items : items.filter((i) => i.typ === typFilter);
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

      {/* Filters */}
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

      {loading ? (
        <p className="text-sm text-gray-400">Lade…</p>
      ) : displayed.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p className="text-4xl mb-3">✓</p>
          <p className="text-sm">Keine offenen Aktivitäten</p>
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
