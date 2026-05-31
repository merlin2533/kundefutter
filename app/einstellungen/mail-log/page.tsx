"use client";
import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

interface MailLogEntry {
  id: number;
  zeitpunkt: string;
  empfaenger: string;
  betreff: string;
  status: string;
  fehler?: string | null;
  feature?: string | null;
  anhangNamen?: string | null;
}

interface MailLogDetail extends MailLogEntry {
  htmlBody?: string | null;
  textBody?: string | null;
}

function formatZeitpunkt(iso: string) {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function FeatureBadge({ feature }: { feature?: string | null }) {
  if (!feature) return null;
  const colors: Record<string, string> = {
    rechnung: "bg-blue-50 text-blue-700",
    angebot: "bg-purple-50 text-purple-700",
    mahnung: "bg-red-50 text-red-700",
    besuchserinnerung: "bg-teal-50 text-teal-700",
    digest: "bg-amber-50 text-amber-700",
    gutschrift: "bg-green-50 text-green-700",
    test: "bg-gray-100 text-gray-600",
  };
  const cls = colors[feature] ?? "bg-gray-100 text-gray-600";
  return <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{feature}</span>;
}

export default function MailLogPage() {
  const [logs, setLogs] = useState<MailLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [detail, setDetail] = useState<MailLogDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [resending, setResending] = useState<number | null>(null);
  const [resendMsg, setResendMsg] = useState<Record<number, string>>({});
  const [deleting, setDeleting] = useState<number | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/einstellungen/mail-log");
      const data = await res.json();
      setLogs(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  async function toggleExpand(id: number) {
    if (expanded === id) {
      setExpanded(null);
      setDetail(null);
      return;
    }
    setExpanded(id);
    setDetail(null);
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/einstellungen/mail-log/${id}`);
      const data = await res.json();
      setDetail(data);
    } finally {
      setDetailLoading(false);
    }
  }

  async function handleResend(id: number) {
    setResending(id);
    setResendMsg((prev) => ({ ...prev, [id]: "" }));
    try {
      const res = await fetch(`/api/einstellungen/mail-log/${id}/resend`, { method: "POST" });
      const data = await res.json() as { ok?: boolean; error?: string };
      setResendMsg((prev) => ({ ...prev, [id]: data.ok ? "Erneut gesendet" : (data.error ?? "Fehler") }));
      if (data.ok) await loadLogs(); // refresh to show new log entry
    } catch {
      setResendMsg((prev) => ({ ...prev, [id]: "Versand fehlgeschlagen" }));
    } finally {
      setResending(null);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Mail-Log-Eintrag löschen?")) return;
    setDeleting(id);
    try {
      await fetch(`/api/einstellungen/mail-log?id=${id}`, { method: "DELETE" });
      setLogs((prev) => prev.filter((l) => l.id !== id));
      if (expanded === id) { setExpanded(null); setDetail(null); }
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="max-w-5xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/einstellungen" className="text-sm text-green-700 hover:underline">← Einstellungen</Link>
      </div>

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Mail-Log</h1>
          <p className="text-sm text-gray-500 mt-1">Alle versendeten E-Mails der letzten Einträge (max. 200)</p>
        </div>
        <button
          onClick={loadLogs}
          className="text-sm px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Aktualisieren
        </button>
      </div>

      {loading ? (
        <div className="text-sm text-gray-400">Lade Mail-Log…</div>
      ) : logs.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <div className="text-4xl mb-3">📭</div>
          <p className="font-medium">Noch keine E-Mails gesendet</p>
          <p className="text-sm mt-1">Versendete E-Mails werden hier automatisch protokolliert.</p>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Zeitpunkt</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Empfänger</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden md:table-cell">Betreff</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 hidden sm:table-cell">Typ</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3 font-medium text-gray-600">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {logs.map((log) => (
                <>
                  <tr key={log.id} className={`hover:bg-gray-50 ${expanded === log.id ? "bg-gray-50" : ""}`}>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap text-xs">{formatZeitpunkt(log.zeitpunkt)}</td>
                    <td className="px-4 py-3 text-gray-700 max-w-[180px] truncate">{log.empfaenger}</td>
                    <td className="px-4 py-3 text-gray-700 hidden md:table-cell max-w-[240px] truncate">{log.betreff}</td>
                    <td className="px-4 py-3 hidden sm:table-cell"><FeatureBadge feature={log.feature} /></td>
                    <td className="px-4 py-3">
                      <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium ${log.status === "gesendet" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                        {log.status === "gesendet" ? "✓ Gesendet" : "✗ Fehler"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        <button
                          onClick={() => toggleExpand(log.id)}
                          className="text-xs px-2 py-1 rounded bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-200"
                        >
                          {expanded === log.id ? "Schließen" : "Anzeigen"}
                        </button>
                        <button
                          onClick={() => handleResend(log.id)}
                          disabled={resending === log.id}
                          className="text-xs px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 border border-teal-200 disabled:opacity-50"
                        >
                          {resending === log.id ? "…" : "Erneut"}
                        </button>
                        <button
                          onClick={() => handleDelete(log.id)}
                          disabled={deleting === log.id}
                          className="text-xs px-2 py-1 rounded bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 disabled:opacity-50"
                        >
                          {deleting === log.id ? "…" : "Löschen"}
                        </button>
                      </div>
                      {resendMsg[log.id] && (
                        <p className={`text-xs mt-1 ${resendMsg[log.id] === "Erneut gesendet" ? "text-green-600" : "text-red-600"}`}>
                          {resendMsg[log.id]}
                        </p>
                      )}
                    </td>
                  </tr>
                  {expanded === log.id && (
                    <tr key={`${log.id}-detail`}>
                      <td colSpan={6} className="px-4 py-4 bg-gray-50 border-t border-gray-100">
                        {log.fehler && (
                          <div className="mb-3 bg-red-50 border border-red-200 rounded p-3 text-xs text-red-700">
                            <strong>Fehlermeldung:</strong> {log.fehler}
                          </div>
                        )}
                        <div className="mb-2 text-xs text-gray-500">
                          <strong>Betreff:</strong> {log.betreff}
                          {log.anhangNamen && JSON.parse(log.anhangNamen).length > 0 && (
                            <> &nbsp;·&nbsp; <strong>Anhänge:</strong> {JSON.parse(log.anhangNamen).join(", ")}</>
                          )}
                        </div>
                        {detailLoading ? (
                          <div className="text-xs text-gray-400">Lade Inhalt…</div>
                        ) : detail?.id === log.id ? (
                          detail.htmlBody ? (
                            <div className="border border-gray-200 rounded overflow-hidden">
                              <iframe
                                srcDoc={detail.htmlBody}
                                className="w-full h-80 bg-white"
                                sandbox="allow-same-origin"
                                title="E-Mail-Vorschau"
                              />
                            </div>
                          ) : detail.textBody ? (
                            <pre className="text-xs text-gray-700 bg-white border border-gray-200 rounded p-3 whitespace-pre-wrap max-h-80 overflow-y-auto">
                              {detail.textBody}
                            </pre>
                          ) : (
                            <p className="text-xs text-gray-400">Kein Inhalt gespeichert.</p>
                          )
                        ) : null}
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
