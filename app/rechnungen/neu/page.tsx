"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
}

interface Lieferposition {
  menge: number;
  verkaufspreis: number;
  rabattProzent: number;
  artikel: { name: string; einheit: string | null };
}

interface Lieferung {
  id: number;
  datum: string;
  notiz: string | null;
  positionen: Lieferposition[];
  rechnungNr: string | null;
}

function berechneBetrag(positionen: Lieferposition[]) {
  return positionen.reduce((sum, p) => sum + p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100), 0);
}

export default function NeueRechnungPage() {
  const router = useRouter();
  const [kunden, setKunden] = useState<Kunde[]>([]);
  const [kundeId, setKundeId] = useState("");
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<number[]>([]);
  const [rechnungDatum, setRechnungDatum] = useState(new Date().toISOString().slice(0, 10));
  const [zahlungsziel, setZahlungsziel] = useState(30);
  const [naechsteNr, setNaechsteNr] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Kunden + Standard-Zahlungsziel laden
  useEffect(() => {
    fetch("/api/kunden?aktiv=true")
      .then((r) => r.json())
      .then(setKunden)
      .catch(() => {});
    fetch("/api/einstellungen?prefix=firma.zahlungszielStandard")
      .then((r) => r.json())
      .then((d) => {
        const val = parseInt(d["firma.zahlungszielStandard"] ?? "30", 10);
        if (!isNaN(val) && val >= 0) setZahlungsziel(val);
      })
      .catch(() => {});
  }, []);

  // Nächste Rechnungsnummer vorladen (nur zur Anzeige)
  useEffect(() => {
    fetch("/api/einstellungen?prefix=letzte_rechnungsnummer")
      .then((r) => r.json())
      .then((d) => {
        const letzte: string | null = d["letzte_rechnungsnummer"] ?? null;
        const jahr = new Date().getFullYear();
        if (!letzte) {
          setNaechsteNr(`RE-${jahr}-0001`);
          return;
        }
        const parts = letzte.split("-");
        const letzteJahr = parts.length >= 3 ? parseInt(parts[1]) : 0;
        if (letzteJahr !== jahr) {
          setNaechsteNr(`RE-${jahr}-0001`);
        } else {
          const num = parseInt(parts[parts.length - 1] || "0") + 1;
          setNaechsteNr(`RE-${jahr}-${String(num).padStart(4, "0")}`);
        }
      })
      .catch(() => setNaechsteNr("(wird automatisch vergeben)"));
  }, []);

  // Lieferungen für gewählten Kunden laden (nur ohne Rechnung)
  useEffect(() => {
    if (!kundeId) {
      setLieferungen([]);
      setAusgewaehlt([]);
      return;
    }
    fetch(`/api/lieferungen?kundeId=${kundeId}&status=geliefert&ohneRechnung=true`)
      .then((r) => r.json())
      .then((data: Lieferung[]) => {
        setLieferungen(data);
        // Alle vorauswählen
        setAusgewaehlt(data.map((l) => l.id));
      })
      .catch(() => {});
  }, [kundeId]);

  function toggleLieferung(id: number) {
    setAusgewaehlt((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  const ausgewaehlteLieferungen = lieferungen.filter((l) => ausgewaehlt.includes(l.id));
  const gesamtBetrag = ausgewaehlteLieferungen.reduce(
    (sum, l) => sum + berechneBetrag(l.positionen),
    0
  );

  async function erstellen() {
    if (!kundeId) { setError("Bitte einen Kunden wählen."); return; }
    if (ausgewaehlt.length === 0) { setError("Bitte mindestens eine Lieferung wählen."); return; }
    setSaving(true);
    setError(null);
    try {
      const ids = [...ausgewaehlt];

      // 1. Rechnungsnummer durch PATCH der ersten Lieferung generieren
      const firstRes = await fetch(`/api/lieferungen/${ids[0]}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_erstellen" }),
      });
      if (!firstRes.ok) {
        const d = await firstRes.json();
        setError(d.error ?? `Fehler bei Lieferung ${ids[0]}`);
        return;
      }
      const firstData = await firstRes.json();
      const rechnungNr: string = firstData.rechnungNr;

      // 2. Verbleibende Lieferungen dieselbe Rechnungsnummer direkt setzen (kein rechnung_erstellen)
      const fehler: string[] = [];
      for (const id of ids.slice(1)) {
        const res = await fetch(`/api/lieferungen/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rechnungNr, rechnungDatum: new Date().toISOString() }),
        });
        if (!res.ok) {
          const d = await res.json();
          fehler.push(d.error ?? `Fehler bei Lieferung ${id}`);
        }
      }

      // 3. Vom Nutzer gewähltes Rechnungsdatum und Zahlungsziel auf alle Lieferungen anwenden
      for (const id of ids) {
        await fetch(`/api/lieferungen/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rechnungDatum: rechnungDatum, zahlungsziel }),
        });
      }

      if (fehler.length > 0) {
        setError(fehler.join("; "));
      } else {
        router.push("/rechnungen");
      }
    } catch {
      setError("Unbekannter Fehler beim Erstellen der Rechnung.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="max-w-screen-lg mx-auto px-4 py-8">
      {/* Breadcrumb */}
      <nav className="text-sm text-gray-500 mb-4">
        <Link href="/rechnungen" className="hover:underline text-green-700">Rechnungen</Link>
        {" › "}
        <span className="text-gray-700">Neue Rechnung</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Rechnung erstellen</h1>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-6">
        {/* Kunde */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kunde *</label>
          <SearchableSelect
            options={kunden.map((k) => ({
              value: k.id,
              label: k.name,
              sub: k.firma ?? undefined,
            }))}
            value={kundeId}
            onChange={setKundeId}
            placeholder="Kunde wählen…"
            allowClear
          />
        </div>

        {/* Rechnungsdatum & Zahlungsziel */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechnungsnummer (automatisch)
            </label>
            <input
              type="text"
              readOnly
              value={naechsteNr}
              className="w-full border border-gray-200 bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rechnungsdatum</label>
            <input
              type="date"
              value={rechnungDatum}
              onChange={(e) => setRechnungDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Zahlungsziel (Tage)</label>
            <input
              type="number"
              value={zahlungsziel}
              onChange={(e) => setZahlungsziel(Number(e.target.value))}
              min={0}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        {/* Lieferungen */}
        {kundeId && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Lieferungen ohne Rechnung
            </label>
            {lieferungen.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center border border-dashed border-gray-200 rounded-lg">
                Keine offenen Lieferungen für diesen Kunden.
              </p>
            ) : (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-200">
                      <th className="w-10 px-3 py-2"></th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Datum</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Positionen</th>
                      <th className="text-left px-3 py-2 font-medium text-gray-600">Notiz</th>
                      <th className="text-right px-3 py-2 font-medium text-gray-600">Betrag</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lieferungen.map((l) => (
                      <tr
                        key={l.id}
                        onClick={() => toggleLieferung(l.id)}
                        className={`border-b border-gray-100 cursor-pointer transition-colors ${
                          ausgewaehlt.includes(l.id) ? "bg-green-50" : "hover:bg-gray-50"
                        }`}
                      >
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={ausgewaehlt.includes(l.id)}
                            onChange={() => toggleLieferung(l.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="rounded border-gray-300 text-green-700 focus:ring-green-600"
                          />
                        </td>
                        <td className="px-3 py-2 text-gray-700">{formatDatum(l.datum)}</td>
                        <td className="px-3 py-2 text-gray-700">
                          {l.positionen.map((p, i) => (
                            <span key={i} className="mr-2">
                              {p.menge} {p.artikel.einheit ?? "Stk"} {p.artikel.name}
                            </span>
                          ))}
                        </td>
                        <td className="px-3 py-2 text-gray-400 text-xs">{l.notiz ?? "—"}</td>
                        <td className="px-3 py-2 text-right font-medium text-gray-900">
                          {formatEuro(berechneBetrag(l.positionen))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Zusammenfassung */}
        {ausgewaehlt.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">
              {ausgewaehlt.length} Lieferung{ausgewaehlt.length !== 1 ? "en" : ""} ausgewählt
            </span>
            <span className="text-lg font-bold text-gray-900">{formatEuro(gesamtBetrag)}</span>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* Aktionen */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={erstellen}
            disabled={saving || ausgewaehlt.length === 0}
            className="bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            {saving ? "Wird erstellt…" : "Rechnung erstellen"}
          </button>
          <Link
            href="/rechnungen"
            className="border border-gray-300 text-gray-700 hover:bg-gray-50 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
          >
            Abbrechen
          </Link>
        </div>
      </div>
    </main>
  );
}
