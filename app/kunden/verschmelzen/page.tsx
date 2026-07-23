"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface KundeListe {
  id: number;
  name: string;
  firma?: string | null;
  ort?: string | null;
  aktiv: boolean;
}

interface KundeVoll {
  id: number;
  name: string;
  firma: string | null;
  kategorie: string;
  verantwortlicher: string | null;
  betriebsnummer: string | null;
  flaeche: number | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  land: string;
  lat: number | null;
  lng: number | null;
  notizen: string | null;
  tags: string;
  ustIdNr: string | null;
  aktiv: boolean;
  kreditlimit: number | null;
  sachkundeNr: string | null;
  sachkundeGueltigBis: string | null;
  vvvoNr: string | null;
}

interface Anzahl {
  kontakte: number; kundeNotizen: number; aktivitaeten: number; schlaegte: number;
  lieferungen: number; mengenrabatte: number; sammelrechnungen: number; bestellpositionen: number;
  antragDaten: number; aufgaben: number; angebote: number; gutschriften: number;
  psmAusbringungen: number; kontrakte: number; reklamationen: number; sachkundenachweise: number;
  sortenversuche: number; vorbestellungen: number; tiere: number; rationsberechnungen: number;
  anlieferungen: number; anbauplaene: number; zertifizierungen: number; benachrichtigungen: number;
  artikelPreise: number; bedarfe: number; sprengstoffErklaerungen: number; kampagnen: number; portalZugang: number;
}

interface Preview {
  ziel: KundeVoll;
  quelle: KundeVoll;
  anzahl: { ziel: Anzahl; quelle: Anzahl };
  konflikte: { artikelPreise: number; bedarfe: number; sprengstoffErklaerungen: number; kampagnen: number; portalZugang: boolean };
}

const ANZAHL_LABELS: { key: keyof Anzahl; label: string }[] = [
  { key: "lieferungen", label: "Lieferungen" },
  { key: "angebote", label: "Angebote" },
  { key: "sammelrechnungen", label: "Sammelrechnungen" },
  { key: "gutschriften", label: "Gutschriften" },
  { key: "kontrakte", label: "Kontrakte" },
  { key: "vorbestellungen", label: "Vorbestellungen" },
  { key: "kontakte", label: "Kontakte" },
  { key: "kundeNotizen", label: "Notizen" },
  { key: "aktivitaeten", label: "CRM-Aktivitäten" },
  { key: "aufgaben", label: "Aufgaben" },
  { key: "reklamationen", label: "Reklamationen" },
  { key: "artikelPreise", label: "Sonderpreise" },
  { key: "bedarfe", label: "Bedarfe" },
  { key: "schlaegte", label: "Schläge (Schlagkartei)" },
  { key: "sachkundenachweise", label: "Sachkundenachweise" },
  { key: "zertifizierungen", label: "Zertifizierungen" },
  { key: "sortenversuche", label: "Sortenversuche" },
  { key: "anbauplaene", label: "Anbaupläne" },
  { key: "tiere", label: "Tiere" },
  { key: "rationsberechnungen", label: "Rationsberechnungen" },
  { key: "anlieferungen", label: "Anlieferungen" },
  { key: "kampagnen", label: "Kampagnen-Zuordnungen" },
  { key: "mengenrabatte", label: "Mengenrabatte" },
  { key: "bestellpositionen", label: "Bestellpositionen" },
  { key: "antragDaten", label: "AFIG-Antragsdaten" },
  { key: "benachrichtigungen", label: "Benachrichtigungen" },
  { key: "portalZugang", label: "Portal-Zugang" },
];

type FeldWahl = "ziel" | "quelle";

// Adressfelder werden als Gruppe behandelt, damit lat/lng nicht von einer anderen
// Adresse als strasse/plz/ort übernommen werden (sonst zeigt die Karte den falschen Punkt).
const ADRESS_FELDER = ["strasse", "plz", "ort", "land", "lat", "lng"] as const;
const SACHKUNDE_FELDER = ["sachkundeNr", "sachkundeGueltigBis"] as const;

const EINZEL_FELDER: { key: keyof KundeVoll; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "firma", label: "Firma" },
  { key: "kategorie", label: "Kategorie" },
  { key: "verantwortlicher", label: "Verantwortlicher" },
  { key: "betriebsnummer", label: "Betriebsnummer" },
  { key: "flaeche", label: "Fläche (ha)" },
  { key: "notizen", label: "Notizen" },
  { key: "ustIdNr", label: "USt-IdNr." },
  { key: "kreditlimit", label: "Kreditlimit (€)" },
  { key: "vvvoNr", label: "VVVO-Nr. (HIT)" },
];

function anzeigeWert(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function leer(v: unknown): boolean {
  return v === null || v === undefined || v === "";
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

export default function KundenVerschmelzenPage() {
  const router = useRouter();
  const [kunden, setKunden] = useState<KundeListe[]>([]);
  const [ladeKunden, setLadeKunden] = useState(true);
  const [kundeAId, setKundeAId] = useState<string>("");
  const [kundeBId, setKundeBId] = useState<string>("");
  const [zielIstA, setZielIstA] = useState(true);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [ladePreview, setLadePreview] = useState(false);
  const [previewFehler, setPreviewFehler] = useState("");
  const [wahl, setWahl] = useState<Record<string, FeldWahl>>({});
  const [bestaetigt, setBestaetigt] = useState(false);
  const [speichern, setSpeichern] = useState(false);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    fetch("/api/kunden?limit=1000&kontakte=false")
      .then((r) => r.json())
      .then((data) => setKunden(Array.isArray(data) ? data : []))
      .catch(() => setKunden([]))
      .finally(() => setLadeKunden(false));
  }, []);

  const zielId = zielIstA ? kundeAId : kundeBId;
  const quelleId = zielIstA ? kundeBId : kundeAId;

  useEffect(() => {
    setPreview(null);
    setPreviewFehler("");
    setBestaetigt(false);
    setFehler("");
    if (!zielId || !quelleId || zielId === quelleId) return;
    setLadePreview(true);
    fetch(`/api/kunden/merge?zielId=${zielId}&quelleId=${quelleId}`)
      .then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error ?? "Vorschau fehlgeschlagen");
        }
        return res.json();
      })
      .then((data: Preview) => {
        setPreview(data);
        // Default-Auswahl: nicht-leerer Wert gewinnt, sonst Ziel-Kunde
        const defaults: Record<string, FeldWahl> = {};
        for (const { key } of EINZEL_FELDER) {
          const zielLeer = leer(data.ziel[key]);
          const quelleLeer = leer(data.quelle[key]);
          defaults[key] = zielLeer && !quelleLeer ? "quelle" : "ziel";
        }
        const adressZielLeer = ADRESS_FELDER.every((f) => leer(data.ziel[f]));
        const adressQuelleLeer = ADRESS_FELDER.every((f) => leer(data.quelle[f]));
        defaults.adresse = adressZielLeer && !adressQuelleLeer ? "quelle" : "ziel";
        const sachkundeZielLeer = SACHKUNDE_FELDER.every((f) => leer(data.ziel[f]));
        const sachkundeQuelleLeer = SACHKUNDE_FELDER.every((f) => leer(data.quelle[f]));
        defaults.sachkunde = sachkundeZielLeer && !sachkundeQuelleLeer ? "quelle" : "ziel";
        setWahl(defaults);
      })
      .catch((err) => setPreviewFehler(err.message ?? "Vorschau fehlgeschlagen"))
      .finally(() => setLadePreview(false));
  }, [zielId, quelleId]);

  const optionenA = useMemo(
    () => kunden.filter((k) => String(k.id) !== kundeBId).map((k) => ({ value: k.id, label: k.name, sub: [k.firma, k.ort, !k.aktiv ? "inaktiv" : null].filter(Boolean).join(" · ") })),
    [kunden, kundeBId]
  );
  const optionenB = useMemo(
    () => kunden.filter((k) => String(k.id) !== kundeAId).map((k) => ({ value: k.id, label: k.name, sub: [k.firma, k.ort, !k.aktiv ? "inaktiv" : null].filter(Boolean).join(" · ") })),
    [kunden, kundeAId]
  );

  async function verschmelzen() {
    if (!preview) return;
    setFehler("");
    setSpeichern(true);
    try {
      const felder: Record<string, unknown> = {};
      for (const { key } of EINZEL_FELDER) {
        felder[key] = wahl[key] === "quelle" ? preview.quelle[key] : preview.ziel[key];
      }
      const adressQuelle = wahl.adresse === "quelle";
      for (const f of ADRESS_FELDER) {
        felder[f] = adressQuelle ? preview.quelle[f] : preview.ziel[f];
      }
      const sachkundeQuelle = wahl.sachkunde === "quelle";
      for (const f of SACHKUNDE_FELDER) {
        felder[f] = sachkundeQuelle ? preview.quelle[f] : preview.ziel[f];
      }
      // Tags werden zusammengeführt statt gewählt (Vereinigung)
      const parseTags = (t: string) => { try { const p = JSON.parse(t || "[]"); return Array.isArray(p) ? p : []; } catch { return []; } };
      felder.tags = Array.from(new Set([...parseTags(preview.ziel.tags), ...parseTags(preview.quelle.tags)]));

      const res = await fetch("/api/kunden/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zielId: preview.ziel.id, quelleId: preview.quelle.id, felder }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFehler(data.error ?? "Zusammenführen fehlgeschlagen");
        return;
      }
      router.push(`/kunden/${preview.ziel.id}`);
    } catch {
      setFehler("Netzwerkfehler beim Zusammenführen");
    } finally {
      setSpeichern(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center gap-2 mb-6">
        <Link href="/kunden" className="text-gray-400 hover:text-green-700">← Zurück zur Kundenliste</Link>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold mb-1">Kunden zusammenführen</h1>
      <p className="text-sm text-gray-500 mb-6">
        Zwei Kundendatensätze auswählen, die denselben Betrieb doppelt abbilden. Alle Lieferungen, Angebote,
        CRM-Daten usw. werden auf den Ziel-Kunden übertragen; der andere Kunde wird danach endgültig gelöscht.
      </p>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde A</label>
            <SearchableSelect
              options={optionenA}
              value={kundeAId}
              onChange={setKundeAId}
              placeholder={ladeKunden ? "Lade Kunden…" : "Kunde A auswählen…"}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Kunde B</label>
            <SearchableSelect
              options={optionenB}
              value={kundeBId}
              onChange={setKundeBId}
              placeholder={ladeKunden ? "Lade Kunden…" : "Kunde B auswählen…"}
            />
          </div>
        </div>

        {kundeAId && kundeBId && kundeAId !== kundeBId && (
          <div className="mt-4 flex items-center gap-3 text-sm">
            <span className="text-gray-600">Bleibt erhalten (Ziel):</span>
            <div className="flex rounded-lg border border-gray-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setZielIstA(true)}
                className={`px-3 py-1.5 transition-colors ${zielIstA ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Kunde A
              </button>
              <button
                type="button"
                onClick={() => setZielIstA(false)}
                className={`px-3 py-1.5 transition-colors border-l border-gray-300 ${!zielIstA ? "bg-green-600 text-white" : "bg-white text-gray-700 hover:bg-gray-50"}`}
              >
                Kunde B
              </button>
            </div>
          </div>
        )}
        {kundeAId && kundeBId && kundeAId === kundeBId && (
          <p className="mt-4 text-sm text-red-600">Bitte zwei unterschiedliche Kunden auswählen.</p>
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
                    feldKey="adresse"
                    label="Adresse"
                    ziel={[preview.ziel.strasse, [preview.ziel.plz, preview.ziel.ort].filter(Boolean).join(" "), preview.ziel.land].filter(Boolean).join(", ")}
                    quelle={[preview.quelle.strasse, [preview.quelle.plz, preview.quelle.ort].filter(Boolean).join(" "), preview.quelle.land].filter(Boolean).join(", ")}
                    wahl={wahl}
                    setWahl={setWahl}
                  />
                  <FeldRadio
                    feldKey="sachkunde"
                    label="Sachkundenummer + Ablauf"
                    ziel={[preview.ziel.sachkundeNr, preview.ziel.sachkundeGueltigBis ? new Date(preview.ziel.sachkundeGueltigBis).toLocaleDateString("de-DE") : null].filter(Boolean).join(" · ")}
                    quelle={[preview.quelle.sachkundeNr, preview.quelle.sachkundeGueltigBis ? new Date(preview.quelle.sachkundeGueltigBis).toLocaleDateString("de-DE") : null].filter(Boolean).join(" · ")}
                    wahl={wahl}
                    setWahl={setWahl}
                  />
                </tbody>
              </table>
            </div>
            <div className="px-4 py-2.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
              Tags beider Kunden werden automatisch zusammengeführt (Vereinigung).
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

            {(preview.konflikte.artikelPreise > 0 || preview.konflikte.bedarfe > 0 || preview.konflikte.sprengstoffErklaerungen > 0 || preview.konflikte.kampagnen > 0 || preview.konflikte.portalZugang) && (
              <div className="mt-4 px-3 py-2.5 rounded-lg text-sm bg-amber-50 border border-amber-200 text-amber-800">
                <p className="font-medium mb-1">⚠ Konflikte — hier bleibt der Wert des Ziel-Kunden erhalten, der Wert der Quelle wird verworfen:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  {preview.konflikte.artikelPreise > 0 && <li>{preview.konflikte.artikelPreise} Sonderpreis(e) für denselben Artikel bei beiden Kunden</li>}
                  {preview.konflikte.bedarfe > 0 && <li>{preview.konflikte.bedarfe} Bedarf(e) für denselben Artikel bei beiden Kunden</li>}
                  {preview.konflikte.sprengstoffErklaerungen > 0 && <li>{preview.konflikte.sprengstoffErklaerungen} Sprengstoff-Erklärung(en) für dasselbe Jahr bei beiden Kunden</li>}
                  {preview.konflikte.kampagnen > 0 && <li>{preview.konflikte.kampagnen} Kampagnen-Zuordnung(en) doppelt</li>}
                  {preview.konflikte.portalZugang && <li>Beide Kunden haben einen Portal-Zugang — der Zugang von &quot;{preview.quelle.name}&quot; wird gelöscht</li>}
                </ul>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-4 sm:p-6">
            <label className="flex items-start gap-2.5 text-sm cursor-pointer">
              <input type="checkbox" checked={bestaetigt} onChange={(e) => setBestaetigt(e.target.checked)} className="mt-0.5" />
              <span>
                Ich habe verstanden, dass <strong>&quot;{preview.quelle.name}&quot;</strong> (Kunde #{preview.quelle.id}) nach dem
                Zusammenführen <strong>endgültig gelöscht</strong> wird und dies nicht rückgängig gemacht werden kann.
              </span>
            </label>

            {fehler && <p className="mt-3 text-sm text-red-600">{fehler}</p>}

            <div className="mt-4 flex justify-end gap-3">
              <Link href="/kunden" className="px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
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
