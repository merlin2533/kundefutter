"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

interface JobResult {
  job: string;
  ok: boolean;
  detail?: { stationen?: number; updated?: number; fehler?: string[] };
  error?: string;
  durationMs: number;
}

interface CronStatus {
  ok: boolean | null;
  startedAt: string | null;
  jobs: JobResult[];
}

const JOB_META: Record<string, { label: string; beschreibung: string; icon: string }> = {
  pegelstaende: {
    label: "Pegelstände",
    icon: "≋",
    beschreibung: "Wasserstandsmessungen von WSV Pegelonline aktualisieren",
  },
  digest: {
    label: "Digest-E-Mail",
    icon: "📧",
    beschreibung: "Tagesübersicht (Besuchstermine, Aufgaben, Mahnwesen, Sachkunde) an konfigurierte Admin-Adresse (alle 6h)",
  },
};

function formatDauer(ms: number) {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

export default function CronVerwaltungPage() {
  const [status, setStatus] = useState<CronStatus | null>(null);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  async function ladeStatus() {
    const res = await fetch("/api/cron?status=1").catch(() => null);
    if (res?.ok) {
      const d = await res.json();
      setStatus(d);
    }
    setLoading(false);
  }

  useEffect(() => { ladeStatus(); }, []);

  async function jetztAusfuehren() {
    setRunning(true);
    const res = await fetch("/api/cron").catch(() => null);
    if (res) {
      const d = await res.json();
      setStatus(d);
    }
    setRunning(false);
  }

  const lastRun = status?.startedAt ? new Date(status.startedAt) : null;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-gray-400 hover:text-gray-600 text-sm">← Einstellungen</Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">🕐 Cron-Verwaltung</h1>
          <p className="text-sm text-gray-500 mt-1">
            Hintergrundjobs überwachen und manuell auslösen. Der Docker-Container führt alle Jobs automatisch alle 30 Minuten aus.
          </p>
        </div>
        <button
          onClick={jetztAusfuehren}
          disabled={running}
          className="shrink-0 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2"
        >
          {running ? (
            <>
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Läuft…
            </>
          ) : (
            "▶ Jetzt ausführen"
          )}
        </button>
      </div>

      {/* Letzter Lauf */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Letzter Lauf</h2>
        {loading ? (
          <div className="h-8 bg-gray-100 rounded animate-pulse w-48" />
        ) : !lastRun ? (
          <p className="text-sm text-gray-400">Noch kein Lauf aufgezeichnet. Klicke auf „Jetzt ausführen".</p>
        ) : (
          <div className="flex items-center gap-3">
            <span className={`w-3 h-3 rounded-full shrink-0 ${status?.ok ? "bg-green-500" : "bg-red-500"}`} />
            <div>
              <p className="text-sm font-medium text-gray-800">
                {lastRun.toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })},{" "}
                {lastRun.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} Uhr
              </p>
              <p className="text-xs text-gray-400">
                {status?.ok ? "Alle Jobs erfolgreich" : "Mindestens ein Job fehlgeschlagen"}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Job-Liste */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Registrierte Jobs</h2>

        {(["pegelstaende", "digest"] as const).map((jobId) => {
          const meta = JOB_META[jobId];
          const result = status?.jobs.find((j) => j.job === jobId);
          return (
            <div key={jobId} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{meta.icon}</span>
                  <div>
                    <h3 className="font-semibold text-gray-900">{meta.label}</h3>
                    <p className="text-xs text-gray-500 mt-0.5">{meta.beschreibung}</p>
                  </div>
                </div>
                {result && (
                  <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-medium ${result.ok ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {result.ok ? "✓ OK" : "✗ Fehler"}
                  </span>
                )}
              </div>

              {result && (
                <div className="mt-4 pt-4 border-t border-gray-50 grid grid-cols-2 sm:grid-cols-3 gap-3 text-sm">
                  {result.detail?.stationen != null && (
                    <div>
                      <p className="text-xs text-gray-400">Stationen</p>
                      <p className="font-medium">{result.detail.stationen}</p>
                    </div>
                  )}
                  {result.detail?.updated != null && (
                    <div>
                      <p className="text-xs text-gray-400">Aktualisiert</p>
                      <p className="font-medium text-green-700">{result.detail.updated}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-400">Laufzeit</p>
                    <p className="font-medium">{formatDauer(result.durationMs)}</p>
                  </div>
                  {result.detail?.fehler && result.detail.fehler.length > 0 && (
                    <div className="col-span-full">
                      <p className="text-xs text-gray-400 mb-1">Fehlerhafte Stationen</p>
                      <div className="flex flex-wrap gap-1">
                        {result.detail.fehler.map((f) => (
                          <span key={f} className="text-xs bg-red-50 text-red-600 px-2 py-0.5 rounded font-mono">{f}</span>
                        ))}
                      </div>
                    </div>
                  )}
                  {result.error && (
                    <div className="col-span-full">
                      <p className="text-xs text-gray-400 mb-1">Fehler</p>
                      <p className="text-xs text-red-600 font-mono">{result.error}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="mt-3 pt-3 border-t border-gray-50 flex items-center justify-between text-xs text-gray-400">
                <span>Intervall: alle 30 Minuten (Docker-Hintergrundprozess)</span>
                {jobId === "pegelstaende" && (
                  <Link href="/einstellungen/pegelstaende" className="text-green-700 hover:underline">
                    Stationen konfigurieren →
                  </Link>
                )}
                {jobId === "digest" && (
                  <Link href="/einstellungen/email" className="text-green-700 hover:underline">
                    Digest konfigurieren →
                  </Link>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Hinweis Cron-Secret */}
      <div className="mt-6 bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-800">
        <p className="font-medium mb-1">Absicherung mit CRON_SECRET</p>
        <p className="text-xs text-blue-600">
          Setze die Umgebungsvariable <code className="bg-blue-100 px-1 rounded">CRON_SECRET</code> im Docker-Container,
          um den <code className="bg-blue-100 px-1 rounded">/api/cron</code> Endpunkt vor unbefugtem Zugriff zu schützen.
          Der Hintergrundprozess sendet den Secret automatisch als Bearer-Header.
        </p>
      </div>
    </div>
  );
}
