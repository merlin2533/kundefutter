"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { formatDatum } from "@/lib/utils";

interface Position {
  id: number;
  menge: number;
  artikel: { name: string; einheit: string };
}

interface Lieferung {
  id: number;
  datum: string;
  status: string;
  kunde: { name: string; firma?: string | null };
  positionen: Position[];
}

export default function QrLieferungPage() {
  const { id } = useParams<{ id: string }>();
  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [logo, setLogo] = useState<string | null>(null);
  const [firmaName, setFirmaName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [lRes, eRes, logoRes] = await Promise.all([
          fetch(`/api/lieferungen/${id}`),
          fetch("/api/einstellungen?prefix=firma."),
          fetch("/api/einstellungen?prefix=system.logo"),
        ]);
        if (!lRes.ok) throw new Error("Lieferung nicht gefunden");
        const lData: Lieferung = await lRes.json();
        const eData: { key: string; value: string }[] = await eRes.json();
        const logoData: { key: string; value: string }[] = await logoRes.json();

        setLieferung(lData);

        for (const e of eData) {
          if (e.key === "firma.name" || e.key === "firma.firmenname") {
            setFirmaName(e.value);
          }
        }
        const logoEntry = logoData.find((e) => e.key === "system.logo");
        if (logoEntry?.value) setLogo(logoEntry.value);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Laden");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  async function handleConfirm() {
    if (!lieferung) return;
    setConfirming(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "geliefert" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Fehler beim Bestätigen");
      setLieferung(data);
      setConfirmed(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fehler beim Bestätigen");
    } finally {
      setConfirming(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-gray-500 text-lg">Lade Lieferung…</div>
      </div>
    );
  }

  if (error && !lieferung) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <div className="text-red-600 font-semibold text-lg">{error}</div>
        </div>
      </div>
    );
  }

  if (!lieferung) return null;

  const isGeplant = lieferung.status === "geplant";
  const isGeliefert = lieferung.status === "geliefert";
  const isStorniert = lieferung.status === "storniert";

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-start p-4 pt-8">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md overflow-hidden">

        {/* Header mit Logo */}
        <div className="bg-green-700 text-white px-6 py-5 flex items-center gap-4">
          {logo ? (
            <Image
              src={logo}
              alt="Logo"
              width={48}
              height={48}
              className="rounded object-contain bg-white p-1"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 rounded bg-green-600 flex items-center justify-center text-2xl font-bold">
              {firmaName ? firmaName[0] : "A"}
            </div>
          )}
          <div>
            {firmaName && <div className="text-sm text-green-200">{firmaName}</div>}
            <div className="font-bold text-xl">Lieferbestätigung</div>
          </div>
        </div>

        {/* Lieferdaten */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="flex justify-between items-start mb-3">
            <div>
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Lieferschein</div>
              <div className="font-bold text-2xl text-gray-800">Nr. {lieferung.id}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Datum</div>
              <div className="font-semibold text-gray-700">{formatDatum(lieferung.datum)}</div>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Empfänger</div>
            <div className="font-semibold text-gray-800">{lieferung.kunde.name}</div>
            {lieferung.kunde.firma && <div className="text-gray-600 text-sm">{lieferung.kunde.firma}</div>}
          </div>
        </div>

        {/* Positionen */}
        <div className="px-6 py-5 border-b border-gray-100">
          <div className="text-xs text-gray-500 uppercase tracking-wide mb-3">Gelieferte Artikel</div>
          <div className="space-y-2">
            {lieferung.positionen.map((pos, idx) => (
              <div key={pos.id} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-gray-400 text-sm w-5">{idx + 1}.</span>
                  <span className="text-gray-800 font-medium">{pos.artikel.name}</span>
                </div>
                <span className="text-gray-600 font-semibold whitespace-nowrap ml-2">
                  {pos.menge.toLocaleString("de-DE")} {pos.artikel.einheit}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Status-Bereich */}
        <div className="px-6 py-6">
          {/* Bereits storniert */}
          {isStorniert && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-center">
              <div className="text-4xl mb-3">🚫</div>
              <div className="font-bold text-red-700 text-lg">Lieferung storniert</div>
              <div className="text-red-600 text-sm mt-1">Diese Lieferung wurde storniert und kann nicht bestätigt werden.</div>
            </div>
          )}

          {/* Bereits geliefert */}
          {isGeliefert && !confirmed && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-4xl mb-3">✅</div>
              <div className="font-bold text-green-700 text-lg">Bereits bestätigt</div>
              <div className="text-green-600 text-sm mt-1">
                Diese Lieferung wurde bereits als geliefert bestätigt.
              </div>
            </div>
          )}

          {/* Gerade bestätigt */}
          {confirmed && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
              <div className="text-5xl mb-3">✅</div>
              <div className="font-bold text-green-700 text-xl">Lieferung bestätigt!</div>
              <div className="text-green-600 text-sm mt-2">
                Vielen Dank. Die Lieferung wurde erfolgreich bestätigt.
              </div>
            </div>
          )}

          {/* Fehler beim Bestätigen */}
          {error && isGeplant && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4 text-center">
              <div className="text-red-600 text-sm">{error}</div>
            </div>
          )}

          {/* Bestätigen-Button */}
          {isGeplant && !confirmed && (
            <button
              onClick={handleConfirm}
              disabled={confirming}
              className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-green-400 text-white font-bold text-xl rounded-xl py-5 px-6 transition-colors shadow-md disabled:cursor-not-allowed"
            >
              {confirming ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Wird bestätigt…
                </span>
              ) : (
                "Lieferung bestätigen"
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
