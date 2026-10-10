"use client";
import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import BelegVorschau from "@/components/BelegVorschau";
import { useBelegAuswahl } from "@/lib/useBelegAuswahl";
import { BUCHUNGSTYPEN, ZAHLUNGSWEGE } from "@/lib/datev";
import { formatEuro, formatDatum, berechneAusgabeBrutto } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

const FALLBACK_AUSGABEN_KAT = ["Wareneinkauf", "Betriebsbedarf", "Fahrtkosten", "Bürobedarf", "Telefon/Internet", "Versicherung", "Miete", "Personal", "Sonstige"];

interface Ausgabe {
  id: number;
  datum: string;
  belegNr: string | null;
  beschreibung: string;
  betragNetto: number;
  mwstSatz: number;
  betragNetto2: number | null;
  mwstSatz2: number | null;
  betragNetto3: number | null;
  mwstSatz3: number | null;
  kategorie: string;
  buchungstyp: string;
  lieferant: { id: number; name: string } | null;
  bezahltAm: string | null;
  belegPfad: string | null;
  belegDateiname: string | null;
}

function BelegarchivInner() {
  const searchParams = useSearchParams();
  const [ausgaben, setAusgaben] = useState<Ausgabe[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [belegUploading, setBelegUploading] = useState(false);
  const [belegFehler, setBelegFehler] = useState("");

  const today = new Date();
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const firstOfMonth = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-01`;
  const todayStr = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`;

  const [von, setVon] = useState(searchParams.get("von") ?? firstOfMonth);
  const [bis, setBis] = useState(searchParams.get("bis") ?? todayStr);
  const [kategorie, setKategorie] = useState(searchParams.get("kategorie") ?? "Alle");
  const [buchungstyp, setBuchungstyp] = useState("Alle");
  const [zahlungsweg, setZahlungsweg] = useState("Alle");
  const [kategorienList, setKategorienList] = useState<string[]>(FALLBACK_AUSGABEN_KAT);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=ausgaben.")
      .then((r) => r.json())
      .then((d) => {
        if (d["ausgaben.kategorien"]) {
          try {
            const parsed = JSON.parse(d["ausgaben.kategorien"]);
            if (Array.isArray(parsed) && parsed.length) setKategorienList(parsed);
          } catch (err) {
            Sentry.captureException(err);
          }
        }
      })
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
      if (von) params.set("von", von);
      if (bis) params.set("bis", bis);
      if (kategorie && kategorie !== "Alle") params.set("kategorie", kategorie);
      if (buchungstyp && buchungstyp !== "Alle") params.set("buchungstyp", buchungstyp);
      if (zahlungsweg && zahlungsweg !== "Alle") params.set("zahlungsweg", zahlungsweg);
      try {
        const res = await fetch(`/api/ausgaben?${params}`);
        if (!res.ok) { if (!cancelled) setError(`Serverfehler ${res.status}`); return; }
        const json = await res.json();
        if (!cancelled) setAusgaben(json);
      } catch (err) {
        Sentry.captureException(err);
        if (!cancelled) setError("Netzwerkfehler – Seite neu laden");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [von, bis, kategorie, buchungstyp, zahlungsweg]);

  const [selectedId, select] = useBelegAuswahl(ausgaben.map((a) => a.id));
  const ausgewaehlt = ausgaben.find((a) => a.id === selectedId) ?? null;

  async function handleBelegUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !ausgewaehlt) return;
    setBelegUploading(true);
    setBelegFehler("");
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/ausgaben/${ausgewaehlt.id}/beleg`, { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) { setBelegFehler(json.error ?? "Upload fehlgeschlagen"); return; }
      setAusgaben((prev) => prev.map((a) => a.id === ausgewaehlt.id ? { ...a, belegPfad: json.belegPfad, belegDateiname: json.belegDateiname } : a));
    } catch (err) {
      Sentry.captureException(err);
      setBelegFehler("Upload fehlgeschlagen");
    } finally {
      setBelegUploading(false);
    }
  }

  return (
    <div className="max-w-screen-xl mx-auto">
      <div className="mb-4">
        <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
          <Link href="/ausgaben" className="hover:text-green-700">Ausgabenbuch</Link>
          <span>›</span>
          <span className="text-gray-800 font-medium">Belegarchiv</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Belegarchiv</h1>
      </div>

      <div className="bg-white border rounded p-4 mb-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Von</label>
          <input type="date" value={von} onChange={e => setVon(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Bis</label>
          <input type="date" value={bis} onChange={e => setBis(e.target.value)} className="border rounded px-2 py-1 text-sm" />
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Kategorie</label>
          <select value={kategorie} onChange={e => setKategorie(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option key="Alle">Alle</option>
            {kategorienList.map(k => <option key={k}>{k}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Buchungstyp</label>
          <select value={buchungstyp} onChange={e => setBuchungstyp(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option>Alle</option>
            {BUCHUNGSTYPEN.map(bt => <option key={bt}>{bt}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Zahlungsweg</label>
          <select value={zahlungsweg} onChange={e => setZahlungsweg(e.target.value)} className="border rounded px-2 py-1 text-sm">
            <option>Alle</option>
            {ZAHLUNGSWEGE.map(z => <option key={z}>{z}</option>)}
          </select>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-4">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4">
        {/* Liste */}
        <div className="bg-white border rounded overflow-hidden">
          {loading ? (
            <p className="p-6 text-gray-400 text-sm">Lade…</p>
          ) : ausgaben.length === 0 ? (
            <p className="p-6 text-gray-400 text-sm">Keine Ausgaben im gewählten Zeitraum.</p>
          ) : (
            <div className="max-h-[75vh] overflow-y-auto divide-y divide-gray-100">
              {ausgaben.map((a) => (
                <button
                  key={a.id}
                  onClick={() => select(a.id)}
                  className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors ${selectedId === a.id ? "bg-blue-50" : ""}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800 truncate">{a.beschreibung}</span>
                    {!a.belegPfad && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 shrink-0">kein Beleg</span>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-500 truncate">{a.kategorie}{a.lieferant ? ` · ${a.lieferant.name}` : ""}</span>
                    <span className="text-xs text-gray-600 shrink-0">{formatEuro(berechneAusgabeBrutto(a))}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{formatDatum(a.datum)}</span>
                    <Link
                      href={`/ausgaben/${a.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:underline shrink-0"
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
                pfad={ausgewaehlt.belegPfad}
                dateiname={ausgewaehlt.belegDateiname}
                className="h-full"
                emptyAction={
                  <label className="inline-block px-3 py-1.5 text-xs font-medium bg-white hover:bg-gray-50 text-gray-700 rounded-lg border border-gray-300 cursor-pointer">
                    {belegUploading ? "Wird hochgeladen…" : "Jetzt hochladen"}
                    <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleBelegUpload} disabled={belegUploading} />
                  </label>
                }
              />
              {belegFehler && <p className="text-xs text-red-600 mt-1">{belegFehler}</p>}
            </>
          ) : (
            <div className="flex items-center justify-center h-full min-h-[60vh] bg-gray-50 border border-dashed border-gray-300 rounded-xl text-sm text-gray-400">
              Keine Ausgabe ausgewählt.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function BelegarchivPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-gray-400">Lade…</div>}>
      <BelegarchivInner />
    </Suspense>
  );
}
