"use client";
import { useEffect, useState } from "react";
import { Card } from "@/components/Card";
import { formatDatum } from "@/lib/utils";

interface Kontakt {
  typ: string;
  wert: string;
}

interface Artikel {
  name: string;
  einheit: string;
}

interface Position {
  menge: number;
  artikel: Artikel;
}

interface Kunde {
  name: string;
  firma: string | null;
  plz: string | null;
  ort: string | null;
  kontakte: Kontakt[];
}

interface Lieferung {
  id: number;
  datum: string;
  notiz: string | null;
  kunde: Kunde;
  positionen: Position[];
}

function heuteISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function TourenplanungPage() {
  const [datum, setDatum] = useState(heuteISO());
  const [lieferungen, setLieferungen] = useState<Lieferung[]>([]);
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    laden(datum);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datum]);

  async function laden(d: string) {
    setLoading(true);
    setFehler("");
    const res = await fetch(`/api/tourenplanung?datum=${d}`);
    setLoading(false);
    if (!res.ok) {
      setFehler("Fehler beim Laden der Lieferungen");
      return;
    }
    setLieferungen(await res.json());
  }

  function artikelZusammenfassung(positionen: Position[]): string {
    return positionen.map(p => `${p.artikel.name} (${p.menge} ${p.artikel.einheit})`).join(", ");
  }

  function gesamtMenge(positionen: Position[]): number {
    return positionen.reduce((sum, p) => sum + p.menge, 0);
  }

  function tourPDF() {
    window.open(`/api/exporte/tour?datum=${datum}`, "_blank");
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Tourenplanung</h1>

      <Card className="mb-6 max-w-sm">
        <h2 className="font-semibold mb-3">Datum wählen</h2>
        <input
          type="date"
          value={datum}
          onChange={e => setDatum(e.target.value)}
          className="w-full border rounded px-3 py-2 text-sm"
        />
      </Card>

      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg">
          {loading
            ? "Lade…"
            : `${lieferungen.length} geplante Lieferung${lieferungen.length !== 1 ? "en" : ""} am ${formatDatum(datum)}`}
        </h2>
        {lieferungen.length > 0 && (
          <button
            onClick={tourPDF}
            className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800"
          >
            Touren-PDF
          </button>
        )}
      </div>

      {fehler && <p className="text-red-600 text-sm mb-4">{fehler}</p>}

      {!loading && lieferungen.length === 0 && !fehler && (
        <Card>
          <p className="text-gray-500 text-sm">Keine geplanten Lieferungen für diesen Tag.</p>
        </Card>
      )}

      {lieferungen.length > 0 && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2 w-8">Nr.</th>
                  <th className="pb-2">PLZ</th>
                  <th className="pb-2">Ort</th>
                  <th className="pb-2">Kunde</th>
                  <th className="pb-2">Artikel-Zusammenfassung</th>
                  <th className="pb-2 text-right">Menge (gesamt)</th>
                </tr>
              </thead>
              <tbody>
                {lieferungen.map((l, i) => (
                  <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 text-gray-400">{i + 1}</td>
                    <td className="py-2 font-mono text-xs">{l.kunde.plz ?? "–"}</td>
                    <td className="py-2">{l.kunde.ort ?? "–"}</td>
                    <td className="py-2">
                      <div className="font-medium">{l.kunde.firma ?? l.kunde.name}</div>
                      {l.kunde.firma && (
                        <div className="text-xs text-gray-500">{l.kunde.name}</div>
                      )}
                    </td>
                    <td className="py-2 text-gray-600 max-w-xs">
                      {artikelZusammenfassung(l.positionen)}
                    </td>
                    <td className="py-2 text-right font-medium">
                      {gesamtMenge(l.positionen).toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
