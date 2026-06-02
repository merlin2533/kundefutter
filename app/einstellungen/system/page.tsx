"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

// Laufzeit-Abhängigkeiten (deckungsgleich mit THIRD-PARTY-LICENSES.md).
// Bei neuen Paketen hier UND in THIRD-PARTY-LICENSES.md ergänzen
// (Lizenzen prüfbar via `npx license-checker --summary`).
const ABHAENGIGKEITEN: { name: string; version: string; lizenz: string }[] = [
  { name: "@anthropic-ai/sdk", version: "0.82.0", lizenz: "MIT" },
  { name: "@libsql/client", version: "0.17.2", lizenz: "MIT" },
  { name: "@prisma/adapter-libsql", version: "7.6.0", lizenz: "Apache-2.0" },
  { name: "@prisma/client", version: "7.6.0", lizenz: "Apache-2.0" },
  { name: "bcryptjs", version: "3.0.3", lizenz: "BSD-3-Clause" },
  { name: "googleapis", version: "144.0.0", lizenz: "Apache-2.0" },
  { name: "jose", version: "6.2.2", lizenz: "MIT" },
  { name: "jspdf", version: "4.2.1", lizenz: "MIT" },
  { name: "jspdf-autotable", version: "5.0.7", lizenz: "MIT" },
  { name: "jszip", version: "3.10.1", lizenz: "MIT OR GPL-3.0-or-later" },
  { name: "leaflet", version: "1.9.4", lizenz: "BSD-2-Clause" },
  { name: "lucide-react", version: "1.7.0", lizenz: "ISC" },
  { name: "next", version: "16.2.4", lizenz: "MIT" },
  { name: "nodemailer", version: "8.0.5", lizenz: "MIT-0" },
  { name: "openai", version: "6.33.0", lizenz: "Apache-2.0" },
  { name: "pdf-lib", version: "1.17.1", lizenz: "MIT" },
  { name: "prisma", version: "7.7.0", lizenz: "Apache-2.0" },
  { name: "qrcode", version: "1.5.4", lizenz: "MIT" },
  { name: "react", version: "19.2.4", lizenz: "MIT" },
  { name: "react-dom", version: "19.2.4", lizenz: "MIT" },
  { name: "react-leaflet", version: "5.0.0", lizenz: "Hippocratic-2.1" },
  { name: "resend", version: "6.12.4", lizenz: "MIT" },
  { name: "xlsx", version: "0.18.5", lizenz: "Apache-2.0" },
];

// Externe Datenquellen/Dienste mit Namensnennungs- bzw. Lizenzpflicht.
const NAMENSNENNUNGEN: { quelle: string; zweck: string; bedingung: string }[] = [
  {
    quelle: "© OpenStreetMap-Mitwirkende",
    zweck: "Kartendarstellung & Geocoding (Leaflet, Nominatim)",
    bedingung: "ODbL – Namensnennung erforderlich",
  },
  {
    quelle: "OSRM",
    zweck: "Routenberechnung (Tourenplanung)",
    bedingung: "basiert auf OpenStreetMap-Daten (ODbL)",
  },
  {
    quelle: "Open-Meteo",
    zweck: "Wetter- & Spritzfenster-Prognose",
    bedingung: "CC BY 4.0 – Namensnennung erforderlich",
  },
  {
    quelle: "Eurostat (Europäische Kommission)",
    zweck: "Agrarrohstoff-Preisindizes",
    bedingung: "freie Nachnutzung mit Quellenangabe",
  },
];

export default function SystemPage() {
  const [buildInfo, setBuildInfo] = useState<{ version?: string; env?: string } | null>(null);
  const [firmenname, setFirmenname] = useState<string>("");

  useEffect(() => {
    setBuildInfo({
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "–",
      env: process.env.NODE_ENV ?? "–",
    });
  }, []);

  useEffect(() => {
    let aktiv = true;
    fetch("/api/einstellungen?prefix=firma.")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (aktiv && data && typeof data === "object" && data["firma.name"]) {
          setFirmenname(String(data["firma.name"]));
        }
      })
      .catch(() => {});
    return () => {
      aktiv = false;
    };
  }, []);

  const jahr = new Date().getFullYear();
  const inhaber = firmenname || "Betreiber";

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">Einstellungen</Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">System</span>
      </div>

      <h1 className="text-2xl font-bold mb-6">System</h1>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-4 mb-6">
        <h2 className="text-lg font-semibold mb-3">Version & Umgebung</h2>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-gray-500 text-xs mb-1">App-Version</p>
            <p className="font-mono font-semibold">{buildInfo?.version ?? "…"}</p>
          </div>
          <div className="bg-gray-50 rounded-lg px-4 py-3">
            <p className="text-gray-500 text-xs mb-1">Umgebung</p>
            <p className="font-mono font-semibold">{buildInfo?.env ?? "…"}</p>
          </div>
        </div>

        <div className="bg-gray-50 rounded-lg px-4 py-3 text-sm">
          <p className="text-gray-500 text-xs mb-1">Datenbank</p>
          <p className="text-gray-700">SQLite via Prisma (lokale DB-Datei)</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
        <h2 className="text-lg font-semibold mb-1">Lizenzen & rechtliche Hinweise</h2>
        <p className="text-sm text-gray-500 mb-5">
          AGRI-Office nutzt quelloffene Software. Alle eingesetzten Laufzeit-Bibliotheken
          stehen unter permissiven Open-Source-Lizenzen (MIT, Apache-2.0, BSD, ISC, MIT-0).
        </p>

        {/* Verwendete Open-Source-Bibliotheken */}
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Verwendete Open-Source-Bibliotheken
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-100 mb-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="py-2 px-3 font-medium">Bibliothek</th>
                <th className="py-2 px-3 font-medium">Version</th>
                <th className="py-2 px-3 font-medium">Lizenz</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {ABHAENGIGKEITEN.map((l) => (
                <tr key={l.name} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 px-3 text-gray-800">{l.name}</td>
                  <td className="py-1.5 px-3 text-gray-500">{l.version}</td>
                  <td className="py-1.5 px-3 text-gray-700">{l.lizenz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="text-xs text-gray-500 space-y-1 mb-6 list-disc pl-5">
          <li>
            <span className="font-mono">jszip</span> ist dual-lizenziert; AGRI-Office nutzt
            die Bibliothek unter den Bedingungen der <strong>MIT</strong>-Lizenz.
          </li>
          <li>
            <span className="font-mono">react-leaflet</span> steht unter der
            Hippocratic License 2.1 (ethische MIT-Variante).
          </li>
          <li>
            <span className="font-mono">nodemailer</span> nutzt MIT-0 (MIT ohne
            Namensnennungspflicht).
          </li>
        </ul>

        {/* Pflicht-Namensnennungen für externe Datenquellen */}
        <h3 className="text-sm font-semibold text-gray-800 mb-2">
          Datenquellen & Pflicht-Namensnennungen
        </h3>
        <div className="overflow-x-auto rounded-lg border border-gray-100 mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 bg-gray-50 border-b border-gray-100">
                <th className="py-2 px-3 font-medium">Quelle</th>
                <th className="py-2 px-3 font-medium">Zweck</th>
                <th className="py-2 px-3 font-medium">Bedingung</th>
              </tr>
            </thead>
            <tbody className="text-xs">
              {NAMENSNENNUNGEN.map((n) => (
                <tr key={n.quelle} className="border-b border-gray-50 last:border-0">
                  <td className="py-1.5 px-3 text-gray-800">{n.quelle}</td>
                  <td className="py-1.5 px-3 text-gray-600">{n.zweck}</td>
                  <td className="py-1.5 px-3 text-gray-500">{n.bedingung}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Eigene Software & Copyright */}
        <h3 className="text-sm font-semibold text-gray-800 mb-2">Eigene Software</h3>
        <p className="text-xs text-gray-600 mb-4">
          Die Anwendung AGRI-Office selbst sowie alle darin erfassten Geschäftsdaten sind
          urheberrechtlich geschützt. © {jahr} {inhaber}. Alle Rechte vorbehalten.
          Die oben genannten Open-Source-Komponenten verbleiben im Eigentum ihrer
          jeweiligen Urheber und werden gemäß ihrer Lizenzen genutzt.
        </p>

        <p className="text-xs text-gray-400">
          Vollständige Übersicht inkl. aller Lizenztexte:{" "}
          <span className="font-mono">THIRD-PARTY-LICENSES.md</span> · Versionshistorie:{" "}
          <span className="font-mono">CHANGELOG.md</span> (im Quellcode-Repository).
        </p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold mb-2">Datenpflege</h2>
        <p className="text-sm text-gray-500 mb-4">
          Duplikate bereinigen, Suchindex neu aufbauen und weitere Wartungsoperationen.
        </p>
        <Link
          href="/einstellungen/loeschzentrum"
          className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <span>🗑️</span>
          <span>Zum Löschzentrum</span>
        </Link>
      </div>
    </div>
  );
}
