"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

interface Rechenweg {
  nBasis: number;
  nErtragsKorrektur: number;
  nMinAbzug: number;
  nVorfruchtAbzug: number;
  nOrgDungAbzug: number;
  nZwischenfruchtAbzug: number;
  pBasis: number;
  pKorrektur: number;
  kBasis: number;
  kKorrektur: number;
  mgBasis: number;
  mgKorrektur: number;
}

interface Eingaben {
  fruchtart: string;
  ertragsZiel: number | null;
  vorfrucht: string | null;
  nMin: number | null;
  organischeDuengungVorjahrN: number | null;
  versorgungsklasseP: string | null;
  versorgungsklasseK: string | null;
  versorgungsklasseMg: string | null;
  zwischenfruchtAngebaut: boolean;
}

interface DuengebedarfEintrag {
  id: number;
  bezeichnung: string | null;
  jahr: number;
  fruchtart: string;
  ertragsZiel: number | null;
  vorfrucht: string | null;
  nBedarf: number;
  pBedarf: number;
  kBedarf: number;
  mgBedarf: number | null;
  notiz: string | null;
  berechnetAm: string;
  parameter: string | null;
  schlag: {
    id: number;
    name: string;
    flaeche: number;
    fruchtart: string | null;
    kunde: {
      id: number;
      name: string;
      firma: string | null;
      strasse: string | null;
      plz: string | null;
      ort: string | null;
    };
  };
}

interface Firma {
  firmenname: string;
  strasse: string;
  plz: string;
  ort: string;
  tel: string;
  email: string;
  iban: string;
}

export default function DuengebedarfDruckPage() {
  const params = useParams();
  const id = params.id as string;

  const [eintrag, setEintrag] = useState<DuengebedarfEintrag | null>(null);
  const [firma, setFirma] = useState<Partial<Firma>>({});
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`/api/duengebedarf?id=${id}`).then(r => r.ok ? r.json() : Promise.reject(r)),
      fetch("/api/einstellungen?prefix=firma.").then(r => r.ok ? r.json() : []),
    ])
      .then(([eData, fData]) => {
        setEintrag(eData);
        const map: Record<string, string> = {};
        if (Array.isArray(fData)) {
          fData.forEach((e: { key: string; value: string }) => {
            map[e.key.replace("firma.", "")] = e.value;
          });
        }
        setFirma({
          firmenname: map["firmenname"] ?? map["name"] ?? "",
          strasse: map["strasse"] ?? "",
          plz: map["plz"] ?? "",
          ort: map["ort"] ?? "",
          tel: map["tel"] ?? map["telefon"] ?? "",
          email: map["email"] ?? "",
          iban: map["iban"] ?? "",
        });
      })
      .catch(() => setFehler("Daten konnten nicht geladen werden."))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!loading && eintrag) {
      setTimeout(() => window.print(), 500);
    }
  }, [loading, eintrag]);

  if (loading) {
    return <div className="p-8 text-gray-500">Lade Düngebedarf…</div>;
  }
  if (fehler || !eintrag) {
    return <div className="p-8 text-red-600">{fehler || "Nicht gefunden."}</div>;
  }

  const { schlag } = eintrag;
  const kunde = schlag.kunde;
  const kundeName = kunde.firma ? `${kunde.firma} / ${kunde.name}` : kunde.name;
  const kundeAdresse = [kunde.strasse, [kunde.plz, kunde.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");

  let eingaben: Eingaben | null = null;
  let rechenweg: Rechenweg | null = null;
  if (eintrag.parameter) {
    try {
      const p = JSON.parse(eintrag.parameter);
      eingaben = p.eingaben ?? null;
      rechenweg = p.rechenweg ?? null;
    } catch { /* ignore */ }
  }

  const berechnetAm = new Date(eintrag.berechnetAm).toLocaleDateString("de-DE");
  const titel = eintrag.bezeichnung || `Düngebedarf ${eintrag.fruchtart} ${eintrag.jahr}`;

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          .no-print { display: none !important; }
          body { font-size: 11pt; }
        }
        body { font-family: Arial, sans-serif; color: #111; }
      `}</style>

      {/* Drucken-Button (wird beim Druck ausgeblendet) */}
      <div className="no-print flex gap-3 p-4 bg-gray-50 border-b print:hidden">
        <button
          onClick={() => window.print()}
          className="bg-green-700 text-white px-4 py-2 rounded hover:bg-green-800 text-sm font-medium"
        >
          Drucken / Als PDF speichern
        </button>
        <button
          onClick={() => window.history.back()}
          className="border px-4 py-2 rounded hover:bg-gray-100 text-sm"
        >
          Zurück
        </button>
      </div>

      <div className="max-w-3xl mx-auto p-8 print:p-0 print:max-w-none">

        {/* Kopfzeile */}
        <div className="flex justify-between items-start mb-6">
          <div>
            {firma.firmenname && <div className="text-lg font-bold">{firma.firmenname}</div>}
            {firma.strasse && <div className="text-sm text-gray-600">{firma.strasse}</div>}
            {(firma.plz || firma.ort) && <div className="text-sm text-gray-600">{[firma.plz, firma.ort].filter(Boolean).join(" ")}</div>}
            {firma.tel && <div className="text-sm text-gray-600">Tel.: {firma.tel}</div>}
            {firma.email && <div className="text-sm text-gray-600">{firma.email}</div>}
          </div>
          <div className="text-right text-sm text-gray-500">
            <div>Erstellt am: {berechnetAm}</div>
            <div>Nr.: DB-{eintrag.id}</div>
          </div>
        </div>

        <hr className="mb-6 border-gray-300" />

        {/* Titel */}
        <h1 className="text-2xl font-bold mb-1">Düngebedarfsermittlung</h1>
        <div className="text-gray-500 text-sm mb-6">gemäß DüV Anlage 4</div>

        {/* Betrieb & Schlag */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div className="bg-gray-50 rounded p-4 border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Betrieb / Kunde</div>
            <div className="font-semibold">{kundeName}</div>
            {kundeAdresse && <div className="text-sm text-gray-600">{kundeAdresse}</div>}
          </div>
          <div className="bg-gray-50 rounded p-4 border border-gray-200">
            <div className="text-xs font-semibold text-gray-500 uppercase mb-2">Schlag</div>
            <div className="font-semibold">{schlag.name}</div>
            <div className="text-sm text-gray-600">{schlag.flaeche} ha</div>
          </div>
        </div>

        {/* Bezeichnung & Fruchtfolge */}
        <div className="mb-6">
          {eintrag.bezeichnung && (
            <div className="mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase">Bezeichnung: </span>
              <span className="font-semibold">{eintrag.bezeichnung}</span>
            </div>
          )}
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-500">Düngejahr:</span> <strong>{eintrag.jahr}</strong></div>
            <div><span className="text-gray-500">Fruchtart:</span> <strong>{eintrag.fruchtart}</strong></div>
            {eintrag.ertragsZiel && <div><span className="text-gray-500">Ertragsziel:</span> <strong>{eintrag.ertragsZiel} dt/ha</strong></div>}
            {eintrag.vorfrucht && <div><span className="text-gray-500">Vorfrucht:</span> <strong>{eintrag.vorfrucht}</strong></div>}
          </div>
        </div>

        {/* Eingabe-Parameter */}
        {eingaben && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-2 border-b pb-1">Berechnungsgrundlagen</h2>
            <table className="w-full text-sm">
              <tbody>
                {eingaben.nMin != null && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600 w-1/2">N-Min (kg/ha)</td>
                    <td className="py-1 font-medium">{eingaben.nMin}</td>
                  </tr>
                )}
                {eingaben.organischeDuengungVorjahrN != null && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">Org. N-Düngung Vorjahr (kg/ha)</td>
                    <td className="py-1 font-medium">{eingaben.organischeDuengungVorjahrN}</td>
                  </tr>
                )}
                {eingaben.versorgungsklasseP && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">Versorgungsklasse P</td>
                    <td className="py-1 font-medium">{eingaben.versorgungsklasseP}</td>
                  </tr>
                )}
                {eingaben.versorgungsklasseK && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">Versorgungsklasse K</td>
                    <td className="py-1 font-medium">{eingaben.versorgungsklasseK}</td>
                  </tr>
                )}
                {eingaben.versorgungsklasseMg && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">Versorgungsklasse Mg</td>
                    <td className="py-1 font-medium">{eingaben.versorgungsklasseMg}</td>
                  </tr>
                )}
                <tr>
                  <td className="py-1 text-gray-600">Zwischenfrucht angebaut</td>
                  <td className="py-1 font-medium">{eingaben.zwischenfruchtAngebaut ? "Ja" : "Nein"}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Ergebnis */}
        <div className="mb-6">
          <h2 className="text-base font-semibold mb-3 border-b pb-1">Düngebedarfsermittlung (Ergebnis)</h2>
          <table className="w-full text-sm border border-gray-300">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Nährstoff</th>
                <th className="px-4 py-2 text-right font-semibold">Bedarf kg/ha</th>
                <th className="px-4 py-2 text-right font-semibold">Bedarf gesamt ({schlag.flaeche} ha)</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-gray-200 bg-green-50">
                <td className="px-4 py-2 font-semibold">N (Stickstoff)</td>
                <td className="px-4 py-2 text-right font-bold text-green-800">{Math.round(eintrag.nBedarf)} kg/ha</td>
                <td className="px-4 py-2 text-right text-green-700">{Math.round(eintrag.nBedarf * schlag.flaeche)} kg</td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="px-4 py-2">P₂O₅ (Phosphat)</td>
                <td className="px-4 py-2 text-right font-semibold">{Math.round(eintrag.pBedarf)} kg/ha</td>
                <td className="px-4 py-2 text-right">{Math.round(eintrag.pBedarf * schlag.flaeche)} kg</td>
              </tr>
              <tr className="border-t border-gray-200">
                <td className="px-4 py-2">K₂O (Kalium)</td>
                <td className="px-4 py-2 text-right font-semibold">{Math.round(eintrag.kBedarf)} kg/ha</td>
                <td className="px-4 py-2 text-right">{Math.round(eintrag.kBedarf * schlag.flaeche)} kg</td>
              </tr>
              {eintrag.mgBedarf != null && (
                <tr className="border-t border-gray-200">
                  <td className="px-4 py-2">MgO (Magnesium)</td>
                  <td className="px-4 py-2 text-right font-semibold">{Math.round(eintrag.mgBedarf)} kg/ha</td>
                  <td className="px-4 py-2 text-right">{Math.round(eintrag.mgBedarf * schlag.flaeche)} kg</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Rechenweg */}
        {rechenweg && (
          <div className="mb-6">
            <h2 className="text-base font-semibold mb-2 border-b pb-1">Rechenweg Stickstoff</h2>
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="py-1 text-gray-600 w-2/3">N-Basis (Bedarfswert DüV)</td>
                  <td className="py-1 text-right">{rechenweg.nBasis} kg/ha</td>
                </tr>
                {rechenweg.nErtragsKorrektur !== 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">+ Ertragskorrektur</td>
                    <td className="py-1 text-right">{rechenweg.nErtragsKorrektur > 0 ? "+" : ""}{rechenweg.nErtragsKorrektur} kg/ha</td>
                  </tr>
                )}
                {rechenweg.nMinAbzug !== 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">− N-Min Abzug</td>
                    <td className="py-1 text-right">−{rechenweg.nMinAbzug} kg/ha</td>
                  </tr>
                )}
                {rechenweg.nVorfruchtAbzug !== 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">− Vorfrucht-Abzug</td>
                    <td className="py-1 text-right">−{rechenweg.nVorfruchtAbzug} kg/ha</td>
                  </tr>
                )}
                {rechenweg.nOrgDungAbzug !== 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">− Org. Düngung Abzug (Vorjahr)</td>
                    <td className="py-1 text-right">−{rechenweg.nOrgDungAbzug.toFixed(1)} kg/ha</td>
                  </tr>
                )}
                {rechenweg.nZwischenfruchtAbzug !== 0 && (
                  <tr className="border-b border-gray-100">
                    <td className="py-1 text-gray-600">− Zwischenfrucht-Abzug</td>
                    <td className="py-1 text-right">−{rechenweg.nZwischenfruchtAbzug} kg/ha</td>
                  </tr>
                )}
                <tr className="border-t-2 border-gray-400 font-semibold">
                  <td className="py-1">= N-Düngebedarf</td>
                  <td className="py-1 text-right text-green-800">{Math.round(eintrag.nBedarf)} kg/ha</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Notiz */}
        {eintrag.notiz && (
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded p-3 text-sm">
            <strong>Notiz:</strong> {eintrag.notiz}
          </div>
        )}

        {/* Rechtshinweis */}
        <div className="text-xs text-gray-400 mt-8 border-t pt-4">
          <p>
            Die Düngebedarfsermittlung erfolgt gemäß Düngeverordnung (DüV) Anlage 4 auf Basis von DLG-/LfL-orientierten Bedarfswerten.
            Die Angaben sind Orientierungswerte. Eine fachliche Beratung wird empfohlen.
            Erstellt am {berechnetAm} mit AGRI-Office.
          </p>
          {firma.firmenname && (
            <p className="mt-1">{firma.firmenname}{firma.strasse ? ` · ${firma.strasse}` : ""}{firma.ort ? ` · ${firma.plz} ${firma.ort}` : ""}</p>
          )}
        </div>
      </div>
    </>
  );
}
