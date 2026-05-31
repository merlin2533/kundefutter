"use client";

import { useEffect, useRef, useState } from "react";

export interface EmailKontakt {
  wert: string;
  label?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  rechnungsEmail?: boolean;
  lieferscheinEmail?: boolean;
}

type DocType = "rechnung" | "lieferschein" | "angebot" | "gutschrift" | "mahnung" | "sonstige";

interface Props {
  open: boolean;
  onClose: () => void;
  title: string;
  kundenname: string;
  emailKontakte: EmailKontakt[];
  docType: DocType;
  onSend: (empfaenger: string, cc: string) => Promise<void>;
  loading: boolean;
  fehler?: string;
}

/** Wählt die beste Vorauswahl-Adresse je nach Dokumenttyp */
function bestEmail(kontakte: EmailKontakt[], docType: DocType): string {
  const emails = kontakte.filter((k) => k.wert.includes("@"));
  if (emails.length === 0) return "";
  if (docType === "rechnung" || docType === "mahnung") {
    const marked = emails.find((k) => k.rechnungsEmail);
    if (marked) return marked.wert;
  }
  if (docType === "lieferschein") {
    const marked = emails.find((k) => k.lieferscheinEmail);
    if (marked) return marked.wert;
  }
  return emails[0].wert;
}

function kontaktLabel(k: EmailKontakt): string {
  const name = [k.vorname, k.nachname].filter(Boolean).join(" ");
  const lbl = k.label ? ` (${k.label})` : "";
  return name ? `${name}${lbl} — ${k.wert}` : `${k.wert}${lbl}`;
}

export default function EmailVersandModal({
  open,
  onClose,
  title,
  kundenname,
  emailKontakte,
  docType,
  onSend,
  loading,
  fehler,
}: Props) {
  const [empfaenger, setEmpfaenger] = useState("");
  const [cc, setCc] = useState("");
  const [defaultCcLoaded, setDefaultCcLoaded] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | HTMLSelectElement | null>(null);

  const emails = emailKontakte.filter((k) => k.wert.includes("@"));

  // Pre-select best address and load default CC when modal opens
  useEffect(() => {
    if (!open) return;
    setEmpfaenger(bestEmail(emailKontakte, docType));
    if (!defaultCcLoaded) {
      fetch("/api/einstellungen?prefix=email.")
        .then((r) => r.json())
        .then((d: Record<string, string>) => {
          setCc(d["email.cc"] ?? "");
          setDefaultCcLoaded(true);
        })
        .catch(() => {});
    }
  }, [open, emailKontakte, docType, defaultCcLoaded]);

  if (!open) return null;

  async function handleSend() {
    await onSend(empfaenger.trim(), cc.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4 p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-gray-900">{title}</h2>
            <p className="text-xs text-gray-500 mt-0.5">{kundenname}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none ml-4"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4">
          {/* An */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">An</label>
            {emails.length > 1 ? (
              <select
                value={empfaenger}
                onChange={(e) => setEmpfaenger(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {emails.map((k) => (
                  <option key={k.wert} value={k.wert}>
                    {kontaktLabel(k)}
                    {k.rechnungsEmail ? " [Rechnung]" : ""}
                    {k.lieferscheinEmail ? " [Lieferschein]" : ""}
                  </option>
                ))}
                <option value="">Andere Adresse eingeben…</option>
              </select>
            ) : null}
            {(emails.length <= 1 || empfaenger === "") && (
              <input
                ref={(el) => { if (el) firstInputRef.current = el; }}
                type="email"
                value={empfaenger}
                onChange={(e) => setEmpfaenger(e.target.value)}
                placeholder="empfaenger@example.com"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mt-1"
              />
            )}
            {emails.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">Kein E-Mail-Kontakt hinterlegt — Adresse manuell eingeben.</p>
            )}
          </div>

          {/* CC */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              CC <span className="text-xs font-normal text-gray-400">(optional)</span>
            </label>
            <input
              type="email"
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              placeholder="kopie@ihrefirma.de"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <p className="text-xs text-gray-400 mt-0.5">Standard aus Einstellungen — hier überschreibbar</p>
          </div>
        </div>

        {fehler && (
          <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {fehler}
          </div>
        )}

        <div className="flex gap-2 justify-end mt-5">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            Abbrechen
          </button>
          <button
            onClick={handleSend}
            disabled={loading || !empfaenger.trim()}
            className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-60 font-medium"
          >
            {loading ? "Sendet…" : "Senden"}
          </button>
        </div>
      </div>
    </div>
  );
}
