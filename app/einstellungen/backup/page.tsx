"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Card } from "@/components/Card";
import {
  DEFAULT_BACKUP_CONFIG,
  parseBackupConfig,
  type BackupConfig,
} from "@/lib/backup-config";

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
  const [restoringFile, setRestoringFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [cfg, setCfg] = useState<BackupConfig>(DEFAULT_BACKUP_CONFIG);
  const [cfgSaving, setCfgSaving] = useState(false);
  const [cfgSaved, setCfgSaved] = useState(false);
  const [uploadDragging, setUploadDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function loadBackups() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/backup");
      if (!res.ok) throw new Error("Fehler beim Laden der Backups");
      const data = await res.json();
      setBackups(Array.isArray(data) ? data : []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig() {
    try {
      const res = await fetch("/api/einstellungen?prefix=system.backup");
      if (!res.ok) return;
      const data: Record<string, string> = await res.json();
      setCfg(parseBackupConfig(data["system.backup"]));
    } catch {
      /* Standardwerte beibehalten */
    }
  }

  async function saveConfig(next: BackupConfig) {
    setCfg(next);
    setCfgSaving(true);
    setCfgSaved(false);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.backup", value: JSON.stringify(next) }),
      });
      if (!res.ok) throw new Error();
      setCfgSaved(true);
      setTimeout(() => setCfgSaved(false), 2000);
    } catch {
      setError("Automatik-Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setCfgSaving(false);
    }
  }

  useEffect(() => {
    loadBackups();
    loadConfig();
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

  async function handleRestore(filename: string) {
    if (
      !window.confirm(
        `Datenbank wirklich aus "${filename}" wiederherstellen?\n\n` +
          "Achtung: Alle Daten seit diesem Backup gehen verloren!\n" +
          "Vor dem Restore wird automatisch ein Sicherungs-Backup erstellt.\n" +
          "Der Server wird anschließend neu gestartet."
      )
    )
      return;

    setRestoringFile(filename);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Fehler beim Wiederherstellen");
      setSuccess(
        `Wiederhergestellt aus ${filename}. Sicherungs-Backup: ${body.sicherung ?? "–"}. ` +
          "Server wird neu gestartet – bitte Seite in ~10 Sekunden neu laden."
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setRestoringFile(null);
    }
  }

  async function handleUploadRestore(file: File) {
    if (!file.name.endsWith(".db")) {
      setError("Nur .db-Dateien sind erlaubt.");
      return;
    }
    if (
      !window.confirm(
        `Datenbank wirklich aus der hochgeladenen Datei "${file.name}" wiederherstellen?\n\n` +
          "Achtung: Alle aktuellen Daten werden überschrieben!\n" +
          "Vor dem Restore wird automatisch ein Sicherungs-Backup erstellt.\n" +
          "Der Server wird anschließend neu gestartet."
      )
    )
      return;

    setUploading(true);
    setError(null);
    setSuccess(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/backup/restore", {
        method: "POST",
        body: formData,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Fehler beim Wiederherstellen");
      setSuccess(
        `Wiederhergestellt aus Upload "${file.name}". Sicherungs-Backup: ${body.sicherung ?? "–"}. ` +
          "Server wird neu gestartet – bitte Seite in ~10 Sekunden neu laden."
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unbekannter Fehler");
    } finally {
      setUploading(false);
    }
  }

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    setUploadDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUploadRestore(file);
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

      {/* Automatische Sicherung */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-700">Automatische Sicherung</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Der Server erstellt im eingestellten Abstand selbstständig ein Backup (Dateiname{" "}
              <code>auto-…</code>).
            </p>
          </div>
          <button
            type="button"
            onClick={() => saveConfig({ ...cfg, autoAktiv: !cfg.autoAktiv })}
            disabled={cfgSaving}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors disabled:opacity-60 ${
              cfg.autoAktiv ? "bg-green-500" : "bg-gray-300"
            }`}
            role="switch"
            aria-checked={cfg.autoAktiv}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                cfg.autoAktiv ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
        <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Abstand (Stunden)
            </label>
            <input
              type="number"
              min={1}
              value={cfg.intervallStunden}
              disabled={!cfg.autoAktiv}
              onChange={(e) =>
                setCfg({ ...cfg, intervallStunden: Math.max(1, parseInt(e.target.value, 10) || 24) })
              }
              onBlur={() => saveConfig(cfg)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Z. B. 24 = tägliche Sicherung.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-600 mb-1">
              Aufbewahrung (Anzahl)
            </label>
            <input
              type="number"
              min={1}
              value={cfg.aufbewahrung}
              disabled={!cfg.autoAktiv}
              onChange={(e) =>
                setCfg({ ...cfg, aufbewahrung: Math.max(1, parseInt(e.target.value, 10) || 14) })
              }
              onBlur={() => saveConfig(cfg)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-50 disabled:text-gray-400"
            />
            <p className="text-xs text-gray-400 mt-1">Ältere automatische Backups werden gelöscht.</p>
          </div>
          {cfgSaved && (
            <p className="sm:col-span-2 text-xs text-green-600">
              Automatik-Einstellungen gespeichert
            </p>
          )}
        </div>
      </div>

      {/* Backup wiederherstellen (Upload) */}
      <div className="mb-6 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
          <h2 className="text-sm font-semibold text-gray-700">Backup hochladen & wiederherstellen</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            Externe .db-Sicherungsdatei hochladen und sofort einspielen.
          </p>
        </div>
        <div className="p-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setUploadDragging(true); }}
            onDragLeave={() => setUploadDragging(false)}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg px-6 py-8 text-center cursor-pointer transition-colors ${
              uploadDragging
                ? "border-green-400 bg-green-50"
                : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
            }`}
          >
            {uploading ? (
              <div className="flex items-center justify-center gap-2 text-gray-600">
                <span className="inline-block w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm">Wird wiederhergestellt…</span>
              </div>
            ) : (
              <>
                <div className="text-3xl mb-2">📂</div>
                <p className="text-sm text-gray-600">
                  .db-Datei hierher ziehen oder klicken zum Auswählen
                </p>
                <p className="text-xs text-gray-400 mt-1">Nur SQLite .db-Dateien erlaubt</p>
              </>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".db"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleUploadRestore(file);
              e.target.value = "";
            }}
          />
          <p className="mt-3 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
            <strong>Achtung:</strong> Vor dem Restore wird automatisch ein Sicherungs-Backup der
            aktuellen Datenbank angelegt. Der Server startet danach neu (~10 Sekunden Downtime).
          </p>
        </div>
      </div>

      {/* Backup-Liste */}
      <Card>
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg mb-6 text-sm text-blue-800">
          <strong>Hinweis:</strong> Backups werden unter{" "}
          <code className="bg-blue-100 px-1 rounded">/data/backups/</code> gespeichert. Die
          SQLite-Datenbank wird als vollständige Kopie gesichert. Vor dem Kopieren wird der
          WAL-Puffer geleert, um Datenkonsistenz zu gewährleisten.
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
                  <th className="pb-3 font-semibold text-gray-700 hidden md:table-cell">
                    Erstellt am
                  </th>
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
                          onClick={() => handleRestore(b.filename)}
                          disabled={restoringFile !== null}
                          className="px-3 py-1.5 text-xs font-medium bg-amber-500 hover:bg-amber-600 disabled:bg-amber-300 text-white rounded-md transition-colors"
                          title="Datenbank aus diesem Backup wiederherstellen"
                        >
                          {restoringFile === b.filename ? (
                            <span className="flex items-center gap-1">
                              <span className="inline-block w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                              Restore…
                            </span>
                          ) : (
                            "Restore"
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(b.filename)}
                          disabled={restoringFile !== null}
                          className="px-3 py-1.5 text-xs font-medium bg-red-100 hover:bg-red-200 disabled:opacity-50 text-red-700 rounded-md transition-colors"
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
            <span>
              {backups.length} Backup{backups.length !== 1 ? "s" : ""}
            </span>
            <span>Gesamt: {formatBytes(totalSize)}</span>
          </div>
        )}
      </Card>
    </div>
  );
}
