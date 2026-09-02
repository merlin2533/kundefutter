"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";
import { formatEuro } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

interface ArtikelListe {
  id: number;
  name: string;
  artikelnummer: string;
  kategorie: string;
  aktiv: boolean;
}

interface ArtikelVoll {
  id: number;
  artikelnummer: string;
  name: string;
  kategorie: string;
  unterkategorie: string | null;
  einheit: string;
  beschreibung: string | null;
  notiz: string | null;
  standardpreis: number;
  preisStand: string | null;
  mwstSatz: number;
  mindestbestand: number;
  aktuellerBestand: number;
  lagerort: string | null;
  liefergroesse: string | null;
  chargePflicht: boolean;
  sprengstoffvorlaeufer: boolean;
  lagerTracking: boolean;
  ghsKlassen: string | null;
  hSaetze: string | null;
  pSaetze: string | null;
  signalwort: string | null;
}

interface Anzahl {
  inhaltsstoffe: number; dokumente: number; lieferanten: number; preisHistorie: number;
  jahrespreise: number; kundePreise: number; bedarfe: number; lieferpositionen: number;
  wareineingangPos: number; lagerbewegungen: number; retourePositionen: number; mengenrabatte: number;
  inventurPositionen: number; angebotPositionen: number; gutschriftPositionen: number;
  bestellpositionen: number; bestellungPositionen: number; kontraktPositionen: number;
  kampagneArtikel: number; angebotVorlagePositionen: number; chargenZertifikate: number;
  vorbestellungPositionen: number; fruehbezugStaffeln: number; anlieferungen: number;
  benachrichtigungen: number; einkaufStatus: number;
}

interface Preview {
  ziel: ArtikelVoll;
  quelle: ArtikelVoll;
  anzahl: { ziel: Anzahl; quelle: Anzahl };
  konflikte: { lieferanten: number; jahrespreise: number; kundePreise: number; bedarfe: number; kampagnen: number };
  lagerbestandSumme: number;
}

const ANZAHL_LABELS: { key: keyof Anzahl; label: string }[] = [
  { key: "lieferpositionen", label: "Lieferpositionen" },
  { key: "angebotPositionen", label: "Angebotspositionen" },
  { key: "bestellpositionen", label: "Bestellliste-Positionen" },
  { key: "bestellungPositionen", label: "Bestellungspositionen" },
  { key: "vorbestellungPositionen", label: "Vorbestellungspositionen" },
  { key: "kontraktPositionen", label: "Kontraktpositionen" },
  { key: "gutschriftPositionen", label: "Gutschriftpositionen" },
  { key: "wareineingangPos", label: "Wareneingangspositionen" },
  { key: "retourePositionen", label: "Retourepositionen" },
  { key: "lagerbewegungen", label: "Lagerbewegungen" },
  { key: "inventurPositionen", label: "Inventurpositionen" },
  { key: "lieferanten", label: "Lieferanten-Zuordnungen" },
  { key: "jahrespreise", label: "Jahrespreise" },
  { key: "kundePreise", label: "Kunden-Sonderpreise" },
  { key: "bedarfe", label: "Kunden-Bedarfe" },
  { key: "mengenrabatte", label: "Mengenstaffeln" },
  { key: "fruehbezugStaffeln", label: "Frühbezugs-Staffeln" },
  { key: "kampagneArtikel", label: "Kampagnen-Zuordnungen" },
  { key: "anlieferungen", label: "Anlieferungen" },
  { key: "chargenZertifikate", label: "Chargen-Zertifikate" },
  { key: "angebotVorlagePositionen", label: "Angebotsvorlagen-Positionen" },
  { key: "inhaltsstoffe", label: "Inhaltsstoffe" },
  { key: "dokumente", label: "Dokumente" },
  { key: "preisHistorie", label: "Preishistorie-Einträge" },
  { key: "einkaufStatus", label: "Einkauf-Status-Einträge" },
  { key: "benachrichtigungen", label: "Benachrichtigungen" },
];

type FeldWahl = "ziel" | "quelle";

// Verkaufspreis (Preis+Stand) und Gefahrstoffkennzeichnung werden als Gruppe behandelt, damit
// z.B. nicht der Preis vom Ziel, aber das Preisdatum von der Quelle übernommen wird.
const EINZEL_FELDER: { key: keyof ArtikelVoll; label: string }[] = [
  { key: "artikelnummer", label: "Artikelnummer" },
  { key: "name", label: "Name" },
  { key: "kategorie", label: "Kategorie" },
  { key: "unterkategorie", label: "Unterkategorie" },
  { key: "einheit", label: "Einheit" },
  { key: "beschreibung", label: "Beschreibung" },
  { key: "notiz", label: "Notiz" },
  { key: "mindestbestand", label: "Mindestbestand" },
  { key: "lagerort", label: "Lagerort" },
  { key: "liefergroesse", label: "Liefergröße" },
];
const BOOL_FELDER: { key: keyof ArtikelVoll; label: string }[] = [
  { key: "chargePflicht", label: "Chargennummer Pflicht" },
  { key: "sprengstoffvorlaeufer", label: "Sprengstoffvorläufer" },
  { key: "lagerTracking", label: "Lagerbestand tracken" },
];

function anzeigeWert(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Ja" : "Nein";
  return String(v);
}

function leer(v: unknown): boolean {
  return v === null || v === undefined || v === "";
}

function preisAnzeige(a: ArtikelVoll): string {
  const preis = formatEuro(a.standardpreis);
  const stand = a.preisStand ? new Date(a.preisStand).toLocaleDateString("de-DE") : null;
  return stand ? `${preis} (Stand: ${stand})` : preis;
}

function gefahrstoffAnzeige(a: ArtikelVoll): string {
  const teile = [
    a.signalwort,
    a.ghsKlassen ? `GHS: ${a.ghsKlassen}` : null,
    a.hSaetze ? `H: ${a.hSaetze}` : null,
    a.pSaetze ? `P: ${a.pSaetze}` : null,
  ].filter(Boolean);
  return teile.length ? teile.join(" · ") : "";
}

function FeldRadio({
  feldKey, label, ziel, quelle, wahl, setWahl,
}: {
  feldKey: string; label: string; ziel: string; quelle: string;
  wahl: Record<string, FeldWahl>;
  setWahl: React.Dispatch<React.SetStateAction<Record<string, FeldWahl>>>;
}) {
  return (
    <tr className="border-b border-gray-100">
      <td className="px-3 py-2 text-sm font-medium text-gray-700 whitespace-nowrap">{label}</td>
      <td className="px-3 py-2 text-sm">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name={feldKey}
            checked={wahl[feldKey] !== "quelle"}
            onChange={() => setWahl((w) => ({ ...w, [feldKey]: "ziel" }))}
            className="mt-0.5"
          />
          <span className={leer(ziel) ? "text-gray-400" : "text-gray-800"}>{anzeigeWert(ziel)}</span>
        </label>
      </td>
      <td className="px-3 py-2 text-sm">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="radio"
            name={feldKey}
            checked={wahl[feldKey] === "quelle"}
            onChange={() => setWahl((w) => ({ ...w, [feldKey]: "quelle" }))}
            className="mt-0.5"
          />
          <span className={leer(quelle) ? "text-gray-400" : "text-gray-800"}>{anzeigeWert(quelle)}</span>
        </label>
      </td>
    </tr>
  );
}

export default function ArtikelVerschmelzenPage() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<ArtikelListe[]>([]);
  const [ladeArtikel, setLadeArtikel] = useState(true);
  const [artikelAId, setArtikelAId] = useState<string>("");
  const [artikelBId, setArtikelBId] = useState<string>("");
  const [zielIstA, setZielIstA] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ladePreview, setLadePreview] = useState(false);
  const [previewFehler, setPreviewFehler] = useState("");
  const [wahl, setWahl] = useState<Record<string, FeldWahl>>({});
  const [bestaetigt, setBestaetigt] = useState(false);
  const [speichern, setSpeichern] = useState(false);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    fetch("/api/artikel?limit=5000")
      .then((r) => r.json())
      .then((data) => setArtikel(Array.isArray(data) ? data : []))
      .catch((err) => {
        Sentry.captureException(err);
        return setArtikel([]);
      })
      .finally(() => setLadeArtikel(false));
  }, []);

  const zielId = zielIstA ? artikelAId : artikelBId;
  const quelleId = zielIstA ? artikelBId : artikelAId;

  useEffect(() => {
    setPreview(null);
    setPreviewFehler("");
    setBestaetigt(false);
    setFehler("");
    if (!zielId || !quelleId || zielId === quelleId) return;
    setLadePreview(true);
    fetch(`/api/artikel/merge?zielId=${zielId}&quelleId=${quelleId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch((err) => {
            Sentry.captureException(err);
            return ({});
          });
          throw new Error(err.error ?? "Vorschau fehlgeschlagen");
        }
        return res.json();
      })
      .then((data: Preview) => {
        setPreview(data);
        // Default-Auswahl: nicht-leerer Wert gewinnt, sonst Ziel-Artikel
        const defaults: Record<string, FeldWahl> = {};
        for (const { key } of [...EINZEL_FELDER, ...BOOL_FELDER]) {
          const zielLeer = leer(data.ziel[key]);
          const quelleLeer = leer(data.quelle[key]);
          defaults[key as string] = zielLeer && !quelleLeer ? "quelle" : "ziel";
        }
        defaults.preis = data.ziel.standardpreis === 0 && data.quelle.standardpreis !== 0 ? "quelle" : "ziel";
        const zielGefahrLeer = !gefahrstoffAnzeige(data.ziel);
        const quelleGefahrLeer = !gefahrstoffAnzeige(data.quelle);
        defaults.gefahrstoff = zielGefahrLeer && !quelleGefahrLeer ? "quelle" : "ziel";
        setWahl(defaults);
      })
      .catch((err) => {
        Sentry.captureException(err);
        return setPreviewFehler(err.message ?? "Vorschau fehlgeschlagen");
      })
      .finally(() => setLadePreview(false));
  }, [zielId, quelleId]);

  const optionenA = useMemo(
    () => artikel.filter((a) => String(a.id) !== artikelBId).map((a) => ({ value: a.id, label: a.name, sub: [a.artikelnummer, a.kategorie, !a.aktiv ? "inaktiv" : null].filter(Boolean).join(" · ") })),
    [artikel, artikelBId]
  );
  const optionenB = useMemo(
    () => artikel.filter((a) => String(a.id) !== artikelAId).map((a) => ({ value: a.id, label: a.name, sub: [a.artikelnummer, a.kategorie, !a.aktiv ? "inaktiv" : null].filter(Boolean).join(" · ") })),
    [artikel, artikelAId]
  );

  async function verschmelzen() {
    if (!preview) return;
    setFehler("");
    setSpeichern(true);
    try {
      const felder: Record<string, unknown> = {};
      for (const { key } of EINZEL_FELDER) {
        felder[key] = wahl[key as string] === "quelle" ? preview.quelle[key] : preview.ziel[key];
      }
      for (const { key } of BOOL_FELDER) {
        felder[key] = wahl[key as string] === "quelle" ? preview.quelle[key] : preview.ziel[key];
      }
      const preisQuelle = wahl.preis === "quelle";
      felder.standardpreis = preisQuelle ? preview.quelle.standardpreis : preview.ziel.standardpreis;
      felder.preisStand = preisQuelle ? preview.quelle.preisStand : preview.ziel.preisStand;
      felder.mwstSatz = preisQuelle ? preview.quelle.mwstSatz : preview.ziel.mwstSatz;
      const gefahrQuelle = wahl.gefahrstoff === "quelle";
      const gefahrQuelleObj = gefahrQuelle ? preview.quelle : preview.ziel;
      felder.ghsKlassen = gefahrQuelleObj.ghsKlassen;
      felder.hSaetze = gefahrQuelleObj.hSaetze;
      felder.pSaetze = gefahrQuelleObj.pSaetze;
      felder.signalwort = gefahrQuelleObj.signalwort;

      const res = await fetch("/api/artikel/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zielId: preview.ziel.id, quelleId: preview.quelle.id, felder }),
      });
      const data = await res.json().catch((err) => {
        Sentry.captureException(err);
        return ({});
      });
      if (!res.ok) {
        setFehler(data.error ?? "Zusammenführen fehlgeschlagen");
        return;
      }
      router.push(`/artikel/${preview.ziel.id}`);
    } catch (err) {
      Sentry.captureException(err);
      setFehler("Netzwerkfehler beim Zusammenführen");
    } finally {
      setSpeichern(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/artikel" className="text-gray-400 hover:text-green-700">← Zurück zur Artikelliste</Link>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Artikel zusammenführen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Zwei Artikel-Datensätze auswählen, die denselben Artikel doppelt abbilden (z.B. weil ein Import
        eine abweichende Schreibweise angelegt hat). Alle Lieferpositionen, Preise, Lagerbewegungen usw.
        werden auf den Ziel-Artikel übertragen; der andere Artikel wird danach endgültig gelöscht.
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Artikel A</label>
            <SearchableSelect
              options={optionenA}
              value={artikelAId}
              onChange={setArtikelAId}
              placeholder={ladeArtikel ? "Lade Artikel…" : "Artikel A auswählen…"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Artikel B</label>
            <SearchableSelect
              options={optionenB}
              value={artikelBId}
              onChange={setArtikelBId}
              placeholder={ladeArtikel ? "Lade Artikel…" : "Artikel B auswählen…"}
            />
          </div>
        </div>

        {artikelAId && artikelBId && artikelAId !== artikelBId && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="text-gray-600">Bleibt erhalten (Ziel):</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setZielIstA(true)}
                className={`px-3 py-1.5 transition-colors ${zielIstA ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Artikel A
              </button>
              <button
                type="button"
                onClick={() => setZielIstA(false)}
                className={`px-3 py-1.5 transition-colors border-l border-gray-300 ${!zielIstA ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Artikel B
              </button>
            </div>
          </div>
        )}
        {artikelAId && artikelBId && artikelAId === artikelBId && (
          <p className="mt-4 text-sm text-red-600">Bitte zwei unterschiedliche Artikel auswählen.</p>
        )}
      </div>

      {ladePreview && (
        <div className="flex items-center gap-3 p-6 text-gray-400 text-sm">
          <div className="w-4 h-4 border-2 border-green-500 border-t-transparent rounded-full animate-spin shrink-0" />
          Lade Vorschau…
        </div>
      )}

      {previewFehler && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm border bg-red-50 border-red-200 text-red-700">{previewFehler}</div>
      )}

      {preview && (
        <>
          <div className="mb-4 px-4 py-3 rounded-lg text-sm bg-blue-50 border border-blue-200 text-blue-800">
            Lagerbestand wird immer zusammengezählt: {preview.lagerbestandSumme.toLocaleString("de-DE")}{" "}
            {wahl.einheit === "quelle" ? preview.quelle.einheit : preview.ziel.einheit}
            {" "}({preview.ziel.aktuellerBestand.toLocaleString("de-DE")} + {preview.quelle.aktuellerBestand.toLocaleString("de-DE")}) — kein Bestand geht verloren.
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-6">
            <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 text-sm font-medium text-gray-600">
              Welche Werte sollen übernommen werden?
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50/50">
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Feld</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Ziel: {preview.ziel.name}</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Quelle: {preview.quelle.name} (wird gelöscht)</th>
                  </tr>
                </thead>
                <tbody>
                  {EINZEL_FELDER.map(({ key, label }) => (
                    <FeldRadio
                      key={key}
                      feldKey={key}
                      label={label}
                      ziel={String(preview.ziel[key] ?? "")}
                      quelle={String(preview.quelle[key] ?? "")}
                      wahl={wahl}
                      setWahl={setWahl}
                    />
                  ))}
                  <FeldRadio
                    feldKey="preis"
                    label="Verkaufspreis"
                    ziel={preisAnzeige(preview.ziel)}
                    quelle={preisAnzeige(preview.quelle)}
                    wahl={wahl}
                    setWahl={setWahl}
                  />
                  {BOOL_FELDER.map(({ key, label }) => (
                    <FeldRadio
                      key={key}
                      feldKey={key}
                      label={label}
                      ziel={anzeigeWert(preview.ziel[key])}
                      quelle={anzeigeWert(preview.quelle[key])}
                      wahl={wahl}
                      setWahl={setWahl}
                    />
                  ))}
                  {(gefahrstoffAnzeige(preview.ziel) || gefahrstoffAnzeige(preview.quelle)) && (
                    <FeldRadio
                      feldKey="gefahrstoff"
                      label="Gefahrstoffkennzeichnung"
                      ziel={gefahrstoffAnzeige(preview.ziel)}
                      quelle={gefahrstoffAnzeige(preview.quelle)}
                      wahl={wahl}
                      setWahl={setWahl}
                    />
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <h2 className="text-sm font-medium text-gray-700 mb-3">
              Diese Datensätze von &quot;{preview.quelle.name}&quot; werden auf &quot;{preview.ziel.name}&quot; übertragen:
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-1.5 text-sm">
              {ANZAHL_LABELS.filter(({ key }) => preview.anzahl.quelle[key] > 0).map(({ key, label }) => (
                <div key={key} className="flex justify-between text-gray-600">
                  <span>{label}</span>
                  <span className="font-medium text-gray-900">{preview.anzahl.quelle[key]}</span>
                </div>
              ))}
              {ANZAHL_LABELS.every(({ key }) => preview.anzahl.quelle[key] === 0) && (
                <span className="text-gray-400">Keine verknüpften Datensätze</span>
              )}
            </div>

            {(preview.konflikte.lieferanten > 0 || preview.konflikte.jahrespreise > 0 || preview.konflikte.kundePreise > 0 || preview.konflikte.bedarfe > 0 || preview.konflikte.kampagnen > 0) && (
              <div className="mt-4 px-3 py-2.5 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800">
                <p className="font-medium mb-1">⚠ Konflikte — hier bleibt der Wert des Ziel-Artikels erhalten, der Wert der Quelle wird verworfen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {preview.konflikte.lieferanten > 0 && <li>{preview.konflikte.lieferanten} Lieferant(en) bei beiden Artikeln zugeordnet (Jahrespreise/Preisverlauf der Quelle für diesen Lieferanten gehen dabei verloren)</li>}
                  {preview.konflikte.jahrespreise > 0 && <li>{preview.konflikte.jahrespreise} Jahrespreis(e) für dasselbe Jahr bei beiden Artikeln</li>}
                  {preview.konflikte.kundePreise > 0 && <li>{preview.konflikte.kundePreise} Kunden-Sonderpreis(e) für denselben Kunden bei beiden Artikeln</li>}
                  {preview.konflikte.bedarfe > 0 && <li>{preview.konflikte.bedarfe} Bedarf(e) für denselben Kunden bei beiden Artikeln</li>}
                  {preview.konflikte.kampagnen > 0 && <li>{preview.konflikte.kampagnen} Kampagnen-Zuordnung(en) doppelt</li>}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 sm:p-6">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} className="mt-0.5" />
              <span>
                Ich habe verstanden, dass <strong>&quot;{preview.quelle.name}&quot;</strong> (Artikel #{preview.quelle.id}) nach dem
                Zusammenführen <strong>endgültig gelöscht</strong> wird und dies nicht rückgängig gemacht werden kann.
              </span>
            </label>

            {fehler && <p className="mt-3 text-sm text-red-600">{fehler}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <Link href="/artikel" className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Abbrechen
              </Link>
              <button
                type="button"
                disabled={!bestaetigt || speichern}
                onClick={verschmelzen}
                className="px-4 py-2.5 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-700 text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {speichern ? "Wird zusammengeführt…" : "Jetzt zusammenführen"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
