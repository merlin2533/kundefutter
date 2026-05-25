"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

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
