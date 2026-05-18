"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";

const TYPEN = ["QS", "GlobalGAP", "Bio/Öko", "Cross-Compliance", "Ernte-Plus", "DLG", "Sonstige"];
const STATUS_OPTIONEN = ["aktiv", "abgelaufen", "gesperrt"];

interface Zertifizierung {
  id: number;
  kundeId: number;
  typ: string;
  nummer: string | null;
  ausstellerOrg: string | null;
  ausstellungsdatum: string | null;
  ablaufdatum: string | null;
  status: string;
  belegpfad: string | null;
  belegname: string | null;
  notiz: string | null;
  kunde: { id: number; name: string; firma: string | null };
}

function toDateInput(s: string | null) {
  if (!s) return "";
  return new Date(s).toISOString().slice(0, 10);
}

function ablaufAmpel(ablaufdatum: string | null) {
  if (!ablaufdatum) return { icon: "⚪", text: "text-gray-500", label: "Kein Ablaufdatum" };
  const diff = (new Date(ablaufdatum).getTime() - Date.now()) / 86400000;
  if (diff < 0) return { icon: "🔴", text: "text-red-600", label: "Abgelaufen" };
  if (diff < 30) return { icon: "🟠", text: "text-orange-600", label: `Läuft in ${Math.round(diff)} Tagen ab` };
  if (diff < 90) return { icon: "🟡", text: "text-amber-600", label: `Läuft in ${Math.round(diff)} Tagen ab` };
  return { icon: "🟢", text: "text-green-700", label: `Gültig (${Math.round(diff)} Tage)` };
}

export default function ZertifizierungDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = parseInt(params.id as string, 10);

  const [z, setZ] = useState<Zertifizierung | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const [typ, setTyp] = useState("");
  const [nummer, setNummer] = useState("");
  const [ausstellerOrg, setAusstellerOrg] = useState("");
  const [ausstellungsdatum, setAusstellungsdatum] = useState("");
  const [ablaufdatum, setAblaufdatum] = useState("");
  const [status, setStatus] = useState("aktiv");
  const [notiz, setNotiz] = useState("");

  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isNaN(id)) { setNotFound(true); setLoading(false); return; }
    fetch(`/api/zertifizierungen/${id}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null; }
        return r.json();
      })
      .then((d) => {
        if (!d) return;
        setZ(d);
        setTyp(d.typ);
        setNummer(d.nummer ?? "");
        setAusstellerOrg(d.ausstellerOrg ?? "");
        setAusstellungsdatum(toDateInput(d.ausstellungsdatum));
        setAblaufdatum(toDateInput(d.ablaufdatum));
        setStatus(d.status);
        setNotiz(d.notiz ?? "");
        setLoading(false);
      });
  }, [id]);

  async function handleSave() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/zertifizierungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          typ,
          nummer: nummer.trim() || null,
          ausstellerOrg: ausstellerOrg.trim() || null,
          ausstellungsdatum: ausstellungsdatum || null,
          ablaufdatum: ablaufdatum || null,
          status,
          notiz: notiz.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.error ?? "Fehler");
        return;
      }
      const updated = await res.json();
      setZ(updated);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  async function handleBelegUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/zertifizierungen/${id}/beleg`, {
        method: "POST",
        body: fd,
      });
      if (!res.ok) { alert("Upload fehlgeschlagen"); return; }
      const d = await res.json();
      setZ((prev) => prev ? { ...prev, belegpfad: d.belegpfad, belegname: d.belegname } : prev);
    } finally {
      setUploading(false);
    }
  }

  if (loading) return <p className="text-gray-400 text-sm mt-8">Lade…</p>;
  if (notFound || !z) return (
    <div>
      <p className="text-gray-600">Nicht gefunden.</p>
      <Link href="/zertifizierungen" className="text-green-700 hover:underline text-sm mt-2 inline-block">← Zurück</Link>
    </div>
  );

  const ampel = ablaufAmpel(z.ablaufdatum);

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/zertifizierungen" className="text-sm text-gray-500 hover:text-gray-700">← Zertifizierungen</Link>
        <Link href={`/kunden/${z.kundeId}`} className="text-sm text-green-700 hover:underline">
          {z.kunde.firma ?? z.kunde.name}
        </Link>
      </div>

      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">{z.typ}</h1>
        <span className={`text-sm font-medium ${ampel.text}`}>{ampel.icon} {ampel.label}</span>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Typ</label>
          <select
            value={typ}
            onChange={(e) => setTyp(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {TYPEN.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Zertifikatsnummer</label>
          <input
            type="text"
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ausstellende Organisation</label>
          <input
            type="text"
            value={ausstellerOrg}
            onChange={(e) => setAusstellerOrg(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ausstellungsdatum</label>
            <input
              type="date"
              value={ausstellungsdatum}
              onChange={(e) => setAusstellungsdatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ablaufdatum</label>
            <input
              type="date"
              value={ablaufdatum}
              onChange={(e) => setAblaufdatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          >
            {STATUS_OPTIONEN.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notiz</label>
          <textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={2}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none"
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {success && <p className="text-green-600 text-sm">Gespeichert.</p>}

        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full sm:w-auto px-6 py-2.5 bg-green-700 hover:bg-green-800 text-white font-semibold rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? "Speichern…" : "Speichern"}
        </button>
      </div>

      {/* Beleg-Upload */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mt-4">
        <h3 className="font-semibold text-gray-800 mb-3">Beleg / Dokument</h3>

        {z.belegpfad ? (
          <div className="flex items-center gap-3 mb-3 p-3 bg-green-50 rounded-lg border border-green-200">
            <span className="text-2xl">📄</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">{z.belegname ?? z.belegpfad}</p>
              <p className="text-xs text-gray-500">Beleg hochgeladen</p>
            </div>
          </div>
        ) : (
          <p className="text-sm text-gray-400 mb-3">Noch kein Beleg hochgeladen.</p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={handleBelegUpload}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="px-4 py-2 border border-gray-300 text-sm text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          {uploading ? "Lädt hoch…" : z.belegpfad ? "Beleg ersetzen" : "Beleg hochladen"}
        </button>
        <p className="text-xs text-gray-400 mt-2">PDF, JPG, PNG — max. 10 MB</p>
      </div>
    </div>
  );
}
