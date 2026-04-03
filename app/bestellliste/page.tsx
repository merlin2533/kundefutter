"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Bestellposition {
  id: number;
  menge: number;
  einheit: string;
  einkaufspreis: number;
  status: string;
  bestelltAm: string | null;
  geliefertAm: string | null;
  notiz: string | null;
  createdAt: string;
  lieferant: { id: number; name: string; email: string | null; telefon: string | null };
  artikel: { id: number; name: string; artikelnummer: string; einheit: string };
  kunde: { id: number; name: string; firma: string | null } | null;
  lieferung: { id: number; datum: string } | null;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  offen:     { label: "Offen",     color: "bg-yellow-100 text-yellow-800" },
  bestellt:  { label: "Bestellt",  color: "bg-blue-100 text-blue-800" },
  geliefert: { label: "Geliefert", color: "bg-green-100 text-green-800" },
  storniert: { label: "Storniert", color: "bg-gray-100 text-gray-500" },
};

export default function BestelllistePage() {
  const [positionen, setPositionen] = useState<Bestellposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"offen" | "bestellt" | "alle">("offen");
  const [updating, setUpdating] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const param = statusFilter === "alle" ? "alle" : statusFilter;
    const res = await fetch(`/api/bestellliste?status=${param}`);
    const data = await res.json();
    setPositionen(Array.isArray(data) ? data : []);
    setLoading(false);
  }

  useEffect(() => { load(); }, [statusFilter]);

  async function updateStatus(id: number, status: string) {
    setUpdating(id);
    await fetch(`/api/bestellliste/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    load();
  }

  async function handleDelete(id: number) {
    if (!confirm("Position aus Bestellliste entfernen?")) return;
    setUpdating(id);
    await fetch(`/api/bestellliste/${id}`, { method: "DELETE" });
    setUpdating(null);
    load();
  }

  // Group by Lieferant
  const grouped = positionen.reduce<Record<number, { lieferant: Bestellposition["lieferant"]; items: Bestellposition[] }>>((acc, p) => {
    if (!acc[p.lieferant.id]) acc[p.lieferant.id] = { lieferant: p.lieferant, items: [] };
    acc[p.lieferant.id].items.push(p);
    return acc;
  }, {});

  const totalOffen = positionen.filter((p) => p.status === "offen").length;
  const totalBestellt = positionen.filter((p) => p.status === "bestellt").length;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bestellliste</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalOffen > 0 && <span className="text-yellow-700 font-medium">{totalOffen} offen</span>}
            {totalOffen > 0 && totalBestellt > 0 && <span className="text-gray-400"> · </span>}
            {totalBestellt > 0 && <span className="text-blue-700 font-medium">{totalBestellt} bestellt</span>}
          </p>
        </div>
        <div className="flex gap-1">
          {(["offen", "bestellt", "alle"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${statusFilter === f ? "bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
            >
              {f === "offen" ? "Offen" : f === "bestellt" ? "Bestellt" : "Alle"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Lade…</p>
      ) : positionen.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">Keine Bestellpositionen vorhanden.</p>
          <p className="text-xs mt-1">Erstelle Bestellpositionen durch Annehmen eines Angebots.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(grouped).map(({ lieferant, items }) => {
            const gesamtWert = items.reduce((s, i) => s + i.menge * i.einkaufspreis, 0);
            const offenCount = items.filter((i) => i.status === "offen").length;
            return (
              <div key={lieferant.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Lieferant Header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Link href={`/lieferanten/${lieferant.id}`} className="font-semibold text-gray-900 hover:text-green-700">
                      {lieferant.name}
                    </Link>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      {lieferant.telefon && <span>📞 {lieferant.telefon}</span>}
                      {lieferant.email && <a href={`mailto:${lieferant.email}`} className="hover:text-green-700">✉️ {lieferant.email}</a>}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{items.length} Position{items.length !== 1 ? "en" : ""} · {gesamtWert.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</span>
                    {offenCount > 0 && (
                      <button
                        onClick={() => Promise.all(items.filter((i) => i.status === "offen").map((i) => updateStatus(i.id, "bestellt")))}
                        className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
                      >
                        Alle {offenCount} bestellen
                      </button>
                    )}
                  </div>
                </div>

                {/* Positionen */}
                <div className="divide-y divide-gray-100">
                  {items.map((pos) => {
                    const sc = STATUS_CONFIG[pos.status] ?? STATUS_CONFIG.offen;
                    const isUpdating = updating === pos.id;
                    return (
                      <div key={pos.id} className={`px-5 py-3 flex gap-3 items-start ${isUpdating ? "opacity-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                            <Link href={`/artikel/${pos.artikel.id}`} className="font-medium text-gray-900 hover:text-green-700 text-sm">
                              {pos.artikel.name}
                            </Link>
                            <span className="text-xs text-gray-400 font-mono">{pos.artikel.artikelnummer}</span>
                          </div>
                          <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{pos.menge} {pos.einheit}</span>
                            {pos.einkaufspreis > 0 && (
                              <span>{(pos.menge * pos.einkaufspreis).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} ({pos.einkaufspreis.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}/{pos.einheit})</span>
                            )}
                            {pos.kunde && (
                              <Link href={`/kunden/${pos.kunde.id}`} className="hover:text-green-700">
                                Für: {pos.kunde.firma || pos.kunde.name}
                              </Link>
                            )}
                            {pos.lieferung && (
                              <Link href={`/lieferungen/${pos.lieferung.id}`} className="hover:text-green-700">
                                Lieferung #{pos.lieferung.id}
                              </Link>
                            )}
                          </div>
                          {pos.bestelltAm && (
                            <p className="text-xs text-blue-600 mt-0.5">Bestellt: {new Date(pos.bestelltAm).toLocaleDateString("de-DE")}</p>
                          )}
                          {pos.geliefertAm && (
                            <p className="text-xs text-green-600 mt-0.5">Geliefert: {new Date(pos.geliefertAm).toLocaleDateString("de-DE")}</p>
                          )}
                          {pos.notiz && <p className="text-xs text-gray-500 mt-0.5 italic">{pos.notiz}</p>}
                        </div>
                        <div className="flex flex-col gap-1 items-end shrink-0">
                          {pos.status === "offen" && (
                            <button
                              onClick={() => updateStatus(pos.id, "bestellt")}
                              disabled={isUpdating}
                              className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                            >
                              Bestellen
                            </button>
                          )}
                          {pos.status === "bestellt" && (
                            <button
                              onClick={() => updateStatus(pos.id, "geliefert")}
                              disabled={isUpdating}
                              className="text-xs px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                            >
                              Erhalten
                            </button>
                          )}
                          {pos.status !== "geliefert" && pos.status !== "storniert" && (
                            <button
                              onClick={() => updateStatus(pos.id, "offen")}
                              disabled={isUpdating || pos.status === "offen"}
                              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              Zurücksetzen
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(pos.id)}
                            disabled={isUpdating}
                            className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                          >
                            Entfernen
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
