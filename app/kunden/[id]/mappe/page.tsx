"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Kontakt { id: number; typ: string; wert: string; label?: string | null }
interface Bedarf { id: number; menge: number; intervallTage: number; notiz?: string | null; artikel: { name: string; einheit: string } }
interface Sonderpreis { id: number; preis: number; rabatt: number; artikel: { name: string; standardpreis: number } }
interface Lieferposition { menge: number; verkaufspreis: number; artikel: { name: string; einheit: string } }
interface Lieferung {
  id: number; datum: string; status: string; rechnungNr?: string | null; rechnungDatum?: string | null;
  bezahltAm?: string | null; zahlungsziel?: number | null;
  positionen: Lieferposition[];
}
interface Aktivitaet { id: number; datum: string; typ: string; betreff: string; inhalt?: string | null; erledigt: boolean }
interface Notiz { id: number; text: string; thema?: string | null; erstellt: string }
interface Kunde {
  id: number; name: string; firma?: string | null; kategorie: string; aktiv: boolean;
  strasse?: string | null; plz?: string | null; ort?: string | null; land: string;
  betriebsnummer?: string | null; flaeche?: number | null; notizen?: string | null;
  kontakte: Kontakt[]; bedarfe: Bedarf[]; artikelPreise: Sonderpreis[]; lieferungen: Lieferung[];
}
interface Firma { name: string; zusatz: string; strasse: string; plzOrt: string; telefon: string; email: string; iban: string; bic: string; bank: string; steuernummer: string }

function total(l: Lieferung) { return l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0); }

export default function KundenmappePage() {
  const params = useParams();
  const id = params.id as string;

  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [aktivitaeten, setAktivitaeten] = useState<Aktivitaet[]>([]);
  const [notizen, setNotizen] = useState<Notiz[]>([]);
  const [firma, setFirma] = useState<Partial<Firma>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`/api/kunden/${id}`).then((r) => r.json()),
      fetch(`/api/kunden/aktivitaeten?kundeId=${id}&limit=30`).then((r) => r.json()).catch(() => []),
      fetch(`/api/kunden/${id}/notizen`).then((r) => r.json()).catch(() => []),
      fetch("/api/einstellungen?prefix=firma.").then((r) => r.json()).catch(() => ({})),
    ]).then(([k, akt, noti, einst]) => {
      setKunde(k);
      setAktivitaeten(Array.isArray(akt) ? akt : []);
      setNotizen(Array.isArray(noti) ? noti : []);
      const f: Partial<Firma> = {};
      for (const [key, val] of Object.entries(einst as Record<string, string>)) {
        (f as Record<string, string>)[key.replace("firma.", "")] = val;
      }
      setFirma(f);
      setLoading(false);
    });
  }, [id]);

  if (loading) return <p className="p-8 text-gray-400">Lade Kundenmappe…</p>;
  if (!kunde) return <p className="p-8 text-gray-600">Kunde nicht gefunden.</p>;

  const heute = new Date().toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
  const geliefert = kunde.lieferungen.filter((l) => l.status === "geliefert");
  const gesamtUmsatz = geliefert.reduce((s, l) => s + total(l), 0);
  const offenBetrag = geliefert.filter((l) => !l.bezahltAm).reduce((s, l) => s + total(l), 0);
  const offeneRechnungen = geliefert.filter((l) => l.rechnungNr && !l.bezahltAm);

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Drucken-Button */}
      <div className="print:hidden sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-4 shadow-sm">
        <Link href={`/kunden/${id}`} className="text-sm text-gray-500 hover:text-gray-700">← Zurück</Link>
        <span className="text-sm font-medium text-gray-700">Kundenmappe: {kunde.firma ?? kunde.name}</span>
        <button
          onClick={() => window.print()}
          className="ml-auto px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-medium rounded-lg transition-colors"
        >
          🖨 Drucken / Als PDF speichern
        </button>
      </div>

      <div className="max-w-4xl mx-auto p-6 print:p-0 space-y-6 print:space-y-4">
        {/* Briefkopf */}
        <div className="bg-green-800 text-white rounded-xl print:rounded-none px-8 py-5 flex justify-between items-start">
          <div>
            <p className="font-bold text-xl">{firma.name ?? "Landhandel Röthemeier"}</p>
            {firma.zusatz && <p className="text-green-200 text-sm">{firma.zusatz}</p>}
            {firma.strasse && <p className="text-green-100 text-sm mt-1">{firma.strasse}</p>}
            {firma.plzOrt && <p className="text-green-100 text-sm">{firma.plzOrt}</p>}
          </div>
          <div className="text-right text-sm text-green-100">
            <p className="font-semibold text-white text-base">Kundenmappe</p>
            <p>Stand: {heute}</p>
            {firma.telefon && <p className="mt-1">{firma.telefon}</p>}
            {firma.email && <p>{firma.email}</p>}
          </div>
        </div>

        {/* Kundenkopf */}
        <div className="bg-white rounded-xl border border-gray-200 px-8 py-5 print:border print:rounded-none">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{kunde.firma ?? kunde.name}</h1>
              {kunde.firma && <p className="text-gray-500 mt-0.5">{kunde.name}</p>}
              <div className="flex items-center gap-2 mt-2">
                <span className="px-2.5 py-0.5 bg-green-100 text-green-800 rounded-full text-xs font-medium">{kunde.kategorie}</span>
                {!kunde.aktiv && <span className="px-2.5 py-0.5 bg-gray-100 text-gray-600 rounded-full text-xs">Inaktiv</span>}
              </div>
            </div>
            <div className="text-sm text-gray-600 text-right space-y-0.5">
              {kunde.strasse && <p>{kunde.strasse}</p>}
              {(kunde.plz || kunde.ort) && <p>{[kunde.plz, kunde.ort].filter(Boolean).join(" ")}</p>}
              {kunde.betriebsnummer && <p className="text-gray-400 text-xs">Betr.-Nr.: {kunde.betriebsnummer}</p>}
              {kunde.flaeche && <p className="text-gray-400 text-xs">{kunde.flaeche} ha</p>}
            </div>
          </div>

          {/* Kontakte */}
          {kunde.kontakte.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4">
              {kunde.kontakte.map((k) => (
                <span key={k.id} className="text-sm text-gray-700">
                  <span className="text-gray-400 mr-1">{k.typ}{k.label ? ` (${k.label})` : ""}:</span>
                  {k.wert}
                </span>
              ))}
            </div>
          )}

          {/* Kennzahlen */}
          <div className="mt-4 pt-4 border-t border-gray-100 grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Gesamtumsatz</p>
              <p className="font-bold text-gray-900">{formatEuro(gesamtUmsatz)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Offen</p>
              <p className={`font-bold ${offenBetrag > 0 ? "text-red-700" : "text-gray-500"}`}>{formatEuro(offenBetrag)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide">Lieferungen gesamt</p>
              <p className="font-bold text-gray-900">{kunde.lieferungen.length}</p>
            </div>
          </div>
        </div>

        {/* Offene Rechnungen */}
        {offeneRechnungen.length > 0 && (
          <div className="bg-white rounded-xl border border-red-200 px-8 py-5 print:rounded-none">
            <h2 className="text-base font-bold text-red-700 mb-3">Offene Rechnungen ({offeneRechnungen.length})</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Rechnung-Nr.</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Lieferdatum</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Fällig</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {offeneRechnungen.map((l) => {
                  const faellig = new Date(new Date(l.rechnungDatum ?? l.datum).getTime() + (l.zahlungsziel ?? 30) * 86400000);
                  const ueberfaellig = faellig < new Date();
                  return (
                    <tr key={l.id} className="border-b border-gray-100">
                      <td className="py-2 font-mono">{l.rechnungNr ?? "—"}</td>
                      <td className="py-2 text-gray-600">{formatDatum(l.datum)}</td>
                      <td className={`py-2 ${ueberfaellig ? "text-red-600 font-medium" : "text-gray-600"}`}>{formatDatum(faellig)}</td>
                      <td className="py-2 text-right font-medium">{formatEuro(total(l))}</td>
                    </tr>
                  );
                })}
                <tr>
                  <td colSpan={3} className="py-2 text-right font-bold text-gray-700">Gesamt offen:</td>
                  <td className="py-2 text-right font-bold text-red-700">{formatEuro(offenBetrag)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Lieferhistorie */}
        {kunde.lieferungen.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-8 py-5 print:rounded-none">
            <h2 className="text-base font-bold text-gray-800 mb-3">Letzte Lieferungen</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Datum</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Status</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Rechnung-Nr.</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Artikel</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Betrag</th>
                </tr>
              </thead>
              <tbody>
                {kunde.lieferungen.slice(0, 20).map((l) => (
                  <tr key={l.id} className="border-b border-gray-100">
                    <td className="py-1.5 text-gray-700">{formatDatum(l.datum)}</td>
                    <td className="py-1.5">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                        l.status === "geliefert" ? "bg-green-100 text-green-800" :
                        l.status === "geplant" ? "bg-yellow-100 text-yellow-800" :
                        "bg-red-100 text-red-700"}`}>{l.status}</span>
                    </td>
                    <td className="py-1.5 font-mono text-xs text-gray-600">{l.rechnungNr ?? "—"}</td>
                    <td className="py-1.5 text-gray-600 text-xs">{l.positionen.map((p) => `${p.menge}× ${p.artikel.name}`).join(", ").slice(0, 60)}{l.positionen.length > 2 ? "…" : ""}</td>
                    <td className="py-1.5 text-right font-medium">{formatEuro(total(l))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Bedarfe */}
        {kunde.bedarfe.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-8 py-5 print:rounded-none">
            <h2 className="text-base font-bold text-gray-800 mb-3">Wiederkehrende Bedarfe</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Artikel</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Menge</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Intervall</th>
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Notiz</th>
                </tr>
              </thead>
              <tbody>
                {kunde.bedarfe.map((b) => (
                  <tr key={b.id} className="border-b border-gray-100">
                    <td className="py-1.5 font-medium">{b.artikel.name}</td>
                    <td className="py-1.5">{b.menge} {b.artikel.einheit}</td>
                    <td className="py-1.5 text-gray-600">alle {b.intervallTage} Tage</td>
                    <td className="py-1.5 text-gray-500 text-xs">{b.notiz ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sonderpreise */}
        {kunde.artikelPreise.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-8 py-5 print:rounded-none">
            <h2 className="text-base font-bold text-gray-800 mb-3">Individuelle Preise / Rabatte</h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 text-xs font-semibold text-gray-500 uppercase">Artikel</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Listenpreis</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Sonderpreis</th>
                  <th className="text-right py-2 text-xs font-semibold text-gray-500 uppercase">Rabatt</th>
                </tr>
              </thead>
              <tbody>
                {kunde.artikelPreise.map((p) => (
                  <tr key={p.id} className="border-b border-gray-100">
                    <td className="py-1.5 font-medium">{p.artikel.name}</td>
                    <td className="py-1.5 text-right text-gray-500">{formatEuro(p.artikel.standardpreis)}</td>
                    <td className="py-1.5 text-right font-medium text-green-700">{formatEuro(p.preis)}</td>
                    <td className="py-1.5 text-right text-gray-600">{p.rabatt > 0 ? `${p.rabatt}%` : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* CRM / Besuchshistorie */}
        {aktivitaeten.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-8 py-5 print:rounded-none">
            <h2 className="text-base font-bold text-gray-800 mb-3">Besuchs- & Kontakthistorie</h2>
            <div className="space-y-2">
              {aktivitaeten.slice(0, 20).map((a) => (
                <div key={a.id} className={`flex gap-3 py-2 border-b border-gray-100 ${a.erledigt ? "opacity-50" : ""}`}>
                  <div className="text-xs text-gray-500 whitespace-nowrap pt-0.5 w-24 shrink-0">{new Date(a.datum).toLocaleDateString("de-DE")}</div>
                  <div className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium h-fit whitespace-nowrap">{a.typ}</div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{a.betreff}</p>
                    {a.inhalt && <p className="text-xs text-gray-500 mt-0.5">{a.inhalt}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notizen */}
        {notizen.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 px-8 py-5 print:rounded-none">
            <h2 className="text-base font-bold text-gray-800 mb-3">Interne Notizen</h2>
            <div className="space-y-2">
              {notizen.map((n) => (
                <div key={n.id} className="py-2 border-b border-gray-100">
                  <div className="flex items-center gap-2 mb-0.5">
                    {n.thema && <span className="text-xs px-1.5 py-0.5 rounded bg-gray-100 text-gray-700 font-medium">{n.thema}</span>}
                    <span className="text-xs text-gray-400">{new Date(n.erstellt).toLocaleDateString("de-DE")}</span>
                  </div>
                  <p className="text-sm text-gray-700">{n.text}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fußzeile */}
        <div className="text-center text-xs text-gray-400 py-4 print:pt-6">
          {firma.name ?? "Landhandel Röthemeier"} · Kundenmappe · Stand {heute}
          {firma.iban && <> · IBAN: {firma.iban}</>}
        </div>
      </div>

      <style>{`
        @media print {
          @page { margin: 1.5cm; size: A4; }
          body { font-size: 11pt; }
        }
      `}</style>
    </div>
  );
}
