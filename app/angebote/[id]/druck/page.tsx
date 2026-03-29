"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import DriveUploadButton from "@/components/DriveUploadButton";

interface ArtikelInfo {
  id: number;
  name: string;
  einheit: string;
  mwstSatz: number;
}

interface AngebotPosition {
  id: number;
  artikelId: number;
  menge: number;
  preis: number;
  rabatt: number;
  einheit: string;
  notiz: string | null;
  artikel: ArtikelInfo;
}

interface Angebot {
  id: number;
  nummer: string;
  datum: string;
  gueltigBis: string | null;
  status: string;
  notiz: string | null;
  kunde: {
    id: number;
    name: string;
    firma: string | null;
    strasse: string | null;
    plz: string | null;
    ort: string | null;
    land: string;
  };
  positionen: AngebotPosition[];
}

interface Einstellungen {
  [key: string]: string;
}

function fmt(n: number): string {
  return n.toLocaleString("de-DE", { style: "currency", currency: "EUR" });
}

function fmtDatum(d: string | null | undefined): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("de-DE");
}

export default function AngebotDruckPage() {
  const params = useParams();
  const id = params.id as string;

  const [angebot, setAngebot] = useState<Angebot | null>(null);
  const [einstellungen, setEinstellungen] = useState<Einstellungen>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/angebote/${id}`).then((r) => r.json()),
      fetch("/api/einstellungen?prefix=firma.").then((r) => r.json()),
    ])
      .then(([ang, eins]) => {
        setAngebot(ang);
        setEinstellungen(eins ?? {});
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [id]);

  if (loading) {
    return <div className="p-8 text-gray-400">Lade…</div>;
  }

  if (!angebot) {
    return <div className="p-8 text-red-500">Angebot nicht gefunden.</div>;
  }

  const gesamtNetto = angebot.positionen.reduce((sum, pos) => {
    return sum + pos.menge * pos.preis * (1 - pos.rabatt / 100);
  }, 0);

  // Group MwSt
  const mwstMap: Record<number, number> = {};
  for (const pos of angebot.positionen) {
    const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
    const satz = pos.artikel.mwstSatz;
    mwstMap[satz] = (mwstMap[satz] ?? 0) + netto * (satz / 100);
  }
  const gesamtMwst = Object.values(mwstMap).reduce((a, b) => a + b, 0);
  const gesamtBrutto = gesamtNetto + gesamtMwst;

  const firmaName = einstellungen["firma.name"] ?? einstellungen["system.firmenname"] ?? "AgrarOffice";
  const firmaAdresse = [
    einstellungen["firma.strasse"],
    [einstellungen["firma.plz"], einstellungen["firma.ort"]].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");
  const firmaTel = einstellungen["firma.tel"] ?? einstellungen["firma.telefon"];
  const firmaEmail = einstellungen["firma.email"];

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; }
        }
        body { font-family: Arial, sans-serif; }
      `}</style>

      {/* Print button */}
      <div className="no-print fixed top-4 right-4 flex gap-2 items-center">
        <DriveUploadButton
          kundeId={angebot.kunde.id}
          typ="angebot"
          dateiName={`Angebot_${angebot.nummer}.pdf`}
          getInhalt={async () => {
            try {
              const { default: html2canvas } = await import("html2canvas");
              const { jsPDF } = await import("jspdf");
              const element = document.querySelector<HTMLElement>("[data-print-area]");
              if (!element) return null;
              const canvas = await html2canvas(element, { scale: 2, useCORS: true });
              const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
              const imgData = canvas.toDataURL("image/png");
              const pdfWidth = pdf.internal.pageSize.getWidth();
              const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
              pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
              return pdf.output("datauristring").split(",")[1];
            } catch {
              return null;
            }
          }}
        />
        <button
          onClick={() => window.print()}
          className="px-4 py-2 bg-green-700 text-white text-sm rounded-lg shadow hover:bg-green-800 transition-colors"
        >
          Drucken
        </button>
        <button
          onClick={() => window.close()}
          className="px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg shadow hover:bg-gray-200 transition-colors"
        >
          Schließen
        </button>
      </div>

      <div data-print-area className="max-w-[800px] mx-auto p-10 print:p-0 print:max-w-full">
        {/* Briefkopf */}
        <div className="flex justify-between items-start mb-10">
          <div>
            <div className="text-xl font-bold text-gray-900">{firmaName}</div>
            {firmaAdresse && <div className="text-sm text-gray-600 mt-0.5">{firmaAdresse}</div>}
            {firmaTel && <div className="text-sm text-gray-600">Tel: {firmaTel}</div>}
            {firmaEmail && <div className="text-sm text-gray-600">{firmaEmail}</div>}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-gray-900">ANGEBOT</div>
            <div className="text-sm text-gray-500 mt-1">{angebot.nummer}</div>
          </div>
        </div>

        {/* Empfängeranschrift */}
        <div className="mb-8">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-2">{firmaAdresse}</div>
          <div className="font-semibold text-gray-900">{angebot.kunde.name}</div>
          {angebot.kunde.firma && <div className="text-gray-700">{angebot.kunde.firma}</div>}
          {angebot.kunde.strasse && <div className="text-gray-700">{angebot.kunde.strasse}</div>}
          {(angebot.kunde.plz || angebot.kunde.ort) && (
            <div className="text-gray-700">
              {[angebot.kunde.plz, angebot.kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
          {angebot.kunde.land && angebot.kunde.land !== "Deutschland" && (
            <div className="text-gray-700">{angebot.kunde.land}</div>
          )}
        </div>

        {/* Angebotsinformationen */}
        <div className="grid grid-cols-2 gap-4 mb-8 text-sm">
          <div className="space-y-1">
            <div className="flex gap-2">
              <span className="text-gray-500 w-28">Angebotsnr.:</span>
              <span className="font-medium">{angebot.nummer}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28">Datum:</span>
              <span>{fmtDatum(angebot.datum)}</span>
            </div>
            <div className="flex gap-2">
              <span className="text-gray-500 w-28">Gültig bis:</span>
              <span>{fmtDatum(angebot.gueltigBis)}</span>
            </div>
          </div>
        </div>

        <div className="text-sm text-gray-700 mb-6">
          Sehr geehrte Damen und Herren,<br />
          wir unterbreiten Ihnen folgendes Angebot:
        </div>

        {/* Positionen */}
        <table className="w-full text-sm border-collapse mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 pr-3 font-semibold text-gray-900">Artikel</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-900 w-20">Menge</th>
              <th className="text-left py-2 px-2 font-semibold text-gray-900 w-16">Einheit</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-900 w-24">Einzelpreis</th>
              <th className="text-right py-2 px-2 font-semibold text-gray-900 w-20">Rabatt</th>
              <th className="text-right py-2 pl-2 font-semibold text-gray-900 w-28">Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {angebot.positionen.map((pos, i) => {
              const netto = pos.menge * pos.preis * (1 - pos.rabatt / 100);
              return (
                <tr key={pos.id} className={`border-b border-gray-200 ${i % 2 === 0 ? "" : "bg-gray-50"}`}>
                  <td className="py-2 pr-3 text-gray-900">
                    {pos.artikel.name}
                    {pos.notiz && <span className="block text-xs text-gray-400">{pos.notiz}</span>}
                  </td>
                  <td className="py-2 px-2 text-right text-gray-700">
                    {pos.menge.toLocaleString("de-DE")}
                  </td>
                  <td className="py-2 px-2 text-gray-600">{pos.einheit}</td>
                  <td className="py-2 px-2 text-right text-gray-700">{fmt(pos.preis)}</td>
                  <td className="py-2 px-2 text-right text-gray-600">
                    {pos.rabatt > 0 ? `${pos.rabatt.toLocaleString("de-DE")} %` : "—"}
                  </td>
                  <td className="py-2 pl-2 text-right font-medium text-gray-900">{fmt(netto)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Summen */}
        <div className="flex justify-end mb-8">
          <div className="w-64 text-sm space-y-1.5">
            <div className="flex justify-between text-gray-600">
              <span>Netto</span>
              <span>{fmt(gesamtNetto)}</span>
            </div>
            {Object.entries(mwstMap).map(([satz, betrag]) => (
              <div key={satz} className="flex justify-between text-gray-600">
                <span>MwSt. {satz} %</span>
                <span>{fmt(betrag)}</span>
              </div>
            ))}
            <div className="flex justify-between font-bold text-gray-900 text-base border-t border-gray-900 pt-2 mt-2">
              <span>Brutto gesamt</span>
              <span>{fmt(gesamtBrutto)}</span>
            </div>
          </div>
        </div>

        {/* Notiz */}
        {angebot.notiz && (
          <div className="mb-8 p-4 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
            <div className="font-semibold mb-1 text-gray-800">Hinweis:</div>
            {angebot.notiz}
          </div>
        )}

        {/* Footer */}
        <div className="text-sm text-gray-600 border-t border-gray-200 pt-6 space-y-1">
          <p>Dieses Angebot ist gültig bis {fmtDatum(angebot.gueltigBis)}.</p>
          <p>Alle Preise verstehen sich netto zuzüglich der gesetzlichen Mehrwertsteuer.</p>
          <p className="mt-4">Mit freundlichen Grüßen</p>
          <p className="font-semibold">{firmaName}</p>
        </div>
      </div>
    </>
  );
}
