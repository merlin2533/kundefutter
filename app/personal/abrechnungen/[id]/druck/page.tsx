"use client";
import { useState, useEffect } from "react";

const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const TYP_LABEL: Record<string, string> = { festgehalt: "Festgehalt", minijob: "Minijob", stundenbasis: "Stundenbasis" };
const STATUS_LABEL: Record<string, string> = { OFFEN: "Offen", ABGERECHNET: "Abgerechnet", AUSGEZAHLT: "Ausgezahlt" };

type Params = { params: Promise<{ id: string }> };

interface Abrechnung {
  id: number;
  monat: number;
  jahr: number;
  brutto: number;
  netto: number;
  abzuege: number;
  stundenGesamt: number | null;
  status: string;
  zahlungsDatum: string | null;
  notiz: string | null;
  mitarbeiter: {
    id: number;
    vorname: string;
    nachname: string;
    typ: string;
    iban: string | null;
    bic: string | null;
    kontoinhaber: string | null;
    kostenstelle: string | null;
    stundenlohn: number | null;
  };
}

interface FirmenDaten {
  name: string;
  adresse: string;
  plz: string;
  ort: string;
  tel: string;
  email: string;
  iban: string;
}

export default function GehaltszettelDruckPage({ params }: Params) {
  const [abrechnung, setAbrechnung] = useState<Abrechnung | null>(null);
  const [firma, setFirma] = useState<Partial<FirmenDaten>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    params.then(async (p) => {
      const [abrRes, firmaRes] = await Promise.all([
        fetch(`/api/personal/abrechnungen/${p.id}`),
        fetch("/api/einstellungen?prefix=firma."),
      ]);
      if (abrRes.ok) setAbrechnung(await abrRes.json());
      if (firmaRes.ok) {
        const settings = await firmaRes.json();
        const map: Record<string, string> = {};
        if (Array.isArray(settings)) {
          settings.forEach((s: { key: string; value: string }) => {
            map[s.key.replace("firma.", "")] = s.value;
          });
        }
        setFirma({ name: map.firmenname, adresse: map.adresse, plz: map.plz, ort: map.ort, tel: map.tel, email: map.email, iban: map.iban });
      }
      setLoading(false);
    });
  }, [params]);

  if (loading) return <div className="p-8 text-center text-gray-500">Lade…</div>;
  if (!abrechnung) return <div className="p-8 text-center text-red-500">Abrechnung nicht gefunden.</div>;

  const ma = abrechnung.mitarbeiter;
  const monatName = MONATE[abrechnung.monat - 1];

  return (
    <div className="min-h-screen bg-white p-0">
      {/* Print-Button — only visible on screen */}
      <div className="print:hidden fixed top-4 right-4 flex gap-2">
        <button
          onClick={() => window.print()}
          className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 shadow"
        >
          Drucken
        </button>
        <button
          onClick={() => window.close()}
          className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 shadow"
        >
          Schließen
        </button>
      </div>

      <div className="max-w-2xl mx-auto p-8 print:p-0 print:max-w-none">
        {/* Firmen-Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <div className="text-lg font-bold text-gray-900">{firma.name ?? "Firma"}</div>
            <div className="text-sm text-gray-600">{firma.adresse}</div>
            <div className="text-sm text-gray-600">{firma.plz} {firma.ort}</div>
            {firma.tel && <div className="text-sm text-gray-600">Tel: {firma.tel}</div>}
            {firma.email && <div className="text-sm text-gray-600">{firma.email}</div>}
          </div>
          <div className="text-right">
            <div className="text-xl font-bold text-gray-800">Gehaltsabrechnung</div>
            <div className="text-sm text-gray-500">{monatName} {abrechnung.jahr}</div>
            <div className="text-xs text-gray-400 mt-1">Nr. {abrechnung.id}</div>
          </div>
        </div>

        <hr className="border-gray-300 mb-6" />

        {/* Mitarbeiter-Daten */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400 mb-2">Mitarbeiter</div>
            <div className="font-semibold text-gray-900">{ma.vorname} {ma.nachname}</div>
            <div className="text-sm text-gray-500">{TYP_LABEL[ma.typ] ?? ma.typ}</div>
            {ma.kostenstelle && <div className="text-sm text-gray-500">Kostenstelle: {ma.kostenstelle}</div>}
          </div>
          <div>
            <div className="text-xs font-semibold uppercase text-gray-400 mb-2">Abrechnungszeitraum</div>
            <div className="font-semibold text-gray-900">{monatName} {abrechnung.jahr}</div>
            <div className="text-sm text-gray-500">Status: {STATUS_LABEL[abrechnung.status] ?? abrechnung.status}</div>
            {abrechnung.zahlungsDatum && (
              <div className="text-sm text-gray-500">
                Ausgezahlt: {new Date(abrechnung.zahlungsDatum).toLocaleDateString("de-DE")}
              </div>
            )}
          </div>
        </div>

        {/* Vergütungsübersicht */}
        <div className="bg-gray-50 rounded-lg p-4 mb-6">
          <div className="text-xs font-semibold uppercase text-gray-400 mb-3">Vergütung</div>
          <div className="space-y-2">
            {abrechnung.stundenGesamt != null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">
                  Arbeitsstunden ({abrechnung.stundenGesamt.toFixed(1)} h
                  {ma.stundenlohn ? ` × ${ma.stundenlohn.toFixed(2)} €` : ""})
                </span>
                <span className="text-gray-800">{abrechnung.brutto.toFixed(2)} €</span>
              </div>
            )}
            {abrechnung.stundenGesamt == null && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Bruttogehalt</span>
                <span className="text-gray-800">{abrechnung.brutto.toFixed(2)} €</span>
              </div>
            )}
            {abrechnung.abzuege > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Abzüge</span>
                <span className="text-red-600">- {abrechnung.abzuege.toFixed(2)} €</span>
              </div>
            )}
            <div className="border-t border-gray-300 pt-2 flex justify-between font-semibold">
              <span>Auszahlungsbetrag (Netto)</span>
              <span className="text-green-700 text-lg">{abrechnung.netto.toFixed(2)} €</span>
            </div>
          </div>
        </div>

        {/* Bankverbindung des Mitarbeiters */}
        {ma.iban && (
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase text-gray-400 mb-2">Überweisungsdaten</div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">Kontoinhaber:</span> {ma.kontoinhaber ?? `${ma.vorname} ${ma.nachname}`}
            </div>
            <div className="text-sm text-gray-700">
              <span className="font-medium">IBAN:</span> {ma.iban}
            </div>
            {ma.bic && (
              <div className="text-sm text-gray-700">
                <span className="font-medium">BIC:</span> {ma.bic}
              </div>
            )}
          </div>
        )}

        {/* Notiz */}
        {abrechnung.notiz && (
          <div className="mb-6">
            <div className="text-xs font-semibold uppercase text-gray-400 mb-1">Hinweis</div>
            <div className="text-sm text-gray-600">{abrechnung.notiz}</div>
          </div>
        )}

        {/* Footer */}
        <hr className="border-gray-200 mb-4" />
        <div className="flex justify-between text-xs text-gray-400">
          <span>Dieser Gehaltszettel wurde maschinell erstellt und bedarf keiner Unterschrift.</span>
          <span>AgrarOffice</span>
        </div>
      </div>

      <style>{`
        @media print {
          @page { size: A4; margin: 1.5cm; }
          body { background: white; }
        }
      `}</style>
    </div>
  );
}
