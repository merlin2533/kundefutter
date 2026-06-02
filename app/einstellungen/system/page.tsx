"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const LIZENZEN: { name: string; version: string; lizenz: string }[] = [
  { name: "next", version: "16.2.4", lizenz: "MIT" },
  { name: "react / react-dom", version: "19.2.4", lizenz: "MIT" },
  { name: "prisma / @prisma/client", version: "7.x", lizenz: "Apache-2.0" },
  { name: "@libsql/client", version: "0.17.2", lizenz: "MIT" },
  { name: "@anthropic-ai/sdk", version: "0.82.0", lizenz: "MIT" },
  { name: "openai", version: "6.33.0", lizenz: "Apache-2.0" },
  { name: "googleapis", version: "144.0.0", lizenz: "Apache-2.0" },
  { name: "jose", version: "6.2.2", lizenz: "MIT" },
  { name: "bcryptjs", version: "3.0.3", lizenz: "BSD-3-Clause" },
  { name: "jspdf / jspdf-autotable", version: "4.x / 5.x", lizenz: "MIT" },
  { name: "pdf-lib", version: "1.17.1", lizenz: "MIT" },
  { name: "xlsx", version: "0.18.5", lizenz: "Apache-2.0" },
  { name: "jszip", version: "3.10.1", lizenz: "MIT" },
  { name: "leaflet / react-leaflet", version: "1.9.4 / 5.0.0", lizenz: "BSD-2 / Hippocratic-2.1" },
  { name: "lucide-react", version: "1.7.0", lizenz: "ISC" },
  { name: "nodemailer", version: "8.0.5", lizenz: "MIT-0" },
  { name: "resend", version: "6.12.4", lizenz: "MIT" },
  { name: "qrcode", version: "1.5.4", lizenz: "MIT" },
];

export default function SystemPage() {
  const [buildInfo, setBuildInfo] = useState<{ version?: string; env?: string } | null>(null);

  useEffect(() => {
    setBuildInfo({
      version: process.env.NEXT_PUBLIC_APP_VERSION ?? "–",
      env: process.env.NODE_ENV ?? "–",
    });
  }, []);

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
        <h2 className="text-lg font-semibold mb-2">Verwendete Lizenzen</h2>
        <p className="text-sm text-gray-500 mb-4">
          Alle eingesetzten Drittanbieter-Bibliotheken stehen unter permissiven
          Open-Source-Lizenzen (MIT, Apache-2.0, BSD, ISC).
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-4 font-medium">Bibliothek</th>
                <th className="py-2 pr-4 font-medium">Version</th>
                <th className="py-2 font-medium">Lizenz</th>
              </tr>
            </thead>
            <tbody className="font-mono text-xs">
              {LIZENZEN.map((l) => (
                <tr key={l.name} className="border-b border-gray-50">
                  <td className="py-1.5 pr-4 text-gray-800">{l.name}</td>
                  <td className="py-1.5 pr-4 text-gray-500">{l.version}</td>
                  <td className="py-1.5 text-gray-700">{l.lizenz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-gray-400 mt-4">
          Vollständige Übersicht inkl. externer Datenquellen in{" "}
          <span className="font-mono">THIRD-PARTY-LICENSES.md</span>, Versionshistorie in{" "}
          <span className="font-mono">CHANGELOG.md</span>.
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
