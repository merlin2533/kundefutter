"use client";
import { useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";

interface KundeVorschau {
  name: string;
  vorname: string | null;
  firma: string | null;
  kategorie: string;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
  telefon: string | null;
  mobil: string | null;
  fax: string | null;
  email: string | null;
  notizen: string | null;
  existierendeId?: number;
}

export default function KundenImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<KundeVorschau[]>([]);
  const [duplikate, setDuplikate] = useState<KundeVorschau[]>([]);
  const [ausgewaehlt, setAusgewaehlt] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [gespeichert, setGespeichert] = useState<number | null>(null);
  const [fehler, setFehler] = useState("");

  async function analysieren() {
    if (!file) return;
    setLoading(true);
    setFehler("");
    setGespeichert(null);
    setVorschau([]);
    setDuplikate([]);

    const fd = new FormData();
    fd.append("file", file);

    try {
      const res = await fetch("/api/kundenimport", { method: "POST", body: fd });
      if (!res.ok) throw new Error();
      const data: { vorschau: KundeVorschau[]; duplikate: KundeVorschau[] } = await res.json();
      setVorschau(data.vorschau);
      setDuplikate(data.duplikate);
      setAusgewaehlt(new Set(data.vorschau.map((_, i) => i)));
    } catch {
      setFehler("Fehler beim Analysieren der Datei.");
    } finally {
      setLoading(false);
    }
  }

  async function bestaetigen() {
    const kunden = vorschau.filter((_, i) => ausgewaehlt.has(i));
    if (kunden.length === 0) return;
    setLoading(true);
    try {
      const res = await fetch("/api/kundenimport", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kunden }),
      });
      if (!res.ok) throw new Error();
      const data: { angelegt: number } = await res.json();
      setGespeichert(data.angelegt);
      setVorschau([]);
      setDuplikate([]);
      setFile(null);
    } catch {
      setFehler("Fehler beim Importieren der Kunden.");
    } finally {
      setLoading(false);
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
        <Link href="/einstellungen/import" className="hover:text-green-700">Import</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Kunden</span>
      </div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Kunden importieren</h1>
        <a
          href="/api/kundenimport"
          download="kunden-import-vorlage.xlsx"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          ⬇ Vorlage herunterladen
        </a>
      </div>

      <Card className="mb-6 max-w-2xl">
        <h2 className="font-semibold mb-3">Excel-Datei hochladen</h2>
        <p className="text-sm text-gray-500 mb-4">
          Unterstützte Formate: <strong>.xlsx, .xls, .csv</strong>
          <br />
          Spalten: <strong>Name</strong> (Pflicht), Vorname, Firma, Straße, PLZ, Ort, Land,
          Telefon, Mobil, Fax, E-Mail, Notizen
          <br />
          <span className="text-gray-400">Leere Spalten bleiben leer. Vorname + Name werden für Privatkunden kombiniert.</span>
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
        {fehler && <p className="text-red-600 text-sm mt-3">{fehler}</p>}
        {gespeichert !== null && (
          <p className="text-green-700 text-sm mt-3 font-medium">
            {gespeichert} Kunde{gespeichert !== 1 ? "n" : ""} erfolgreich importiert!
          </p>
        )}
      </Card>

      {duplikate.length > 0 && (
        <Card className="mb-6 border-yellow-300">
          <h2 className="font-semibold mb-3 text-yellow-700">
            {duplikate.length} Duplikat{duplikate.length !== 1 ? "e" : ""} — Name bereits vorhanden, wird übersprungen
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2">Name</th>
                  <th className="pb-2 hidden sm:table-cell">Firma</th>
                  <th className="pb-2">PLZ / Ort</th>
                  <th className="pb-2 hidden md:table-cell">E-Mail</th>
                </tr>
              </thead>
              <tbody>
                {duplikate.map((d, i) => (
                  <tr key={i} className="border-b last:border-0 bg-yellow-50">
                    <td className="py-1.5">{d.name}</td>
                    <td className="py-1.5 text-gray-500 hidden sm:table-cell">{d.firma ?? "–"}</td>
                    <td className="py-1.5 text-gray-500">{[d.plz, d.ort].filter(Boolean).join(" ") || "–"}</td>
                    <td className="py-1.5 text-gray-500 hidden md:table-cell">{d.email ?? "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {vorschau.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <h2 className="font-semibold">
              {vorschau.length} Kunden gefunden — {ausgewaehlt.size} ausgewählt
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
                {loading ? "Importiere…" : `${ausgewaehlt.size} importieren`}
              </button>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2 w-8">
                    <input type="checkbox" checked={ausgewaehlt.size === vorschau.length} onChange={toggleAlle} />
                  </th>
                  <th className="pb-2">Name</th>
                  <th className="pb-2 hidden sm:table-cell">Firma</th>
                  <th className="pb-2 hidden md:table-cell">Kategorie</th>
                  <th className="pb-2">PLZ / Ort</th>
                  <th className="pb-2 hidden sm:table-cell">Telefon / Mobil</th>
                  <th className="pb-2 hidden lg:table-cell">Fax</th>
                  <th className="pb-2 hidden md:table-cell">E-Mail</th>
                </tr>
              </thead>
              <tbody>
                {vorschau.map((k, i) => (
                  <tr key={i} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2">
                      <input type="checkbox" checked={ausgewaehlt.has(i)} onChange={() => toggleZeile(i)} />
                    </td>
                    <td className="py-2 font-medium">
                      {k.name}
                      <div className="sm:hidden text-xs text-gray-400">{[k.plz, k.ort].filter(Boolean).join(" ")}</div>
                    </td>
                    <td className="py-2 text-gray-600 hidden sm:table-cell">{k.firma ?? "–"}</td>
                    <td className="py-2 text-gray-600 hidden md:table-cell">{k.kategorie}</td>
                    <td className="py-2 text-gray-600">{[k.plz, k.ort].filter(Boolean).join(" ") || "–"}</td>
                    <td className="py-2 text-gray-600 hidden sm:table-cell">{k.telefon ?? k.mobil ?? "–"}</td>
                    <td className="py-2 text-gray-600 hidden lg:table-cell">{k.fax ?? "–"}</td>
                    <td className="py-2 text-gray-600 hidden md:table-cell">{k.email ?? "–"}</td>
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
