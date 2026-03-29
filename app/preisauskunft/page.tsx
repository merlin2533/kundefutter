"use client";
import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";
import { formatEuro, berechneMarge, lagerStatus } from "@/lib/utils";

interface ArtikelOption {
  value: string;
  label: string;
  sub?: string;
}

interface KundeOption {
  value: string;
  label: string;
  sub?: string;
}

interface ArtikelDetail {
  id: number;
  name: string;
  artikelnummer: string;
  kategorie: string;
  einheit: string;
  standardpreis: number;
  mwstSatz: number;
  mindestbestand: number;
  aktuellerBestand: number;
  preisHistorie: { id: number; alterPreis: number; neuerPreis: number; geaendertAm: string }[];
  lieferanten: { id: number; einkaufspreis: number; bevorzugt: boolean; lieferant: { name: string } }[];
}

interface Sonderpreis {
  id: number;
  artikelId: number;
  preis: number;
  rabatt: number;
}

interface Mengenrabatt {
  id: number;
  vonMenge: number;
  rabattProzent: number;
  aktiv: boolean;
  kunde: { id: number; name: string } | null;
}

const LAGER_COLOR: Record<string, { bg: string; text: string; label: string }> = {
  gruen: { bg: "bg-green-100", text: "text-green-800", label: "Ausreichend" },
  gelb: { bg: "bg-yellow-100", text: "text-yellow-800", label: "Knapp" },
  rot: { bg: "bg-red-100", text: "text-red-800", label: "Kritisch" },
};

export default function PreisauskunftPage() {
  const [artikelOptions, setArtikelOptions] = useState<ArtikelOption[]>([]);
  const [kundeOptions, setKundeOptions] = useState<KundeOption[]>([]);
  const [selectedArtikel, setSelectedArtikel] = useState("");
  const [selectedKunde, setSelectedKunde] = useState("");
  const [artikel, setArtikel] = useState<ArtikelDetail | null>(null);
  const [sonderpreise, setSonderpreise] = useState<Sonderpreis[]>([]);
  const [mengenrabatte, setMengenrabatte] = useState<Mengenrabatt[]>([]);
  const [loadingArtikel, setLoadingArtikel] = useState(false);
  const [loadingPreise, setLoadingPreise] = useState(false);

  // Load artikel options
  useEffect(() => {
    fetch("/api/artikel")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setArtikelOptions(
            data.map((a: { id: number; name: string; artikelnummer: string; kategorie: string }) => ({
              value: String(a.id),
              label: a.name,
              sub: a.artikelnummer,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Load kunde options
  useEffect(() => {
    fetch("/api/kunden?aktiv=true")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setKundeOptions(
            data.map((k: { id: number; name: string; firma: string | null }) => ({
              value: String(k.id),
              label: k.name,
              sub: k.firma ?? undefined,
            }))
          );
        }
      })
      .catch(() => {});
  }, []);

  // Fetch artikel details + mengenrabatte when artikel changes
  useEffect(() => {
    if (!selectedArtikel) {
      setArtikel(null);
      setMengenrabatte([]);
      return;
    }
    setLoadingArtikel(true);
    Promise.all([
      fetch(`/api/artikel/${selectedArtikel}`).then((r) => r.json()),
      fetch(`/api/mengenrabatte`).then((r) => r.json()),
    ])
      .then(([art, rabs]) => {
        setArtikel(art);
        if (Array.isArray(rabs)) {
          setMengenrabatte(
            rabs.filter(
              (r: Mengenrabatt & { artikelId: number | null }) =>
                r.artikelId === art.id && r.aktiv
            )
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingArtikel(false));
  }, [selectedArtikel]);

  // Fetch sonderpreise when kunde changes
  useEffect(() => {
    if (!selectedKunde) {
      setSonderpreise([]);
      return;
    }
    setLoadingPreise(true);
    fetch(`/api/kunden/${selectedKunde}/preise`)
      .then((r) => r.json())
      .then((data) => setSonderpreise(Array.isArray(data) ? data : []))
      .catch(() => {})
      .finally(() => setLoadingPreise(false));
  }, [selectedKunde]);

  const sonderpreis = selectedArtikel && selectedKunde
    ? sonderpreise.find((s) => s.artikelId === Number(selectedArtikel)) ?? null
    : null;

  const einkaufspreis = artikel
    ? (artikel.lieferanten.find((l) => l.bevorzugt)?.einkaufspreis ??
        artikel.lieferanten[0]?.einkaufspreis ?? 0)
    : 0;

  const marge = artikel
    ? berechneMarge(artikel.standardpreis, einkaufspreis)
    : null;

  const lagerAmpel = artikel
    ? lagerStatus(artikel.aktuellerBestand, artikel.mindestbestand)
    : null;

  const letztePreisaenderung = artikel?.preisHistorie?.[0] ?? null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-1">Preisauskunft</h1>
        <p className="text-sm text-gray-500">Was kostet ein Artikel — für welchen Kunden?</p>
      </div>

      {/* Selects */}
      <div className="grid sm:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Artikel</label>
          <SearchableSelect
            options={artikelOptions}
            value={selectedArtikel}
            onChange={setSelectedArtikel}
            placeholder="Artikel wählen…"
            allowClear
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kunde (optional)</label>
          <SearchableSelect
            options={kundeOptions}
            value={selectedKunde}
            onChange={setSelectedKunde}
            placeholder="Kunde wählen…"
            allowClear
          />
        </div>
      </div>

      {!selectedArtikel && (
        <p className="text-center text-gray-400 text-sm mt-12">Artikel wählen, um Preisinfos zu sehen.</p>
      )}

      {loadingArtikel && (
        <div className="text-center text-gray-400 text-sm mt-12">Lade…</div>
      )}

      {artikel && !loadingArtikel && (
        <div className="space-y-4">
          {/* Basis-Preisinfo */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <h2 className="text-lg font-semibold mb-4">{artikel.name}</h2>

            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                {/* Standardpreis */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Standardpreis</span>
                  <span className="font-semibold text-lg">{formatEuro(artikel.standardpreis)}</span>
                </div>

                {/* Einkaufspreis */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Einkaufspreis</span>
                  <span className="font-mono">{formatEuro(einkaufspreis)}</span>
                </div>

                {/* Marge */}
                {marge && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Marge</span>
                    <span className={`font-medium ${marge.margeProzent < 10 ? "text-red-600" : marge.margeProzent < 20 ? "text-yellow-600" : "text-green-600"}`}>
                      {marge.margeProzent.toFixed(1)} % ({formatEuro(marge.margeEuro)})
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                {/* Bestand */}
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 text-sm">Aktueller Bestand</span>
                  <span className="font-medium">
                    {artikel.aktuellerBestand.toLocaleString("de-DE")} {artikel.einheit}
                  </span>
                </div>

                {/* Lagerampel */}
                {lagerAmpel && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Lager</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${LAGER_COLOR[lagerAmpel].bg} ${LAGER_COLOR[lagerAmpel].text}`}>
                      {LAGER_COLOR[lagerAmpel].label}
                    </span>
                  </div>
                )}

                {/* Letzte Preisänderung */}
                {letztePreisaenderung && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Letzte Preisänderung</span>
                    <span className="text-xs text-gray-500">
                      {new Date(letztePreisaenderung.geaendertAm).toLocaleDateString("de-DE")}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sonderpreis für Kunde */}
          {selectedKunde && (
            <div className={`rounded-xl border shadow-sm p-5 ${sonderpreis ? "bg-green-50 border-green-200" : "bg-white border-gray-200"}`}>
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Sonderpreis für diesen Kunden</h3>
              {loadingPreise ? (
                <p className="text-sm text-gray-400">Lade…</p>
              ) : sonderpreis ? (
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 text-sm">Basispreis (Sonderpreis)</span>
                    <span className="text-green-700 font-bold text-lg">{formatEuro(sonderpreis.preis)}</span>
                  </div>
                  {sonderpreis.rabatt > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Zusätzlicher Rabatt</span>
                      <span className="text-green-700 font-medium">{sonderpreis.rabatt} %</span>
                    </div>
                  )}
                  {sonderpreis.rabatt > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 text-sm">Endpreis nach Rabatt</span>
                      <span className="text-green-700 font-bold text-lg">
                        {formatEuro(sonderpreis.preis * (1 - sonderpreis.rabatt / 100))}
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-gray-500">Kein Sonderpreis — es gilt der Standardpreis: <strong>{formatEuro(artikel.standardpreis)}</strong></p>
              )}
            </div>
          )}

          {/* Mengenrabatte */}
          {mengenrabatte.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">Mengenrabatte</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left py-2 text-gray-500 font-medium">Ab Menge</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Rabatt</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Preis</th>
                      <th className="text-left py-2 text-gray-500 font-medium">Gilt für</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mengenrabatte
                      .sort((a, b) => a.vonMenge - b.vonMenge)
                      .map((r) => (
                        <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50">
                          <td className="py-2 font-medium">
                            ab {r.vonMenge.toLocaleString("de-DE")} {artikel.einheit}
                          </td>
                          <td className="py-2 text-green-700 font-medium">{r.rabattProzent} %</td>
                          <td className="py-2 font-mono">
                            {formatEuro(artikel.standardpreis * (1 - r.rabattProzent / 100))}
                          </td>
                          <td className="py-2 text-gray-500 text-xs">
                            {r.kunde ? r.kunde.name : "Alle Kunden"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
