"use client";
import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { formatDatum } from "@/lib/utils";

interface Zertifikat {
  id: number;
  chargeNr: string;
  beschreibung: string | null;
  dateiName: string;
  pfad: string;
  createdAt: string;
}

export default function ChargenZertifikatePage() {
  const [zertifikate, setZertifikate] = useState<Zertifikat[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showUpload, setShowUpload] = useState(false);
  const [uploadForm, setUploadForm] = useState({ chargeNr: "", beschreibung: "" });
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [deleting, setDeleting] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function load(chargeNr = "") {
    setLoading(true);
    const res = await fetch(`/api/chargen-zertifikate?chargeNr=${encodeURIComponent(chargeNr)}`);
    if (res.ok) {
      const data = await res.json();
      setZertifikate(Array.isArray(data) ? data : []);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function handleSearch(val: string) {
    setSearch(val);
    load(val);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadForm.chargeNr.trim()) { setUploadError("Chargennummer erforderlich"); return; }
    if (!uploadFile) { setUploadError("Bitte eine Datei auswählen"); return; }
    setUploading(true);
    setUploadError("");
    const fd = new FormData();
    fd.append("chargeNr", uploadForm.chargeNr.trim());
    fd.append("beschreibung", uploadForm.beschreibung);
    fd.append("datei", uploadFile);
    const res = await fetch("/api/chargen-zertifikate", { method: "POST", body: fd });
    setUploading(false);
    if (res.ok) {
      setShowUpload(false);
      setUploadForm({ chargeNr: "", beschreibung: "" });
      setUploadFile(null);
      if (fileRef.current) fileRef.current.value = "";
      load(search);
    } else {
      const d = await res.json().catch(() => ({}));
      setUploadError(d.error ?? "Fehler beim Hochladen");
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Zertifikat wirklich löschen?")) return;
    setDeleting(id);
    const res = await fetch(`/api/chargen-zertifikate/${id}`, { method: "DELETE" });
    setDeleting(null);
    if (res.ok) load(search);
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6 gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/lager/chargen" className="text-sm text-green-700 hover:text-green-900">← Chargensuche</Link>
          </div>
          <h1 className="text-2xl font-bold">Chargen-Zertifikate</h1>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="bg-green-800 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          + Zertifikat hochladen
        </button>
      </div>

      {/* Upload Form */}
      {showUpload && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 max-w-lg">
          <h2 className="text-base font-semibold mb-4">Zertifikat hochladen</h2>
          <form onSubmit={handleUpload} className="space-y-4">
            {uploadError && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{uploadError}</p>
            )}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Chargennummer <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={uploadForm.chargeNr}
                onChange={(e) => setUploadForm({ ...uploadForm, chargeNr: e.target.value })}
                placeholder="z.B. CH-2024-001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung</label>
              <input
                type="text"
                value={uploadForm.beschreibung}
                onChange={(e) => setUploadForm({ ...uploadForm, beschreibung: e.target.value })}
                placeholder="z.B. Analysezertifikat, CoA"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Datei <span className="text-red-500">*</span>
              </label>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(e) => setUploadFile(e.target.files?.[0] ?? null)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
              />
              <p className="text-xs text-gray-400 mt-1">PDF, PNG oder JPG</p>
            </div>
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={uploading}
                className="px-4 py-2 bg-green-800 hover:bg-green-700 disabled:opacity-60 text-white rounded-lg text-sm font-medium"
              >
                {uploading ? "Hochladen…" : "Hochladen"}
              </button>
              <button
                type="button"
                onClick={() => { setShowUpload(false); setUploadError(""); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4">
        <input
          type="search"
          placeholder="Chargennummer suchen…"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          className="w-full sm:w-72 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto">
        {loading ? (
          <p className="p-6 text-gray-400 text-sm">Lade Zertifikate…</p>
        ) : zertifikate.length === 0 ? (
          <p className="p-6 text-gray-400 text-sm">
            {search ? `Keine Zertifikate für Charge "${search}" gefunden.` : "Noch keine Zertifikate hochgeladen."}
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Charge</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden sm:table-cell">Beschreibung</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dateiname</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Hochgeladen</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Aktionen</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {zertifikate.map((z) => (
                <tr key={z.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-mono font-medium text-gray-900">
                    {z.chargeNr}
                    <div className="sm:hidden text-xs text-gray-500 mt-0.5">{z.beschreibung ?? "—"}</div>
                  </td>
                  <td className="hidden sm:table-cell px-4 py-3 text-gray-600">{z.beschreibung ?? "—"}</td>
                  <td className="px-4 py-3 text-gray-700 text-xs font-mono truncate max-w-[200px]">{z.dateiName}</td>
                  <td className="hidden md:table-cell px-4 py-3 text-gray-500">{formatDatum(z.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <a
                        href={`/api/chargen-zertifikate/${z.id}`}
                        download={z.dateiName}
                        className="p-1.5 rounded-lg border border-gray-300 hover:bg-gray-50 text-gray-600 hover:text-gray-800 transition-colors"
                        title="Herunterladen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </a>
                      <button
                        onClick={() => handleDelete(z.id)}
                        disabled={deleting === z.id}
                        className="p-1.5 rounded-lg border border-red-300 hover:bg-red-50 text-red-400 hover:text-red-600 disabled:opacity-60 transition-colors"
                        title="Löschen"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
