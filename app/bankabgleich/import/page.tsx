"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function BankabgleichImportPage() {
  const router = useRouter();
  const [datei, setDatei] = useState<File | null>(null);
  const [kontoBezeichnung, setKontoBezeichnung] = useState("");
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState("");

  async function importieren(e: React.FormEvent) {
    e.preventDefault();
    if (!datei) {
      setFehler("Bitte eine CSV-Datei auswählen.");
      return;
    }
    setLoading(true);
    setFehler("");

    const formData = new FormData();
    formData.append("datei", datei);
    if (kontoBezeichnung.trim()) {
      formData.append("kontoBezeichnung", kontoBezeichnung.trim());
    }

    try {
      const res = await fetch("/api/bankabgleich", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        setFehler(data.error ?? "Import fehlgeschlagen.");
        setLoading(false);
        return;
      }

      const msg = `${data.importiert} Buchungen importiert${data.duplikate > 0 ? `, ${data.duplikate} Duplikate übersprungen` : ""}.`;
      router.push(`/bankabgleich?erfolg=${encodeURIComponent(msg)}`);
    } catch {
      setFehler("Netzwerkfehler beim Import.");
      setLoading(false);
    }
  }

  return (
    <div className="p-6 max-w-xl mx-auto">
      {/* Breadcrumb / Zurück */}
      <div className="flex items-center gap-2 mb-6 text-sm text-gray-500">
        <Link href="/bankabgleich" className="hover:text-green-700">
          ← Bankabgleich
        </Link>
        <span>/</span>
        <span className="text-gray-800 font-medium">Kontoauszug importieren</span>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Kontoauszug importieren</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <form onSubmit={importieren} className="space-y-5">
          {fehler && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {fehler}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Kontoauszug (CSV / TXT) *
            </label>
            <input
              type="file"
              accept=".csv,.txt"
              onChange={(e) => setDatei(e.target.files?.[0] ?? null)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              required
            />
            <p className="mt-1 text-xs text-gray-400">
              Unterstützte Formate: Sparkasse, Volksbank/Raiffeisen, DKB, ING und weitere.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Konto-Bezeichnung (optional)
            </label>
            <input
              type="text"
              value={kontoBezeichnung}
              onChange={(e) => setKontoBezeichnung(e.target.value)}
              placeholder="Geschäftskonto Sparkasse"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            <p className="mt-1 text-xs text-gray-400">
              Zur Unterscheidung bei mehreren Bankkonten.
            </p>
          </div>

          {datei && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">
              <span className="font-medium">Ausgewählt:</span> {datei.name}{" "}
              <span className="text-gray-400">
                ({(datei.size / 1024).toFixed(1)} KB)
              </span>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading || !datei}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 w-full sm:w-auto"
            >
              {loading ? "Importieren…" : "Importieren"}
            </button>
            <Link
              href="/bankabgleich"
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 w-full sm:w-auto text-center"
            >
              Abbrechen
            </Link>
          </div>
        </form>
      </div>

      {/* Hinweise */}
      <div className="mt-6 bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800">
        <h3 className="font-semibold mb-2">Hinweise zum Import</h3>
        <ul className="space-y-1 text-xs list-disc list-inside">
          <li>Duplikate (gleiche Datum + Betrag + Verwendungszweck) werden automatisch erkannt und übersprungen.</li>
          <li>CSV-Export in Ihrem Online-Banking unter "Kontoumsätze" / "Kontoauszug herunterladen".</li>
          <li>Zeichenkodierung: UTF-8 und ISO-8859-1 (Windows-Zeichensatz) werden automatisch erkannt.</li>
        </ul>
      </div>
    </div>
  );
}
