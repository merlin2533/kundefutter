"use client";
import { useEffect, useState } from "react";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string | null;
  kategorie: string | null;
  einheit: string;
}

type EtikettGroesse = "50x30" | "70x40" | "100x50";

const GROESSEN: { value: EtikettGroesse; label: string; width: string; height: string }[] = [
  { value: "50x30", label: "50×30 mm (Standard)", width: "50mm", height: "30mm" },
  { value: "70x40", label: "70×40 mm (Mittel)",   width: "70mm", height: "40mm" },
  { value: "100x50", label: "100×50 mm (Groß)",   width: "100mm", height: "50mm" },
];

function qrUrl(data: string) {
  return `https://api.qrserver.com/v1/create-qr-code/?size=80x80&data=${encodeURIComponent(data)}`;
}

interface EtikettProps {
  artikel: Artikel;
  firmenname: string;
  chargeNr: string;
  lagerort: string;
  groesse: EtikettGroesse;
}

function Etikett({ artikel, firmenname, chargeNr, lagerort, groesse }: EtikettProps) {
  const g = GROESSEN.find((x) => x.value === groesse)!;
  const qrData = [
    artikel.artikelnummer ?? String(artikel.id),
    chargeNr ? `CH:${chargeNr}` : "",
    lagerort ? `LO:${lagerort}` : "",
  ]
    .filter(Boolean)
    .join("|");

  return (
    <div
      className="etikett"
      style={{
        width: g.width,
        height: g.height,
        border: "0.5mm solid #000",
        padding: "2mm",
        display: "flex",
        flexDirection: "row",
        alignItems: "stretch",
        gap: "2mm",
        boxSizing: "border-box",
        pageBreakInside: "avoid",
        breakInside: "avoid",
        backgroundColor: "#fff",
        fontFamily: "Arial, sans-serif",
        overflow: "hidden",
      }}
    >
      {/* Text section */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
        {firmenname && (
          <div style={{ fontSize: "5px", color: "#555", textTransform: "uppercase", letterSpacing: "0.3px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {firmenname}
          </div>
        )}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "1mm" }}>
          <div style={{ fontSize: groesse === "50x30" ? "7px" : groesse === "70x40" ? "8px" : "10px", fontWeight: "bold", lineHeight: 1.2, overflow: "hidden" }}>
            {artikel.name}
          </div>
          {artikel.artikelnummer && (
            <div style={{ fontSize: "5px", color: "#666" }}>
              Art.-Nr.: {artikel.artikelnummer}
            </div>
          )}
        </div>
        <div style={{ fontSize: "5px", color: "#444", display: "flex", flexDirection: "column", gap: "0.5mm" }}>
          {chargeNr && <span>Charge: {chargeNr}</span>}
          {lagerort && <span>Lager: {lagerort}</span>}
        </div>
      </div>

      {/* QR Code */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={qrUrl(qrData)}
          alt={`QR-Code für ${artikel.name}`}
          style={{ width: groesse === "50x30" ? "18mm" : groesse === "70x40" ? "22mm" : "28mm", height: "auto" }}
        />
      </div>
    </div>
  );
}

export default function EtikettenPage() {
  const [artikelList, setArtikelList] = useState<Artikel[]>([]);
  const [selectedArtikelId, setSelectedArtikelId] = useState("");
  const [chargeNr, setChargeNr] = useState("");
  const [lagerort, setLagerort] = useState("");
  const [anzahl, setAnzahl] = useState(1);
  const [groesse, setGroesse] = useState<EtikettGroesse>("50x30");
  const [firmenname, setFirmenname] = useState("");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      const [artRes, einRes] = await Promise.all([
        fetch("/api/artikel?limit=500").then((r) => (r.ok ? r.json() : [])),
        fetch("/api/einstellungen?prefix=firma.").then((r) => (r.ok ? r.json() : {})),
      ]);
      setArtikelList(Array.isArray(artRes) ? artRes : []);
      setFirmenname(einRes["firma.name"] ?? einRes["system.firmenname"] ?? "");
    }
    load();
  }, []);

  const selectedArtikel = artikelList.find((a) => String(a.id) === selectedArtikelId) ?? null;

  function handleGenerate() {
    if (!selectedArtikel) return;
    setLoading(true);
    // Small delay to allow QR images to start loading before print dialog
    setTimeout(() => {
      setLoading(false);
      setGenerated(true);
    }, 300);
  }

  function handlePrint() {
    window.print();
  }

  function handleReset() {
    setGenerated(false);
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";

  const etiketten = selectedArtikel
    ? Array.from({ length: Math.min(Math.max(anzahl, 1), 100) })
    : [];

  return (
    <>
      {/* Print styles */}
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          .etiketten-print-area {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(50mm, 1fr));
            gap: 2mm;
            padding: 5mm;
          }
          .etikett {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      {/* Config panel (hidden on print) */}
      <div className="no-print">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <h1 className="text-2xl font-bold">Etiketten-Druck</h1>
          {generated && (
            <div className="flex gap-2">
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium"
              >
                Neue Konfiguration
              </button>
              <button
                onClick={handlePrint}
                className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium"
              >
                Drucken
              </button>
            </div>
          )}
        </div>

        {!generated ? (
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-4 sm:p-6 max-w-lg space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Artikel <span className="text-red-500">*</span>
              </label>
              <SearchableSelect
                options={artikelList.map((a) => ({ value: a.id, label: a.name }))}
                value={selectedArtikelId}
                onChange={setSelectedArtikelId}
                placeholder="-- Artikel wählen --"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chargennummer (optional)
              </label>
              <input
                type="text"
                value={chargeNr}
                onChange={(e) => setChargeNr(e.target.value)}
                placeholder="z.B. CH-2024-001"
                className={inputCls}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lagerort (optional)
              </label>
              <input
                type="text"
                value={lagerort}
                onChange={(e) => setLagerort(e.target.value)}
                placeholder="z.B. Halle A, Regal 3"
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anzahl Etiketten
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={anzahl}
                  onChange={(e) => setAnzahl(Math.min(100, Math.max(1, parseInt(e.target.value, 10) || 1)))}
                  className={inputCls}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Etikett-Größe
                </label>
                <select
                  value={groesse}
                  onChange={(e) => setGroesse(e.target.value as EtikettGroesse)}
                  className={inputCls}
                >
                  {GROESSEN.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!selectedArtikelId || loading}
              className="w-full px-4 py-2.5 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? "Generiere…" : `${anzahl} Etikett${anzahl !== 1 ? "en" : ""} generieren`}
            </button>
          </div>
        ) : (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center justify-between gap-3 flex-wrap">
            <span>
              <span className="font-semibold">{etiketten.length} Etiketten</span> für{" "}
              <span className="font-semibold">{selectedArtikel?.name}</span> bereit.
            </span>
            <button
              onClick={handlePrint}
              className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium"
            >
              Drucken
            </button>
          </div>
        )}
      </div>

      {/* Etiketten preview + print area */}
      {generated && selectedArtikel && (
        <div className="etiketten-print-area flex flex-wrap gap-2 mt-2">
          {etiketten.map((_, i) => (
            <Etikett
              key={i}
              artikel={selectedArtikel}
              firmenname={firmenname}
              chargeNr={chargeNr}
              lagerort={lagerort}
              groesse={groesse}
            />
          ))}
        </div>
      )}
    </>
  );
}
