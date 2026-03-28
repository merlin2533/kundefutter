"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Inventur {
  id: number;
  datum: string;
  status: string;
  bezeichnung: string | null;
  _count: { positionen: number };
}

function StatusBadge({ status }: { status: string }) {
  const cls =
    status === "ABGESCHLOSSEN"
      ? "bg-green-100 text-green-800"
      : "bg-orange-100 text-orange-800";
  const label = status === "ABGESCHLOSSEN" ? "Abgeschlossen" : "Offen";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function InventurPage() {
  const [inventuren, setInventuren] = useState<Inventur[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  async function load() {
    setLoading(true);
    const res = await fetch("/api/inventur");
    const data = await res.json();
    setInventuren(data);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleDelete(id: number) {
    if (!confirm("Inventur wirklich löschen?")) return;
    setDeletingId(id);
    await fetch(`/api/inventur/${id}`, { method: "DELETE" });
    setDeletingId(null);
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <h1 className="text-2xl font-bold">Inventur</h1>
        <Link
          href="/inventur/neu"
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Neue Inventur starten
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Inventuren…</p>
        ) : inventuren.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">
            Noch keine Inventuren vorhanden. Starten Sie jetzt Ihre erste Inventur.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Datum", "Bezeichnung", "Status", "Artikel", ""].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {inventuren.map((inv) => (
                <tr key={inv.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap text-gray-700">
                    {new Date(inv.datum).toLocaleDateString("de-DE")}
                  </td>
                  <td className="px-4 py-3 text-gray-900 font-medium">
                    {inv.bezeichnung ?? <span className="text-gray-400 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={inv.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-600">{inv._count.positionen}</td>
                  <td className="px-4 py-3 flex gap-2 justify-end">
                    <Link
                      href={`/inventur/${inv.id}`}
                      className="text-xs px-2.5 py-1 rounded-lg border border-gray-300 hover:bg-gray-100 text-gray-600 font-medium transition-colors"
                    >
                      Öffnen
                    </Link>
                    {inv.status === "OFFEN" && (
                      <button
                        onClick={() => handleDelete(inv.id)}
                        disabled={deletingId === inv.id}
                        className="text-xs px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 font-medium transition-colors disabled:opacity-50"
                      >
                        {deletingId === inv.id ? "…" : "Löschen"}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
