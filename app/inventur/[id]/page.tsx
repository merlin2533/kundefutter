"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

interface ArtikelInfo {
  id: number;
  name: string;
  einheit: string;
  artikelnummer: string;
  aktuellerBestand: number;
}

interface Position {
  id: number;
  inventurId: number;
  artikelId: number;
  artikel: ArtikelInfo;
  sollBestand: number;
  istBestand: number | null;
  differenz: number | null;
  bemerkung: string | null;
}

interface Inventur {
  id: number;
  datum: string;
  status: string;
  bezeichnung: string | null;
  positionen: Position[];
}

type ViewMode = "alle" | "differenzen";

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

function DifferenzCell({ diff }: { diff: number | null }) {
  if (diff === null) return <span className="text-gray-400">—</span>;
  if (diff === 0) return <span className="text-gray-400 font-mono">0</span>;
  if (diff > 0)
    return <span className="text-green-700 font-mono font-medium">+{diff.toLocaleString("de-DE", { maximumFractionDigits: 3 })}</span>;
  return <span className="text-red-600 font-mono font-medium">{diff.toLocaleString("de-DE", { maximumFractionDigits: 3 })}</span>;
}

export default function InventurDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [inventur, setInventur] = useState<Inventur | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<ViewMode>("alle");
  const [localValues, setLocalValues] = useState<Record<number, { istBestand: string; bemerkung: string }>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [closing, setClosing] = useState(false);
  const [printMode, setPrintMode] = useState<"leer" | "ergebnis">("ergebnis");
  const printModeRef = useRef(printMode);
  printModeRef.current = printMode;

  const fetchInventur = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/inventur/${id}`);
    if (res.ok) {
      const data: Inventur = await res.json();
      setInventur(data);
      // initialize local values
      const init: Record<number, { istBestand: string; bemerkung: string }> = {};
      for (const pos of data.positionen) {
        init[pos.id] = {
          istBestand: pos.istBestand !== null ? String(pos.istBestand) : "",
          bemerkung: pos.bemerkung ?? "",
        };
      }
      setLocalValues(init);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchInventur();
  }, [fetchInventur]);

  function handleChange(posId: number, field: "istBestand" | "bemerkung", value: string) {
    setLocalValues((prev) => ({
      ...prev,
      [posId]: { ...prev[posId], [field]: value },
    }));
    setSaveSuccess(false);
  }

  async function handleBlur(posId: number) {
    if (!inventur || inventur.status !== "OFFEN") return;
    const v = localValues[posId];
    if (v === undefined) return;
    const pos = inventur.positionen.find((p) => p.id === posId);
    if (!pos) return;
    const istBestand = v.istBestand !== "" ? parseFloat(v.istBestand) : null;
    if (istBestand === null) return;
    await fetch(`/api/inventur/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        positionen: [{ id: posId, istBestand, bemerkung: v.bemerkung || undefined }],
      }),
    });
    // Refresh to get updated differenz
    const res = await fetch(`/api/inventur/${id}`);
    if (res.ok) {
      const data: Inventur = await res.json();
      setInventur(data);
    }
  }

  async function handleSaveAll() {
    if (!inventur) return;
    setSaving(true);
    setSaveError("");
    setSaveSuccess(false);

    const positionen = inventur.positionen
      .map((pos) => {
        const v = localValues[pos.id];
        if (!v || v.istBestand === "") return null;
        return {
          id: pos.id,
          istBestand: parseFloat(v.istBestand),
          bemerkung: v.bemerkung || undefined,
        };
      })
      .filter(Boolean) as Array<{ id: number; istBestand: number; bemerkung?: string }>;

    if (positionen.length === 0) {
      setSaveError("Keine Ist-Bestände zum Speichern.");
      setSaving(false);
      return;
    }

    const res = await fetch(`/api/inventur/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ positionen }),
    });

    if (res.ok) {
      const data: Inventur = await res.json();
      setInventur(data);
      setSaveSuccess(true);
    } else {
      const d = await res.json().catch(() => ({}));
      setSaveError(d.error ?? "Fehler beim Speichern.");
    }
    setSaving(false);
  }

  async function handleClose(bucheKorrekturen: boolean) {
    if (!inventur) return;
    setClosing(true);
    const res = await fetch(`/api/inventur/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "ABGESCHLOSSEN", bucheKorrekturen }),
    });
    if (res.ok) {
      await fetchInventur();
    }
    setClosing(false);
  }

  function handlePrint(mode: "leer" | "ergebnis") {
    setPrintMode(mode);
    // Small timeout to let state update propagate to DOM
    setTimeout(() => {
      document.body.setAttribute("data-print-mode", mode);
      window.print();
      document.body.removeAttribute("data-print-mode");
    }, 50);
  }

  if (loading) {
    return <p className="p-6 text-gray-400 text-sm">Lade Inventur…</p>;
  }
  if (!inventur) {
    return (
      <div className="p-6">
        <p className="text-red-600 text-sm">Inventur nicht gefunden.</p>
        <Link href="/inventur" className="text-sm text-green-800 underline mt-2 inline-block">
          Zurück zur Übersicht
        </Link>
      </div>
    );
  }

  const isOffen = inventur.status === "OFFEN";
  const displayedPositionen =
    viewMode === "differenzen"
      ? inventur.positionen.filter((p) => p.differenz !== null && p.differenz !== 0)
      : inventur.positionen;

  const datumStr = new Date(inventur.datum).toLocaleDateString("de-DE");
  const printTitle = `Inventurliste — ${inventur.bezeichnung ?? "Inventur"} — ${datumStr}`;

  return (
    <>
      {/* Print-only title */}
      <div className="print-only hidden">
        <h2 className="text-xl font-bold mb-4">{printTitle}</h2>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          [data-print-mode="leer"] .hide-in-leerliste { visibility: hidden; }
        }
      `}</style>

      {/* Header */}
      <div className="no-print flex items-center gap-3 mb-6 flex-wrap">
        <Link href="/inventur" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Zurück
        </Link>
        <div className="flex-1 flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold">
            {inventur.bezeichnung ?? `Inventur #${inventur.id}`}
          </h1>
          <StatusBadge status={inventur.status} />
          <span className="text-sm text-gray-500">{datumStr}</span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => handlePrint("leer")}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Leerliste drucken
          </button>
          <button
            onClick={() => handlePrint("ergebnis")}
            className="text-sm px-3 py-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-700 transition-colors"
          >
            Ergebnisliste drucken
          </button>

          {isOffen && (
            <>
              <button
                onClick={() => {
                  if (confirm("Inventur abschließen ohne Lagerkorrekturen zu buchen?")) {
                    handleClose(false);
                  }
                }}
                disabled={closing}
                className="text-sm px-3 py-1.5 rounded-lg border border-orange-300 hover:bg-orange-50 text-orange-700 transition-colors disabled:opacity-50"
              >
                {closing ? "…" : "Abschließen"}
              </button>
              <button
                onClick={() => {
                  if (confirm("Inventur abschließen und Lagerkorrekturen für alle Differenzen automatisch buchen?")) {
                    handleClose(true);
                  }
                }}
                disabled={closing}
                className="text-sm px-3 py-1.5 rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium transition-colors disabled:opacity-50"
              >
                {closing ? "…" : "Abschließen + Korrekturen buchen"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* View toggle */}
      <div className="no-print flex gap-2 mb-4">
        {([
          { key: "alle", label: "Erfassungsliste" },
          { key: "differenzen", label: "Nur Differenzen" },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setViewMode(key)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors font-medium ${
              viewMode === key
                ? "bg-green-800 text-white border-green-800"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Save bar */}
      {isOffen && (
        <div className="no-print flex items-center gap-3 mb-4 flex-wrap">
          <button
            onClick={handleSaveAll}
            disabled={saving}
            className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-60 transition-colors"
          >
            {saving ? "Speichern…" : "Alle speichern"}
          </button>
          {saveError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-1">
              {saveError}
            </p>
          )}
          {saveSuccess && (
            <p className="text-sm text-green-700 bg-green-50 border border-green-200 rounded px-3 py-1">
              Gespeichert.
            </p>
          )}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {displayedPositionen.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">
            {viewMode === "differenzen"
              ? "Keine Positionen mit Differenzen."
              : "Keine Positionen vorhanden."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Art.-Nr.", "Artikel", "Einheit", "Soll-Bestand", "Ist-Bestand", "Differenz", "Bemerkung"].map((h) => (
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
              {displayedPositionen.map((pos) => {
                const v = localValues[pos.id] ?? { istBestand: "", bemerkung: "" };
                return (
                  <tr key={pos.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-2 text-gray-500 font-mono text-xs">
                      {pos.artikel.artikelnummer}
                    </td>
                    <td className="px-4 py-2 font-medium text-gray-900">{pos.artikel.name}</td>
                    <td className="px-4 py-2 text-gray-600">{pos.artikel.einheit}</td>
                    <td className="px-4 py-2 font-mono text-gray-700">
                      {pos.sollBestand.toLocaleString("de-DE", { maximumFractionDigits: 3 })}
                    </td>
                    <td className="px-4 py-2 hide-in-leerliste">
                      {isOffen ? (
                        <input
                          type="number"
                          step="0.01"
                          value={v.istBestand}
                          onChange={(e) => handleChange(pos.id, "istBestand", e.target.value)}
                          onBlur={() => handleBlur(pos.id)}
                          placeholder="—"
                          className="w-28 border border-gray-300 rounded px-2 py-1 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-700"
                        />
                      ) : (
                        <span className="font-mono">
                          {pos.istBestand !== null
                            ? pos.istBestand.toLocaleString("de-DE", { maximumFractionDigits: 3 })
                            : <span className="text-gray-400">—</span>}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <DifferenzCell diff={pos.differenz} />
                    </td>
                    <td className="px-4 py-2">
                      {isOffen ? (
                        <input
                          type="text"
                          value={v.bemerkung}
                          onChange={(e) => handleChange(pos.id, "bemerkung", e.target.value)}
                          onBlur={() => handleBlur(pos.id)}
                          placeholder="—"
                          className="w-40 border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                        />
                      ) : (
                        <span className="text-gray-600">{pos.bemerkung ?? <span className="text-gray-400">—</span>}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
