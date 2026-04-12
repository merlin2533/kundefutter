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
  "firma.iban": string;
  "firma.bic": string;
  "firma.bank": string;
  "firma.mwstSatz": string;
  "firma.zahlungszielStandard": string;
}

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
  "firma.iban": "",
  "firma.bic": "",
  "firma.bank": "",
  "firma.mwstSatz": "19",
  "firma.zahlungszielStandard": "30",
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
      { key: "firma.strasse" as keyof FirmaSettings, label: "Straße & Hausnummer", placeholder: "Musterstraße 1" },
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
    title: "Steuer",
    fields: [
      { key: "firma.steuernummer" as keyof FirmaSettings, label: "Steuernummer", placeholder: "123/456/78901" },
      { key: "firma.ustIdNr" as keyof FirmaSettings, label: "USt-IdNr.", placeholder: "DE123456789" },
      { key: "firma.mwstSatz" as keyof FirmaSettings, label: "Standard-MwSt-Satz (%)", type: "number", placeholder: "19" },
    ],
  },
  {
    title: "Bankverbindung",
    badge: "Rechnungs-Footer",
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

export default function FirmaPage() {
  const [form, setForm] = useState<FirmaSettings>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((prev) => ({ ...prev, ...data }));
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    setError(null);
    try {
      for (const section of SECTIONS) {
        for (const field of section.fields) {
          await fetch("/api/einstellungen", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key: field.key, value: form[field.key] }),
          });
        }
      }
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

  const footerParts = [
    form["firma.name"],
    [form["firma.strasse"], [form["firma.plz"], form["firma.ort"]].filter(Boolean).join(" ")].filter(Boolean).join(", "),
    form["firma.telefon"] ? `Tel: ${form["firma.telefon"]}` : "",
    form["firma.email"],
    form["firma.steuernummer"] ? `Steuernr.: ${form["firma.steuernummer"]}` : (form["firma.ustIdNr"] ? `USt-IdNr.: ${form["firma.ustIdNr"]}` : ""),
  ].filter(Boolean);

  const bankParts = [
    form["firma.bank"],
    form["firma.iban"] ? `IBAN: ${form["firma.iban"]}` : "",
    form["firma.bic"] ? `BIC: ${form["firma.bic"]}` : "",
  ].filter(Boolean);

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
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">{section.title}</h2>
              {section.badge && (
                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                  {section.badge}
                </span>
              )}
            </div>
            <div className="p-5 space-y-3">
              {section.fields.map((field) => (
                <div key={field.key} className="grid grid-cols-[160px_1fr] items-center gap-3">
                  <label className="text-sm font-medium text-gray-600 text-right">
                    {field.label}
                  </label>
                  <input
                    type={field.type ?? "text"}
                    value={form[field.key]}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                    }
                    placeholder={field.placeholder}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 w-full"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Rechnungs-Footer Vorschau */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Vorschau – Rechnungs-Footer</h2>
            <span className="text-xs text-gray-400">So erscheint die Fußzeile auf Ihren Rechnungen</span>
          </div>
          <div className="p-5">
            <div
              style={{
                fontFamily: "Arial, Helvetica, sans-serif",
                fontSize: "9pt",
                color: "#444",
                borderTop: "1px solid #ccc",
                paddingTop: "10px",
                display: "flex",
                flexWrap: "wrap",
                gap: "16px",
                justifyContent: "space-between",
              }}
            >
              <span style={{ color: "#666" }}>
                {footerParts.length > 0
                  ? footerParts.join(" · ")
                  : <span style={{ color: "#bbb" }}>Firmenname · Adresse · Telefon · E-Mail · Steuernummer</span>}
              </span>
              {bankParts.length > 0 && (
                <span style={{ color: "#666", display: "flex", gap: "12px", flexWrap: "wrap" }}>
                  {bankParts.map((p, i) => <span key={i}>{p}</span>)}
                </span>
              )}
            </div>
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
