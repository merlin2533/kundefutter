"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";

interface BackupEntry {
  filename: string;
  size: number;
  created: string;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return bytes + " B";
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
  return (bytes / (1024 * 1024)).toFixed(1) + " MB";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function BackupPage() {
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function loadBackups() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Fehler beim Laden der Backups");
      const data = await res.json();
      setBackups(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadBackups();
  }, []);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/backup", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Fehler beim Erstellen");
      }
      const entry: BackupEntry = await res.json();
      setSuccess(`Backup erstellt: ${entry.filename} (${formatBytes(entry.size)})`);
      await loadBackups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(filename: string) {
    if (!window.confirm("Backup wirklich löschen?")) return;
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`/api/backup?filename=${encodeURIComponent(filename)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "Fehler beim Löschen");
      }
      setSuccess("Backup gelöscht.");
      await loadBackups();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    }
  }

  const totalSize = backups.reduce((sum, b) => sum + b.size, 0);

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/einstellungen" className="hover:text-green-700">
          Einstellungen
        </Link>
        <span>›</span>
        <span className="text-gray-800 font-medium">Datensicherung</span>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Datensicherung</h1>
        <button
          onClick={handleCreate}
          disabled={creating}
          className="flex items-center gap-2 px-5 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold rounded-lg transition-colors"
        >
          {creating ? (
            <>
              <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Backup wird erstellt…
            </>
          ) : (
            <>
              <span>💾</span>
              Backup erstellen
            </>
          )}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm">
          {success}
        </div>
      )}

      <Card>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6 text-sm text-blue-800">
          <strong>Hinweis:</strong> Backups werden unter <code className="bg-blue-100 px-1 rounded">/data/backups/</code> gespeichert.
          Die SQLite-Datenbank wird als vollständige Kopie gesichert. Vor dem Kopieren wird
          der WAL-Puffer geleert, um Datenkonsistenz zu gewährleisten.
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-10">Lade Backups…</div>
        ) : backups.length === 0 ? (
          <div className="text-center text-gray-500 py-10">
            Keine Backups vorhanden. Erstellen Sie das erste Backup mit dem Button oben.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-left">
                  <th className="pb-3 font-semibold text-gray-700">Dateiname</th>
                  <th className="pb-3 font-semibold text-gray-700 hidden sm:table-cell">Größe</th>
                  <th className="pb-3 font-semibold text-gray-700 hidden md:table-cell">Erstellt am</th>
                  <th className="pb-3 font-semibold text-gray-700 text-right">Aktionen</th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr
                    key={b.filename}
                    className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <span className="font-mono text-xs text-gray-800">{b.filename}</span>
                      <div className="sm:hidden text-xs text-gray-500 mt-0.5">
                        {formatBytes(b.size)} · {formatDate(b.created)}
                      </div>
                    </td>
                    <td className="py-3 pr-4 hidden sm:table-cell text-gray-600">
                      {formatBytes(b.size)}
                    </td>
                    <td className="py-3 pr-4 hidden md:table-cell text-gray-600">
                      {formatDate(b.created)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <a
                          href={`/api/backup/download?filename=${encodeURIComponent(b.filename)}`}
                          download={b.filename}
                          className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors"
                        >
                          Download
                        </a>
                        <button
                          onClick={() => handleDelete(b.filename)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 text-red-700 rounded-md transition-colors"
                        >
                          Löschen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {backups.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100 text-sm text-gray-500 flex justify-between items-center">
            <span>{backups.length} Backup{backups.length !== 1 ? "s" : ""}</span>
            <span>Gesamt: {formatBytes(totalSize)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
