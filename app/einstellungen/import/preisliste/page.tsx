"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import SearchableSelect from "@/components/SearchableSelect";

interface Lieferant {
  id: number;
  name: string;
}

interface MatchKandidat {
  id: number;
  artikelnummer: string;
  name: string;
  liefergroesse: string | null;
  einheit: string;
  aktuellerEk: number | null;
}

interface ZeileErgebnis {
  quelle: string;
  ekNeu: number;
  match: MatchKandidat | null;
  matchArt: "exakt" | "mitGebinde" | "enthaelt" | "keiner";
  alternativen: MatchKandidat[];
}

interface Vorschau {
  lieferant: Lieferant;
  zeilen: ZeileErgebnis[];
  statistik: { gesamt: number; gefunden: number; offen: number };
}

// Aktion pro Zeile: Artikel-ID (Update) oder "new" (neuen Artikel anlegen)
type Aktion = { art: "update"; artikelId: number } | { art: "neu" };

export default function PreislisteImportPage() {
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [lieferantId, setLieferantId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [vorschau, setVorschau] = useState<Vorschau | null>(null);
  const [aktionen, setAktionen] = useState<Record<number, Aktion>>({});
  const [loading, setLoading] = useState(false);
  const [fehler, setFehler] = useState("");
  const [ergebnis, setErgebnis] = useState<{ aktualisiert: number; neuZuordnung: number; neueArtikel: number; uebersprungen: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/einstellungen/preisliste-import?action=lieferanten")
      .then((r) => r.json())
      .then((d) => setLieferanten(d.lieferanten ?? []))
      .catch(() => setFehler("Lieferanten konnten nicht geladen werden."));
  }, []);

  async function analysieren() {
    if (!file || !lieferantId) return;
    setLoading(true);
    setFehler("");
    setErgebnis(null);
    setVorschau(null);

    const fd = new FormData();
    fd.append("file", file);
    fd.append("lieferantId", lieferantId);

    try {
      const res = await fetch("/api/einstellungen/preisliste-import", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Analysieren");
      setVorschau(data);
      // Treffer direkt als Update vorauswählen
      const initial: Record<number, Aktion> = {};
      data.zeilen.forEach((z: ZeileErgebnis, i: number) => {
        if (z.match) initial[i] = { art: "update", artikelId: z.match.id };
      });
      setAktionen(initial);
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Fehler beim Analysieren der Datei.");
    } finally {
      setLoading(false);
    }
  }

  async function importieren() {
    if (!vorschau) return;
    const updates: { artikelId: number; ekNeu: number }[] = [];
    const neueArtikel: { name: string; ekNeu: number; liefergroesse?: string | null }[] = [];

    vorschau.zeilen.forEach((z, i) => {
      const a = aktionen[i];
      if (!a) return;
      if (a.art === "update") updates.push({ artikelId: a.artikelId, ekNeu: z.ekNeu });
      else neueArtikel.push({ name: z.quelle, ekNeu: z.ekNeu });
    });

    if (updates.length === 0 && neueArtikel.length === 0) return;

    setLoading(true);
    setFehler("");
    try {
      const res = await fetch("/api/einstellungen/preisliste-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferantId: parseInt(lieferantId, 10), updates, neueArtikel }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Import fehlgeschlagen");
      setErgebnis(data);
      setVorschau(null);
      setAktionen({});
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (e) {
      setFehler(e instanceof Error ? e.message : "Import fehlgeschlagen.");
    } finally {
      setLoading(false);
    }
  }

  function setAktion(i: number, aktion: Aktion | null) {
    setAktionen((prev) => {
      const next = { ...prev };
      if (aktion) next[i] = aktion;
      else delete next[i];
      return next;
    });
  }

  const lieferantOptions = lieferanten.map((l) => ({ value: l.id, label: l.name }));
  const anzahlUpdates = Object.values(aktionen).filter((a) => a.art === "update").length;
  const anzahlNeu = Object.values(aktionen).filter((a) => a.art === "neu").length;
  const anzahlGesamt = anzahlUpdates + anzahlNeu;
  const lieferantGewaehlt = !!lieferantId;

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <Link href="/einstellungen/import" className="hover:text-green-700">Import</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Preisliste</span>
      </div>

      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Preisliste importieren</h1>
        <a
          href="/api/einstellungen/preisliste-import?action=template"
          download="preisliste-vorlage.xlsx"
          className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 border border-gray-200 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
        >
          ⬇ Vorlage herunterladen
        </a>
      </div>

      {/* Schritt 1: Lieferant */}
      <Card className="mb-6 max-w-2xl">
        <h2 className="font-semibold mb-1">Schritt 1 — Lieferant auswählen</h2>
        <p className="text-sm text-gray-500 mb-4">
          Alle EK-Preise aus der Preisliste werden diesem Lieferanten zugeordnet.
        </p>
        <SearchableSelect
          options={lieferantOptions}
          value={lieferantId}
          onChange={(v) => {
            setLieferantId(v);
            setVorschau(null);
            setFile(null);
            setErgebnis(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
          }}
          placeholder="Lieferant wählen…"
          required
        />
      </Card>

      {/* Schritt 2: Datei — erst nach Lieferant sichtbar */}
      <Card className={`mb-6 max-w-2xl transition-opacity ${lieferantGewaehlt ? "" : "opacity-50 pointer-events-none"}`}>
        <h2 className="font-semibold mb-1">Schritt 2 — Preisliste hochladen</h2>
        <p className="text-sm text-gray-500 mb-4">
          Simple 2-Spalten-Datei: <strong>Artikel</strong> (mit oder ohne Gebindegröße) und{" "}
          <strong>EK-Preis</strong>. Formate: <strong>.xlsx, .xls, .csv</strong>.
        </p>
        <div className="space-y-3">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            disabled={!lieferantGewaehlt}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full border rounded px-3 py-2 text-sm"
          />
          <button
            onClick={analysieren}
            disabled={!file || !lieferantGewaehlt || loading}
            className="w-full sm:w-auto bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
          >
            {loading && !vorschau ? "Analysiere…" : "Analysieren"}
          </button>
        </div>

        {fehler && <p className="text-red-600 text-sm mt-3">{fehler}</p>}
        {ergebnis && (
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 text-sm text-green-800">
            Import abgeschlossen:{" "}
            <strong>{ergebnis.aktualisiert} aktualisiert</strong>
            {ergebnis.neuZuordnung > 0 && <>, <strong>{ergebnis.neuZuordnung} neu zugeordnet</strong></>}
            {ergebnis.neueArtikel > 0 && <>, <strong>{ergebnis.neueArtikel} neue Artikel angelegt</strong></>}
            , {ergebnis.uebersprungen} übersprungen.
          </div>
        )}
      </Card>

      {/* Schritt 3: Vorschau */}
      {vorschau && (
        <Card>
          <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
            <div>
              <h2 className="font-semibold">Schritt 3 — Vorschau für {vorschau.lieferant.name}</h2>
              <p className="text-sm text-gray-500 mt-1">
                {vorschau.statistik.gesamt} Zeilen ·{" "}
                <span className="text-green-700">{vorschau.statistik.gefunden} zugeordnet</span>
                {vorschau.statistik.offen > 0 && (
                  <span className="text-amber-700"> · {vorschau.statistik.offen} offen</span>
                )}
                {" · "}
                <strong>
                  {anzahlGesamt} ausgewählt ({anzahlUpdates} Update, {anzahlNeu} neu)
                </strong>
              </p>
            </div>
            <button
              onClick={importieren}
              disabled={anzahlGesamt === 0 || loading}
              className="bg-green-700 text-white px-4 py-2 rounded text-sm hover:bg-green-800 disabled:opacity-50"
            >
              {loading ? "Importiere…" : `${anzahlGesamt} übernehmen`}
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 border-b text-xs uppercase">
                  <th className="pb-2">Zeile aus Datei</th>
                  <th className="pb-2">Aktion</th>
                  <th className="pb-2 text-right hidden sm:table-cell">Alt EK</th>
                  <th className="pb-2 text-right">Neu EK</th>
                </tr>
              </thead>
              <tbody>
                {vorschau.zeilen.map((z, i) => {
                  const a = aktionen[i];
                  const aktiv = !!a;
                  const gewaehlteId = a?.art === "update" ? a.artikelId : null;
                  const zugeordnet =
                    gewaehlteId === z.match?.id
                      ? z.match
                      : z.alternativen.find((x) => x.id === gewaehlteId) ?? null;
                  const alt = zugeordnet?.aktuellerEk;

                  // Dropdown-Optionen: match + alternativen + "neu anlegen" + "überspringen"
                  const opts: { key: string; value: string; label: string }[] = [];
                  opts.push({ key: "skip", value: "skip", label: "— Überspringen —" });
                  if (z.match) {
                    opts.push({
                      key: `m${z.match.id}`,
                      value: `u:${z.match.id}`,
                      label: `✓ ${z.match.name}${z.match.liefergroesse ? ` · ${z.match.liefergroesse}` : ""}`,
                    });
                  }
                  for (const alt2 of z.alternativen) {
                    if (z.match?.id === alt2.id) continue;
                    opts.push({
                      key: `a${alt2.id}`,
                      value: `u:${alt2.id}`,
                      label: `${alt2.name}${alt2.liefergroesse ? ` · ${alt2.liefergroesse}` : ""}`,
                    });
                  }
                  opts.push({ key: "new", value: "neu", label: "➕ Neuen Artikel anlegen (Auto-Nummer)" });

                  const currentValue =
                    a?.art === "update" ? `u:${a.artikelId}` : a?.art === "neu" ? "neu" : "skip";

                  return (
                    <tr key={i} className={`border-b last:border-0 ${aktiv ? "bg-green-50/40" : ""}`}>
                      <td className="py-2 align-top">
                        <div className="font-medium text-gray-800">{z.quelle}</div>
                        <div className="text-xs text-gray-400">
                          {z.matchArt === "exakt" && "Exakter Treffer"}
                          {z.matchArt === "mitGebinde" && "Treffer mit Gebinde"}
                          {z.matchArt === "enthaelt" && "Unscharfer Treffer"}
                          {z.matchArt === "keiner" && "Kein Treffer"}
                        </div>
                      </td>
                      <td className="py-2 align-top">
                        <select
                          value={currentValue}
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v === "skip") setAktion(i, null);
                            else if (v === "neu") setAktion(i, { art: "neu" });
                            else if (v.startsWith("u:")) {
                              const id = parseInt(v.slice(2), 10);
                              if (Number.isFinite(id)) setAktion(i, { art: "update", artikelId: id });
                            }
                          }}
                          className="border rounded px-2 py-1 text-xs w-full max-w-md"
                        >
                          {opts.map((o) => (
                            <option key={o.key} value={o.value}>
                              {o.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 align-top text-right text-gray-500 hidden sm:table-cell">
                        {alt !== null && alt !== undefined ? `${alt.toFixed(2)} €` : "–"}
                      </td>
                      <td className="py-2 align-top text-right font-medium text-gray-800">
                        {z.ekNeu.toFixed(2)} €
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
