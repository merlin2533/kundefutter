"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import * as Sentry from "@sentry/nextjs";
import SearchableSelect from "@/components/SearchableSelect";
import { haltungsformLabel } from "@/lib/auswahllisten";
import { berechneEierMhd } from "@/lib/eier-mhd";
import { EI_GROESSEN, type EtikettGroesse } from "@/components/etiketten/etikettGroessen";

interface Position {
  id: number;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr: string | null;
  legedatum: string | null;
  erzeugercode: string | null;
  artikel: { id: number; name: string; einheit: string };
}

interface Sortierung {
  id: number;
  datum: string;
  positionen: Position[];
}

interface EtikettFelder {
  artikelName: string;
  gueteklasse: string;
  gewichtsklasse: string;
  chargeNr: string;
  legedatum: string; // yyyy-mm-dd
  erzeugercode: string;
  haltungsform: string;
  eieranzahl: string;
  kuehlhinweis: string;
  zulassungsnummer: string;
}

const DEFAULT_KUEHLHINWEIS = "Nach dem Kauf kühl lagern.";

const leereFelder: EtikettFelder = {
  artikelName: "",
  gueteklasse: "",
  gewichtsklasse: "",
  chargeNr: "",
  legedatum: "",
  erzeugercode: "",
  haltungsform: "",
  eieranzahl: "",
  kuehlhinweis: DEFAULT_KUEHLHINWEIS,
  zulassungsnummer: "",
};

function qrPayload(f: EtikettFelder): string {
  return [f.erzeugercode ? `EC:${f.erzeugercode}` : "", f.chargeNr ? `CH:${f.chargeNr}` : ""].filter(Boolean).join("|");
}

interface EtikettProps {
  felder: EtikettFelder;
  groesse: EtikettGroesse;
}

function Etikett({ felder, groesse }: EtikettProps) {
  const g = EI_GROESSEN.find((x) => x.value === groesse) ?? EI_GROESSEN[0];
  const [qrSrc, setQrSrc] = useState("");
  const payload = qrPayload(felder);

  useEffect(() => {
    if (!payload) {
      setQrSrc("");
      return;
    }
    let cancelled = false;
    QRCode.toDataURL(payload, { margin: 0, width: 160 })
      .then((url) => {
        if (!cancelled) setQrSrc(url);
      })
      .catch((err) => {
        Sentry.captureException(err);
      });
    return () => {
      cancelled = true;
    };
  }, [payload]);

  const mhd = felder.legedatum ? berechneEierMhd(new Date(felder.legedatum)) : null;
  const klein = groesse === "70x40";

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
      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", overflow: "hidden" }}>
        <div style={{ fontSize: klein ? "7px" : "8px", fontWeight: "bold", lineHeight: 1.3, overflow: "hidden" }}>
          {felder.artikelName || "Eier"}
          {(felder.gueteklasse || felder.gewichtsklasse) && (
            <> — Güteklasse {felder.gueteklasse || "?"} · Gewichtsklasse {felder.gewichtsklasse || "?"}</>
          )}
        </div>
        <div style={{ fontSize: klein ? "5.5px" : "6.5px", color: "#333", display: "flex", flexDirection: "column", gap: "0.6mm", lineHeight: 1.3 }}>
          {felder.haltungsform && <span>Haltungsform: {felder.haltungsform}</span>}
          {felder.erzeugercode && <span>Erzeugercode: {felder.erzeugercode}</span>}
          {mhd && <span>MHD: {mhd.toLocaleDateString("de-DE")}</span>}
          {felder.chargeNr && <span>Charge: {felder.chargeNr}</span>}
          {felder.eieranzahl && <span>Anzahl: {felder.eieranzahl} Stück</span>}
        </div>
        <div style={{ fontSize: klein ? "5px" : "6px", color: "#555", lineHeight: 1.3 }}>
          {felder.kuehlhinweis && <div>{felder.kuehlhinweis}</div>}
          {felder.zulassungsnummer && <div>Packstellen-Zulassungsnr. {felder.zulassungsnummer}</div>}
        </div>
      </div>

      {qrSrc && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrSrc} alt="QR-Code" style={{ width: klein ? "20mm" : "26mm", height: "auto" }} />
        </div>
      )}
    </div>
  );
}

export default function EierEtikettenPage() {
  const [sortierungen, setSortierungen] = useState<Sortierung[]>([]);
  const [selectedPosId, setSelectedPosId] = useState("");
  const [felder, setFelder] = useState<EtikettFelder>(leereFelder);
  const [anzahl, setAnzahl] = useState(1);
  const [groesse, setGroesse] = useState<EtikettGroesse>("70x40");
  const [generated, setGenerated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/eiersortierung").then((r) => (r.ok ? r.json() : [])),
      fetch("/api/einstellungen?prefix=firma.").then((r) => (r.ok ? r.json() : {})),
    ])
      .then(([sorts, ein]: [Sortierung[], Record<string, string>]) => {
        setSortierungen(Array.isArray(sorts) ? sorts : []);
        setFelder((f) => ({
          ...f,
          kuehlhinweis: ein["firma.eierKuehlhinweis"]?.trim() || DEFAULT_KUEHLHINWEIS,
          zulassungsnummer: ein["firma.eierZulassungsnummer"] ?? "",
        }));
      })
      .catch((err) => {
        Sentry.captureException(err);
      })
      .finally(() => setLoading(false));
  }, []);

  const positionOptions = useMemo(
    () =>
      sortierungen.flatMap((s) =>
        s.positionen.map((p) => ({
          value: String(p.id),
          label: `${p.artikel.name} · ${p.gueteklasse}/${p.gewichtsklasse}${p.chargeNr ? " · " + p.chargeNr : ""} (${new Date(s.datum).toLocaleDateString("de-DE")})`,
          position: p,
        }))
      ),
    [sortierungen]
  );

  function handleSelectPosition(id: string) {
    setSelectedPosId(id);
    const opt = positionOptions.find((o) => o.value === id);
    if (!opt) return;
    const p = opt.position;
    const haltung = p.erzeugercode && /^[0-3]/.test(p.erzeugercode) ? haltungsformLabel(parseInt(p.erzeugercode[0], 10)) : null;
    setFelder((f) => ({
      ...f,
      artikelName: p.artikel.name,
      gueteklasse: p.gueteklasse,
      gewichtsklasse: p.gewichtsklasse,
      chargeNr: p.chargeNr ?? "",
      legedatum: p.legedatum ? p.legedatum.slice(0, 10) : "",
      erzeugercode: p.erzeugercode ?? "",
      haltungsform: haltung ?? "",
      eieranzahl: String(p.menge),
    }));
  }

  function updateFeld<K extends keyof EtikettFelder>(key: K, value: EtikettFelder[K]) {
    setFelder((f) => ({ ...f, [key]: value }));
  }

  function handleGenerate() {
    setGenerated(true);
  }

  function handlePrint() {
    window.print();
  }

  function handleReset() {
    setGenerated(false);
  }

  const inputCls = "w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700";
  const kannErzeugen = !!felder.artikelName && !!felder.gueteklasse && !!felder.gewichtsklasse;
  const etiketten = kannErzeugen ? Array.from({ length: Math.min(Math.max(anzahl, 1), 100) }) : [];

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          body { margin: 0; padding: 0; background: white; }
          .etiketten-print-area {
            display: grid !important;
            grid-template-columns: repeat(auto-fill, minmax(70mm, 1fr));
            gap: 2mm;
            padding: 5mm;
          }
          .etikett {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
        }
      `}</style>

      <div className="no-print">
        <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold">Eierkarton-Etiketten</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Etiketten aus einer bereits erfassten Sortierung — alle Felder bleiben danach frei überschreibbar.
            </p>
          </div>
          <div className="flex gap-2">
            {generated && (
              <>
                <button onClick={handleReset} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium">
                  Neue Konfiguration
                </button>
                <button onClick={handlePrint} className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium">
                  Drucken
                </button>
              </>
            )}
            <Link href="/eiersortierung" className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50 font-medium text-gray-700">
              ← Zurück
            </Link>
          </div>
        </div>

        {!generated ? (
          <div className="bg-white rounded-xl border border-gray-300 shadow-sm p-4 sm:p-6 max-w-xl space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sortierungs-Charge übernehmen (optional)</label>
              <SearchableSelect
                options={positionOptions.map((o) => ({ value: o.value, label: o.label }))}
                value={selectedPosId}
                onChange={handleSelectPosition}
                placeholder={loading ? "Lade Sortierungen…" : "— manuell ausfüllen oder Charge wählen —"}
              />
              <p className="text-xs text-gray-400 mt-1">Befüllt die Felder unten automatisch — danach frei änderbar.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Artikel <span className="text-red-500">*</span>
                </label>
                <input type="text" value={felder.artikelName} onChange={(e) => updateFeld("artikelName", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Güteklasse <span className="text-red-500">*</span>
                </label>
                <input type="text" value={felder.gueteklasse} onChange={(e) => updateFeld("gueteklasse", e.target.value.toUpperCase())} placeholder="A" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gewichtsklasse <span className="text-red-500">*</span>
                </label>
                <input type="text" value={felder.gewichtsklasse} onChange={(e) => updateFeld("gewichtsklasse", e.target.value.toUpperCase())} placeholder="M" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Haltungsform</label>
                <input type="text" value={felder.haltungsform} onChange={(e) => updateFeld("haltungsform", e.target.value)} placeholder="z.B. Freiland" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Erzeugercode</label>
                <input type="text" value={felder.erzeugercode} onChange={(e) => updateFeld("erzeugercode", e.target.value)} placeholder="1-DE-0123451" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Legedatum</label>
                <input type="date" value={felder.legedatum} onChange={(e) => updateFeld("legedatum", e.target.value)} className={inputCls} />
                {felder.legedatum && (
                  <p className="text-xs text-gray-500 mt-1">MHD: {berechneEierMhd(new Date(felder.legedatum)).toLocaleDateString("de-DE")}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Chargennummer</label>
                <input type="text" value={felder.chargeNr} onChange={(e) => updateFeld("chargeNr", e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Eieranzahl</label>
                <input type="number" min={0} value={felder.eieranzahl} onChange={(e) => updateFeld("eieranzahl", e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Kühlhinweis</label>
                <input type="text" value={felder.kuehlhinweis} onChange={(e) => updateFeld("kuehlhinweis", e.target.value)} className={inputCls} />
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Packstellen-Zulassungsnummer</label>
                <input type="text" value={felder.zulassungsnummer} onChange={(e) => updateFeld("zulassungsnummer", e.target.value)} placeholder="DE-1234" className={inputCls} />
                <p className="text-xs text-gray-400 mt-1">
                  Standardwert aus <Link href="/einstellungen/firma" className="underline">Firma-Einstellungen</Link>, hier je Etikett überschreibbar.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Anzahl Etiketten</label>
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
                <label className="block text-sm font-medium text-gray-700 mb-1">Etikett-Größe</label>
                <select value={groesse} onChange={(e) => setGroesse(e.target.value as EtikettGroesse)} className={inputCls}>
                  {EI_GROESSEN.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={handleGenerate}
              disabled={!kannErzeugen}
              className="w-full px-4 py-2.5 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium disabled:opacity-50 transition-colors"
            >
              {anzahl} Etikett{anzahl !== 1 ? "en" : ""} generieren
            </button>
            {!kannErzeugen && <p className="text-xs text-amber-600">Artikel, Güteklasse und Gewichtsklasse sind Pflichtfelder.</p>}
          </div>
        ) : (
          <div className="mb-4 bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800 flex items-center justify-between gap-3 flex-wrap">
            <span>
              <span className="font-semibold">{etiketten.length} Etiketten</span> für <span className="font-semibold">{felder.artikelName}</span> bereit.
            </span>
            <button onClick={handlePrint} className="px-4 py-2 text-sm rounded-lg bg-green-800 hover:bg-green-700 text-white font-medium">
              Drucken
            </button>
          </div>
        )}
      </div>

      {generated && (
        <div className="etiketten-print-area flex flex-wrap gap-2 mt-2">
          {etiketten.map((_, i) => (
            <Etikett key={i} felder={felder} groesse={groesse} />
          ))}
        </div>
      )}
    </>
  );
}
