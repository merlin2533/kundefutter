"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface FirmaSettings {
  "firma.name": string;
  "firma.zusatz": string;
  "firma.strasse": string;
  "firma.plz": string;
  "firma.ort": string;
  "firma.telefon": string;
  "firma.email": string;
  "firma.steuernummer": string;
  "firma.ustIdNr": string;
  "firma.oekoNummer": string;
  "firma.iban": string;
  "firma.bic": string;
  "firma.bank": string;
  "firma.mwstSatz": string;
  "firma.zahlungszielStandard": string;
  "dokument.footer.links": string;
  "dokument.footer.mitte": string;
  "dokument.footer.rechts": string;
  "dokument.rechnung.eigentumsvorbehalt": string;
}

const EIGENTUMSVORBEHALT_DEFAULT =
  "Die Ware bleibt bis zur vollständigen Bezahlung Eigentum von Landhandel Röthemeier.";

const DEFAULT_VALUES: FirmaSettings = {
  "firma.name": "",
  "firma.zusatz": "",
  "firma.strasse": "",
  "firma.plz": "",
  "firma.ort": "",
  "firma.telefon": "",
  "firma.email": "",
  "firma.steuernummer": "",
  "firma.ustIdNr": "",
  "firma.oekoNummer": "",
  "firma.iban": "",
  "firma.bic": "",
  "firma.bank": "",
  "firma.mwstSatz": "19",
  "firma.zahlungszielStandard": "30",
  "dokument.footer.links": "",
  "dokument.footer.mitte": "",
  "dokument.footer.rechts": "",
  "dokument.rechnung.eigentumsvorbehalt": "",
};

const SECTIONS = [
  {
    title: "Firmenname",
    fields: [
      { key: "firma.name" as keyof FirmaSettings, label: "Firmenname", placeholder: "Muster GmbH & Co. KG" },
      { key: "firma.zusatz" as keyof FirmaSettings, label: "Zusatz / Abteilung", placeholder: "z. B. Agrarhandel" },
    ],
  },
  {
    title: "Adresse",
    fields: [
      { key: "firma.strasse" as keyof FirmaSettings, label: "Straße & Hausnr.", placeholder: "Musterstraße 1" },
      { key: "firma.plz" as keyof FirmaSettings, label: "PLZ", placeholder: "12345" },
      { key: "firma.ort" as keyof FirmaSettings, label: "Ort", placeholder: "Musterstadt" },
    ],
  },
  {
    title: "Kontakt",
    fields: [
      { key: "firma.telefon" as keyof FirmaSettings, label: "Telefon", type: "tel", placeholder: "+49 123 456789" },
      { key: "firma.email" as keyof FirmaSettings, label: "E-Mail", type: "email", placeholder: "info@firma.de" },
    ],
  },
  {
    title: "Steuer & Registrierung",
    fields: [
      { key: "firma.steuernummer" as keyof FirmaSettings, label: "Steuernummer", placeholder: "123/456/78901" },
      { key: "firma.ustIdNr" as keyof FirmaSettings, label: "USt-IdNr.", placeholder: "DE123456789" },
      { key: "firma.oekoNummer" as keyof FirmaSettings, label: "Öko-Kontrollnummer", placeholder: "DE-ÖKO-006-12345" },
      { key: "firma.mwstSatz" as keyof FirmaSettings, label: "Standard-MwSt (%)", type: "number", placeholder: "19" },
    ],
  },
  {
    title: "Bankverbindung",
    fields: [
      { key: "firma.bank" as keyof FirmaSettings, label: "Bank", placeholder: "Volksbank Musterstadt" },
      { key: "firma.iban" as keyof FirmaSettings, label: "IBAN", placeholder: "DE12 3456 7890 1234 5678 90" },
      { key: "firma.bic" as keyof FirmaSettings, label: "BIC / SWIFT", placeholder: "VBMUSTDE" },
    ],
  },
  {
    title: "Zahlungskonditionen",
    fields: [
      { key: "firma.zahlungszielStandard" as keyof FirmaSettings, label: "Standard-Zahlungsziel (Tage)", type: "number", placeholder: "30" },
    ],
  },
];

function buildDefaultFooter(form: FirmaSettings) {
  const adresse = [
    form["firma.strasse"],
    [form["firma.plz"], form["firma.ort"]].filter(Boolean).join(" "),
  ].filter(Boolean).join(", ");

  const links = [form["firma.name"], form["firma.zusatz"], adresse]
    .filter(Boolean).join("\n");

  const mitteLines = [
    form["firma.telefon"] ? `Tel: ${form["firma.telefon"]}` : "",
    form["firma.email"],
    form["firma.steuernummer"] ? `Steuernr.: ${form["firma.steuernummer"]}` : "",
    form["firma.ustIdNr"] ? `USt-IdNr.: ${form["firma.ustIdNr"]}` : "",
    form["firma.oekoNummer"] ? `Öko-Nr.: ${form["firma.oekoNummer"]}` : "",
  ].filter(Boolean);
  const mitte = mitteLines.join("\n");

  const rechtsLines = [
    form["firma.bank"],
    form["firma.iban"] ? `IBAN: ${form["firma.iban"]}` : "",
    form["firma.bic"] ? `BIC: ${form["firma.bic"]}` : "",
  ].filter(Boolean);
  const rechts = rechtsLines.join("\n");

  return { links, mitte, rechts };
}

export default function FirmaPage() {
  const [form, setForm] = useState<FirmaSettings>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/einstellungen"),
        // Lädt dokument.footer.* UND dokument.rechnung.eigentumsvorbehalt
        fetch("/api/einstellungen?prefix=dokument."),
      ]);
      const d1 = await r1.json();
      const d2 = await r2.json();
      setForm((prev) => ({ ...prev, ...d1, ...d2 }));
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  function befuelleStandardFooter() {
    const { links, mitte, rechts } = buildDefaultFooter(form);
    setForm((prev) => ({
      ...prev,
      "dokument.footer.links": links,
      "dokument.footer.mitte": mitte,
      "dokument.footer.rechts": rechts,
    }));
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      const allKeys: (keyof FirmaSettings)[] = [
        ...SECTIONS.flatMap((s) => s.fields.map((f) => f.key)),
        "dokument.footer.links",
        "dokument.footer.mitte",
        "dokument.footer.rechts",
        "dokument.rechnung.eigentumsvorbehalt",
      ];
      await Promise.all(
        allKeys.map((key) =>
          fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: form[key] }),
          })
        )
      );
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;
  }

  const footerLinks = form["dokument.footer.links"] || buildDefaultFooter(form).links;
  const footerMitte = form["dokument.footer.mitte"] || buildDefaultFooter(form).mitte;
  const footerRechts = form["dokument.footer.rechts"] || buildDefaultFooter(form).rechts;

  return (
    <div className="max-w-3xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Firma</span>
      </div>

      <h1 className="text-2xl font-bold mb-2">Firmadaten</h1>
      <p className="text-sm text-gray-500 mb-6">Diese Daten erscheinen auf Rechnungen, Lieferscheinen und Angeboten.</p>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form onSubmit={handleSaveAll} className="space-y-5">
        {SECTIONS.map((section) => (
          <div key={section.title} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{section.title}</h2>
            </div>
            <div className="p-5 space-y-3">
              {section.fields.map((field) => (
                <div key={field.key} className="grid grid-cols-[180px_1fr] items-center gap-3">
                  <label className="text-sm font-medium text-gray-600 text-right">
                    {field.label}
                  </label>
                  <input
                    type={field.type ?? "text"}
                    value={form[field.key]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Dokument-Footer Konfiguration */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Dokument-Footer</h2>
              <p className="text-xs text-gray-400 mt-0.5">Erscheint auf Rechnungen und Lieferscheinen. Leer lassen = automatisch aus Firmadaten.</p>
            </div>
            <button
              type="button"
              onClick={befuelleStandardFooter}
              className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Standard befüllen
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: "dokument.footer.links" as keyof FirmaSettings, label: "Links", hint: "Name, Adresse" },
              { key: "dokument.footer.mitte" as keyof FirmaSettings, label: "Mitte", hint: "Tel, E-Mail, Steuernr., Öko-Nr." },
              { key: "dokument.footer.rechts" as keyof FirmaSettings, label: "Rechts", hint: "Bank, IBAN, BIC" },
            ].map(({ key, label, hint }) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-gray-600 mb-1">
                  {label} <span className="font-normal text-gray-400">({hint})</span>
                </label>
                <textarea
                  rows={4}
                  value={form[key]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [key]: e.target.value }))}
                  placeholder={`Leer = automatisch`}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
                />
              </div>
            ))}
          </div>

          {/* Live-Vorschau */}
          <div className="px-5 pb-5">
            <p className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Vorschau Footer</p>
            <div
              style={{
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: "8pt",
                color: "#555",
                borderTop: "1px solid #ccc",
                paddingTop: "8px",
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "12px",
              }}
            >
              {[footerLinks, footerMitte, footerRechts].map((text, i) => (
                <div key={i} style={{ whiteSpace: "pre-line", lineHeight: "1.5" }}>
                  {text || <span style={{ color: "#bbb" }}>leer</span>}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Rechnungs-Hinweis (Eigentumsvorbehalt o.ä.) */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100 bg-gray-50">
            <div>
              <h2 className="text-sm font-semibold text-gray-700">Rechnungs-Hinweis</h2>
              <p className="text-xs text-gray-400 mt-0.5">
                Erscheint klein gedruckt am unteren Rand jeder Rechnung (über dem Footer).
                Leer lassen = Standardtext (Eigentumsvorbehalt).
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  "dokument.rechnung.eigentumsvorbehalt": EIGENTUMSVORBEHALT_DEFAULT,
                }))
              }
              className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors whitespace-nowrap"
            >
              Standard befüllen
            </button>
          </div>
          <div className="p-5">
            <textarea
              rows={3}
              value={form["dokument.rechnung.eigentumsvorbehalt"]}
              onChange={(e) =>
                setForm((prev) => ({
                  ...prev,
                  "dokument.rechnung.eigentumsvorbehalt": e.target.value,
                }))
              }
              placeholder={EIGENTUMSVORBEHALT_DEFAULT}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
            />
            <p className="text-xs text-gray-400 mt-2">
              Beispiel: {EIGENTUMSVORBEHALT_DEFAULT}
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-2.5 text-sm bg-green-700 hover:bg-green-800 text-white rounded-lg font-medium transition-colors disabled:opacity-60 min-w-[140px]"
          >
            {saving ? "Speichern…" : saved ? "✓ Gespeichert" : "Alle speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}
