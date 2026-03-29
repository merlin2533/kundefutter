"use client";

import { useEffect, useRef, useState } from "react";

interface DriveDatei {
  id: string;
  name: string;
  mimeType: string;
  groesse?: string;
  geaendertAm?: string;
  webViewLink?: string;
  webContentLink?: string;
}

interface DriveOrdnerData {
  folderId: string;
  driveUrl: string;
  dateien: DriveDatei[];
}

interface Props {
  entityType: "kunde" | "artikel";
  entityId: number;
}

function dateiIcon(mimeType: string): string {
  if (mimeType.includes("pdf")) return "📄";
  if (mimeType.includes("image")) return "🖼️";
  if (mimeType.includes("spreadsheet") || mimeType.includes("excel")) return "📊";
  if (mimeType.includes("presentation") || mimeType.includes("powerpoint")) return "📽️";
  if (mimeType.includes("document") || mimeType.includes("word")) return "📝";
  if (mimeType.includes("folder")) return "📁";
  return "📎";
}

function formatDatum(iso?: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function DriveOrdner({ entityType, entityId }: Props) {
  const [data, setData] = useState<DriveOrdnerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fehler, setFehler] = useState<string | null>(null);
  const [nichtKonfiguriert, setNichtKonfiguriert] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFehler, setUploadFehler] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const apiUrl = `/api/drive/${entityType === "kunde" ? "kunden" : "artikel"}/${entityId}`;

  useEffect(() => {
    ladeDateien();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId, entityType]);

  async function ladeDateien() {
    setLoading(true);
    setFehler(null);
    setNichtKonfiguriert(false);
    const res = await fetch(apiUrl);
    const json = await res.json();
    if (!res.ok) {
      if (json.nichtKonfiguriert) {
        setNichtKonfiguriert(true);
      } else {
        setFehler(json.error ?? "Unbekannter Fehler");
      }
    } else {
      setData(json);
    }
    setLoading(false);
  }

  async function uploadDatei(datei: File) {
    setUploadFehler(null);
    setUploading(true);
    const fd = new FormData();
    fd.append("datei", datei);
    const res = await fetch(apiUrl, { method: "POST", body: fd });
    const json = await res.json();
    if (!res.ok) {
      setUploadFehler(json.error ?? "Upload fehlgeschlagen");
    } else {
      await ladeDateien();
    }
    setUploading(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const datei = e.target.files?.[0];
    if (datei) uploadDatei(datei);
    e.target.value = "";
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const datei = e.dataTransfer.files?.[0];
    if (datei) uploadDatei(datei);
  }

  if (loading) {
    return <p className="text-sm text-gray-400 py-4">Drive-Ordner wird geladen…</p>;
  }

  if (nichtKonfiguriert) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 text-sm">
        <p className="font-medium text-yellow-800 mb-1">Google Drive nicht konfiguriert</p>
        <p className="text-yellow-700">
          Hinterlege den Service Account Key unter{" "}
          <a href="/einstellungen/google-drive" className="underline font-medium">
            Einstellungen › Google Drive
          </a>
          .
        </p>
      </div>
    );
  }

  if (fehler) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-5 text-sm text-red-700">
        Fehler beim Laden des Drive-Ordners: {fehler}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header mit Drive-Link */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">{data?.dateien.length ?? 0} Datei(en) in Google Drive</p>
        {data?.driveUrl && (
          <a
            href={data.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
          >
            In Drive öffnen ↗
          </a>
        )}
      </div>

      {/* Dateiliste */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {!data?.dateien.length ? (
          <p className="p-6 text-gray-400 text-sm">Noch keine Dateien im Drive-Ordner.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Größe</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Geändert</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {data.dateien.map((d) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <span className="mr-2">{dateiIcon(d.mimeType)}</span>
                    <span className="font-medium">{d.name}</span>
                    <div className="sm:hidden text-xs text-gray-400 mt-0.5">
                      {d.groesse ?? "—"} · {formatDatum(d.geaendertAm)}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 hidden sm:table-cell">{d.groesse ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-500 hidden md:table-cell">{formatDatum(d.geaendertAm)}</td>
                  <td className="px-4 py-3 text-right">
                    {d.webViewLink && (
                      <a
                        href={d.webViewLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-700 hover:text-green-900 text-sm font-medium"
                      >
                        Öffnen
                      </a>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
          dragOver ? "border-green-500 bg-green-50" : "border-gray-300 hover:border-green-400 hover:bg-gray-50"
        }`}
      >
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
        {uploading ? (
          <p className="text-sm text-gray-500">Wird hochgeladen…</p>
        ) : (
          <p className="text-sm text-gray-500">
            Datei hier hineinziehen oder <span className="text-green-700 font-medium">auswählen</span>
            <span className="block text-xs text-gray-400 mt-1">Max. 25 MB</span>
          </p>
        )}
      </div>

      {uploadFehler && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
          {uploadFehler}
        </p>
      )}
    </div>
  );
}
