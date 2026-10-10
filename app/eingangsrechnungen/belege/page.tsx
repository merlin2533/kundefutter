"use client";
import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import SearchableSelect from "@/components/SearchableSelect";
import BelegVorschau from "@/components/BelegVorschau";
import { useBelegAuswahl } from "@/lib/useBelegAuswahl";
import * as Sentry from "@sentry/nextjs";

interface Lieferant {
  id: number;
  name: string;
  firma: string | null;
}

interface Eingangsrechnung {
  id: number;
  nummer: string;
  datum: string;
  betrag: number;
  mwst: number;
  status: string;
  belegpfad: string | null;
  lieferant: { id: number; name: string; firma: string | null } | null;
}

type Status = "OFFEN" | "BEZAHLT" | "STORNIERT";

const STATUS_COLORS: Record<Status, string> = {
  OFFEN: "bg-yellow-100 text-yellow-800",
  BEZAHLT: "bg-green-100 text-green-800",
  STORNIERT: "bg-gray-100 text-gray-600",
};

const STATUS_LABELS: Record<Status, string> = {
  OFFEN: "Offen",
  BEZAHLT: "Bezahlt",
  STORNIERT: "Storniert",
};

function StatusBadge({ status }: { status: string }) {
  const color = STATUS_COLORS[status as Status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status as Status] ?? status;
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${color}`}>{label}</span>;
}

function BelegarchivInner() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<Eingangsrechnung[]>([]);
  const [loading, setLoading] = useState(true);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [statusFilter, setStatusFilter] = useState(searchParams.get("status") ?? "");
  const [lieferantId, setLieferantId] = useState(searchParams.get("lieferantId") ?? "");
  const [error, setError] = useState("");
  const [belegUploading, setBelegUploading] = useState(false);
  const [belegFehler, setBelegFehler] = useState("");

  useEffect(() => {
    fetch("/api/lieferanten?limit=5000")
      .then((r) => r.json())
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch((err) => {
        Sentry.captureException(err);
      });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (lieferantId) params.set("lieferantId", lieferantId);
      params.set("limit", "5000");
      try {
        const res = await fetch(`/api/eingangsrechnungen?${params}`);
        if (!res.ok) { if (!cancelled) setError(`Serverfehler ${res.status}`); return; }
        const json = await res.json();
        if (!cancelled) setData(Array.isArray(json) ? json : []);
      } catch (err) {
        Sentry.captureException(err);
        if (!cancelled) setError("Netzwerkfehler – Seite neu laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [statusFilter, lieferantId]);

  const [selectedId, select] = useBelegAuswahl(data.map((d) => d.id));
  const ausgewaehlt = data.find((d) => d.id === selectedId) ?? null;

  async function handleBelegUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ausgewaehlt) return;
    setBelegUploading(true);
    setBelegFehler("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/eingangsrechnungen/${ausgewaehlt.id}/beleg`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setBelegFehler(json.error ?? "Upload fehlgeschlagen"); return; }
      setData((prev) => prev.map((d) => d.id === ausgewaehlt.id ? { ...d, belegpfad: json.belegpfad } : d));
    } catch (err) {
      Sentry.captureException(err);
      setBelegFehler("Upload fehlgeschlagen");
    } finally {
      setBelegUploading(false);
    }
  }

  const lieferantenOptions = lieferanten.map((l) => ({
    value: l.id,
    label: l.firma ?? l.name,
    sub: l.firma ? l.name : undefined,
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
            <Link href="/eingangsrechnungen" className="hover:text-green-700">Eingangsrechnungen</Link>
            <span>›</span>
            <span className="text-gray-800 font-medium">Belegarchiv</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Belegarchiv</h1>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 mb-4">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">Alle Status</option>
          {(Object.keys(STATUS_LABELS) as Status[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <div className="w-full sm:w-64">
          <SearchableSelect
            options={lieferantenOptions}
            value={lieferantId}
            onChange={setLieferantId}
            placeholder="Alle Lieferanten"
            allowClear
          />
        </div>
        {(statusFilter || lieferantId) && (
          <button
            onClick={() => { setStatusFilter(""); setLieferantId(""); }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-3 py-2 rounded-lg"
          >
            Filter zurücksetzen
          </button>
        )}
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Liste */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {loading ? (
            <p className="p-6 text-gray-400 text-sm">Lade…</p>
          ) : data.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">Keine Eingangsrechnungen gefunden.</p>
          ) : (
            <div className="max-h-[75vh] overflow-y-auto divide-y divide-gray-100">
              {data.map((item) => (
                <button
                  key={item.id}
                  onClick={() => select(item.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selectedId === item.id ? "bg-green-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-xs text-gray-700 truncate">{item.nummer}</span>
                    <StatusBadge status={item.status} />
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 truncate">
                      {item.lieferant ? (item.lieferant.firma ?? item.lieferant.name) : "—"}
                    </span>
                    <span className="text-xs text-gray-600 shrink-0">
                      {item.betrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{new Date(item.datum).toLocaleDateString("de-DE")}</span>
                    <Link
                      href={`/eingangsrechnungen/${item.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-green-700 hover:underline shrink-0"
                    >
                      Öffnen →
                    </Link>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Vorschau — auf dem Handy ausgeblendet, dort führt "Öffnen →" zur Detailseite */}
        <div className="hidden lg:block">
          {ausgewaehlt ? (
            <>
              <BelegVorschau
                pfad={ausgewaehlt.belegpfad}
                className="h-full"
                emptyAction={
                  <label className="inline-block px-3 py-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 cursor-pointer">
                    {belegUploading ? "Wird hochgeladen…" : "Jetzt hochladen"}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" className="hidden" onChange={handleBelegUpload} disabled={belegUploading} />
                  </label>
                }
              />
              {belegFehler && <p className="text-xs text-red-600 mt-1">{belegFehler}</p>}
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[60vh] bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400">
              Keine Rechnung ausgewählt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BelegarchivPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400">Lade…</div>}>
      <BelegarchivInner />
    </Suspense>
  );
}
