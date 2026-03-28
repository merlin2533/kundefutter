"use client";
import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";

interface KundeVorschau {
  name: string;
  firma: string | null;
  kategorie: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
  telefon: string | null;
  mobil: string | null;
  email: string | null;
  notizen: string | null;
  existierendeId?: number;
}

export default function KundenimportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<KundeVorschau[]>([]);
  const [duplikate, setDuplikate] = useState<KundeVorschau[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [gespeichert, setGespeichert] = useState(false);
  const [fehler, setFehler] = useState("");

  async function analysieren() {
    if (!file) return;
    setLoading(true);
    setFehler("");
    setGespeichert(false);
    setVorschau([]);
    setDuplikate([]);

    const fd = new FormData();
    fd.append("file", file);

    const res = await fetch("/api/kundenimport", { method: "POST", body: fd });
    setLoading(false);
    if (!res.ok) {
      setFehler("Fehler beim Analysieren der Datei");
      return;
    }
    const data: { vorschau: KundeVorschau[]; duplikate: KundeVorschau[] } = await res.json();
    setVorschau(data.vorschau);
    setDuplikate(data.duplikate);
    setAusgewaehlt(new Set(data.vorschau.map((_, i) => i)));
  }

  async function bestaetigen() {
    const kunden = vorschau.filter((_, i) => ausgewaehlt.has(i));
    if (kunden.length === 0) return;
    setLoading(true);
    const res = await fetch("/api/kundenimport", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kunden }),
    });
    setLoading(false);
    if (res.ok) {
      setGespeichert(true);
      setVorschau([]);
      setDuplikate([]);
      setFile(null);
    } else {
      setFehler("Fehler beim Importieren der Kunden");
    }
  }

  const toggleAlle = () => {
    if (ausgewaehlt.size === vorschau.length) setAusgewaehlt(new Set());
    else setAusgewaehlt(new Set(vorschau.map((_, i) => i)));
  };

  const toggleZeile = (i: number) => {
    const next = new Set(ausgewaehlt);
    next.has(i) ? next.delete(i) : next.add(i);
    setAusgewaehlt(next);
  };

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <Link href="/einstellungen/stammdaten" className="hover:text-green-700">Stammdaten</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Kundenimport</span>
      </div>
      <h1 className="text-2xl font-bold mb-6">Kundenimport</h1>

      <Card className="mb-6 max-w-xl">
        <h2 className="font-semibold mb-4">Excel-Datei hochladen</h2>
        <p className="text-sm text-gray-500 mb-4">
          Unterstützte Formate: <strong>.xlsx, .xls, .csv</strong>
          <br />
          Spalten: <strong>Name</strong> (Pflicht), Firma, Kategorie, Strasse, PLZ, Ort, Land,
          Telefon, Mobil, Email, Notizen
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Datei auswählen</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              className="w-full border rounded px-3 py-2 text-sm"
            />
          </div>
          <button
            onClick={analysieren}
            disabled={!file || loading}
            className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
          >
            {loading ? "Analysiere…" : "Analysieren"}
          </button>
        </div>
        {fehler && <p className="text-red-600 text-sm mt-2">{fehler}</p>}
        {gespeichert && (
          <p className="text-green-700 text-sm mt-2 font-medium">Kunden erfolgreich importiert!</p>
        )}
      </Card>

      {duplikate.length > 0 && (
        <Card className="mb-6 border-yellow-300">
          <h2 className="font-semibold mb-3 text-yellow-700">
            {duplikate.length} Duplikat{duplikate.length !== 1 ? "e" : ""} (Name bereits vorhanden, wird übersprungen)
          </h2>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b text-xs uppercase">
                <th className="pb-2">Name</th>
                <th className="pb-2">Firma</th>
                <th className="pb-2">PLZ / Ort</th>
                <th className="pb-2">Email</th>
              </tr>
            </thead>
            <tbody>
              {duplikate.map((d, i) => (
                <tr key={i} className="border-b last:border-0 bg-yellow-50">
                  <td className="py-1.5">{d.name}</td>
                  <td className="py-1.5 text-gray-500">{d.firma ?? "–"}</td>
                  <td className="py-1.5 text-gray-500">{[d.plz, d.ort].filter(Boolean).join(" ") || "–"}</td>
                  <td className="py-1.5 text-gray-500">{d.email ?? "–"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {vorschau.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h2 className="font-semibold">
              {vorschau.length} Kunden gefunden – {ausgewaehlt.size} ausgewählt
            </h2>
            <div className="flex gap-2">
              <button onClick={toggleAlle} className="text-sm text-green-700 hover:underline">
                {ausgewaehlt.size === vorschau.length ? "Alle abwählen" : "Alle auswählen"}
              </button>
              <button
                onClick={bestaetigen}
                disabled={ausgewaehlt.size === 0 || loading}
                className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
              >
                {loading ? "Importiere…" : `${ausgewaehlt.size} Kunden importieren`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2 w-8">
                    <input
                      type="checkbox"
                      checked={ausgewaehlt.size === vorschau.length}
                      onChange={toggleAlle}
                    />
                  </th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2">Firma</th>
                  <th className="pb-2">Kategorie</th>
                  <th className="pb-2">PLZ / Ort</th>
                  <th className="pb-2">Telefon</th>
                  <th className="pb-2">Email</th>
                </tr>
              </thead>
              <tbody>
                {vorschau.map((k, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2">
                      <input
                        type="checkbox"
                        checked={ausgewaehlt.has(i)}
                        onChange={() => toggleZeile(i)}
                      />
                    </td>
                    <td className="py-2 font-medium">{k.name}</td>
                    <td className="py-2 text-gray-600">{k.firma ?? "–"}</td>
                    <td className="py-2 text-gray-600">{k.kategorie}</td>
                    <td className="py-2 text-gray-600">
                      {[k.plz, k.ort].filter(Boolean).join(" ") || "–"}
                    </td>
                    <td className="py-2 text-gray-600">{k.telefon ?? k.mobil ?? "–"}</td>
                    <td className="py-2 text-gray-600">{k.email ?? "–"}</td>
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
