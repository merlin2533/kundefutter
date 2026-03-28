"use client";

import { useEffect, useState, useCallback, useRef } from "react";

// ─── Firmenlogo ───────────────────────────────────────────────────────────────

function FirmenlogoEditor() {
  const [logo, setLogo] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/einstellungen?prefix=system.")
      .then((r) => r.json())
      .then((d) => {
        if (d["system.logo"]) {
          setLogo(d["system.logo"]);
        }
      })
      .catch(() => {});
  }, []);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 3 * 1024 * 1024) {
      setError("Datei zu groß. Max. 3MB erlaubt.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  async function handleSave() {
    if (!preview) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.logo", value: preview }),
      });
      if (!res.ok) throw new Error();
      setLogo(preview);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Fehler beim Speichern des Logos.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "system.logo", value: "" }),
      });
      if (!res.ok) throw new Error();
      setLogo(null);
      setPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      setError("Fehler beim Entfernen des Logos.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <h2 className="text-lg font-semibold mb-1">Firmenlogo</h2>
      <p className="text-sm text-gray-500 mb-4">
        Wird im Header und als Favicon verwendet. Max. 2MB empfohlen (PNG, JPG, SVG, WebP).
      </p>

      {error && (
        <p className="text-xs text-red-600 mb-3">{error}</p>
      )}
      {saved && (
        <p className="text-xs text-green-600 mb-3">&#10003; Gespeichert</p>
      )}

      {(preview ?? logo) && (
        <div className="mb-4 p-3 bg-gray-50 rounded-lg inline-block">
          <img
            src={preview ?? logo ?? ""}
            alt="Logo Vorschau"
            className="h-16 w-auto object-contain"
          />
          {preview && (
            <p className="text-xs text-blue-600 mt-1">Vorschau – noch nicht gespeichert</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="text-sm text-gray-600 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border file:border-gray-300 file:text-sm file:bg-white file:text-gray-700 file:cursor-pointer hover:file:bg-gray-50"
        />

        {preview && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-1.5 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "Speichern…" : "Speichern"}
          </button>
        )}

        {logo && !preview && (
          <button
            onClick={handleRemove}
            disabled={saving}
            className="px-4 py-1.5 text-sm border border-red-300 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 transition-colors"
          >
            {saving ? "…" : "Logo entfernen"}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Mitarbeiter & Kategorien ─────────────────────────────────────────────────

function ListenEditor({ settingKey, label, placeholder }: { settingKey: string; label: string; placeholder: string }) {
  const [items, setItems] = useState<string[]>([]);
  const [newItem, setNewItem] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch(`/api/einstellungen?prefix=system.`)
      .then((r) => r.json())
      .then((d) => {
        if (d[settingKey]) {
          try { setItems(JSON.parse(d[settingKey])); } catch { /* ignore */ }
        }
      });
  }, [settingKey]);

  async function save(list: string[]) {
    setSaving(true);
    await fetch("/api/einstellungen", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key: settingKey, value: JSON.stringify(list) }),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  }

  function addItem() {
    const v = newItem.trim();
    if (!v || items.includes(v)) return;
    const next = [...items, v];
    setItems(next);
    setNewItem("");
    save(next);
  }

  function removeItem(item: string) {
    const next = items.filter((i) => i !== item);
    setItems(next);
    save(next);
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <h2 className="text-lg font-semibold mb-1">{label}</h2>
      {saved && <p className="text-xs text-green-600 mb-2">✓ Gespeichert</p>}
      <div className="flex flex-wrap gap-2 mb-3 min-h-[2rem]">
        {items.map((item) => (
          <span key={item} className="flex items-center gap-1 bg-green-50 text-green-800 border border-green-200 px-3 py-1 rounded-full text-sm">
            {item}
            <button onClick={() => removeItem(item)} className="ml-1 text-green-600 hover:text-red-600 leading-none text-base" disabled={saving}>×</button>
          </span>
        ))}
        {items.length === 0 && <p className="text-sm text-gray-400">Noch keine Einträge</p>}
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={newItem}
          onChange={(e) => setNewItem(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addItem())}
          placeholder={placeholder}
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={addItem}
          disabled={!newItem.trim() || saving}
          className="px-4 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg disabled:opacity-50 transition-colors"
        >
          + Hinzufügen
        </button>
      </div>
    </div>
  );
}

interface FirmaSettings {
  "firma.name": string;
  "firma.zusatz": string;
  "firma.strasse": string;
  "firma.plz": string;
  "firma.ort": string;
  "firma.telefon": string;
  "firma.email": string;
  "firma.steuernummer": string;
  "firma.iban": string;
  "firma.bic": string;
  "firma.bank": string;
  "firma.mwstSatz": string;
  "firma.zahlungszielStandard": string;
}

const FIELDS: { key: keyof FirmaSettings; label: string; type?: string }[] = [
  { key: "firma.name", label: "Firmenname" },
  { key: "firma.zusatz", label: "Zusatz" },
  { key: "firma.strasse", label: "Straße" },
  { key: "firma.plz", label: "PLZ" },
  { key: "firma.ort", label: "Ort" },
  { key: "firma.telefon", label: "Telefon", type: "tel" },
  { key: "firma.email", label: "E-Mail", type: "email" },
  { key: "firma.steuernummer", label: "Steuernummer" },
  { key: "firma.iban", label: "IBAN" },
  { key: "firma.bic", label: "BIC" },
  { key: "firma.bank", label: "Bank" },
  { key: "firma.mwstSatz", label: "MwSt-Satz (%)", type: "number" },
  { key: "firma.zahlungszielStandard", label: "Zahlungsziel Standard (Tage)", type: "number" },
];

const DEFAULT_VALUES: FirmaSettings = {
  "firma.name": "",
  "firma.zusatz": "",
  "firma.strasse": "",
  "firma.plz": "",
  "firma.ort": "",
  "firma.telefon": "",
  "firma.email": "",
  "firma.steuernummer": "",
  "firma.iban": "",
  "firma.bic": "",
  "firma.bank": "",
  "firma.mwstSatz": "19",
  "firma.zahlungszielStandard": "30",
};

export default function EinstellungenPage() {
  const [form, setForm] = useState<FirmaSettings>(DEFAULT_VALUES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await fetch("/api/einstellungen");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setForm((prev) => ({ ...prev, ...data }));
    } catch {
      setError("Fehler beim Laden der Einstellungen.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  async function handleSave(key: keyof FirmaSettings) {
    setSaving(key);
    setError(null);
    try {
      const res = await fetch("/api/einstellungen", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, value: form[key] }),
      });
      if (!res.ok) throw new Error();
      setSaved(key);
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError(`Fehler beim Speichern von "${key}".`);
    } finally {
      setSaving(null);
    }
  }

  async function handleSaveAll(e: React.FormEvent) {
    e.preventDefault();
    setSaving("all");
    setError(null);
    try {
      for (const field of FIELDS) {
        await fetch("/api/einstellungen", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: field.key, value: form[field.key] }),
        });
      }
      setSaved("all");
      setTimeout(() => setSaved(null), 2000);
    } catch {
      setError("Fehler beim Speichern.");
    } finally {
      setSaving(null);
    }
  }

  if (loading) {
    return <p className="text-gray-400 mt-8 text-sm">Lade Einstellungen…</p>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold mb-6">Einstellungen</h1>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <FirmenlogoEditor />

      <ListenEditor settingKey="system.mitarbeiter" label="Mitarbeiter / Verantwortliche" placeholder="z.B. Max Mustermann" />
      <ListenEditor settingKey="system.kundenkategorien" label="Kunden-Kategorien" placeholder="z.B. Landwirt" />

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
        <h2 className="text-lg font-semibold mb-4">Firmendaten</h2>
        <form onSubmit={handleSaveAll} className="space-y-4">
          {FIELDS.map((field) => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label}
              </label>
              <div className="flex gap-2">
                <input
                  type={field.type ?? "text"}
                  value={form[field.key]}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, [field.key]: e.target.value }))
                  }
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                />
                <button
                  type="button"
                  onClick={() => handleSave(field.key)}
                  disabled={saving !== null}
                  className="px-3 py-2 text-xs border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                  {saving === field.key
                    ? "…"
                    : saved === field.key
                    ? "✓ Gespeichert"
                    : "Speichern"}
                </button>
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={saving !== null}
              className="px-5 py-2 text-sm bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
            >
              {saving === "all"
                ? "Speichern…"
                : saved === "all"
                ? "✓ Alle gespeichert"
                : "Alle speichern"}
            </button>
          </div>
        </form>
      </div>

      <BatchAdressValidierung />
    </div>
  );
}

function BatchAdressValidierung() {
  const [stats, setStats] = useState<{ total: number; ohneKoords: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState(0);
  const [done, setDone] = useState(false);
  const abortRef = useRef(false);

  useEffect(() => {
    fetch("/api/kunden/adress-validierung")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }, []);

  async function startBatch() {
    setRunning(true);
    setProgress(0);
    setErrors(0);
    setDone(false);
    abortRef.current = false;

    let processed = 0;
    let errCount = 0;

    while (!abortRef.current) {
      const res = await fetch("/api/kunden/adress-validierung?batch=1");
      if (!res.ok) break;
      const data = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;

      for (const kunde of data) {
        if (abortRef.current) break;
        try {
          const postRes = await fetch("/api/kunden/adress-validierung", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kundeId: kunde.id }),
          });
          if (!postRes.ok) errCount++;
        } catch {
          errCount++;
        }
        processed++;
        setProgress(processed);
        setErrors(errCount);
        await new Promise((r) => setTimeout(r, 1200));
      }
    }

    setRunning(false);
    setDone(true);
    fetch("/api/kunden/adress-validierung")
      .then((r) => r.json())
      .then((d) => setStats(d))
      .catch(() => {});
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mt-6">
      <h2 className="text-lg font-semibold mb-1">Adress-Validierung (Batch)</h2>
      <p className="text-sm text-gray-500 mb-4">
        Kunden ohne Koordinaten per OpenStreetMap/Nominatim geocodieren.
      </p>

      {stats && (
        <div className="flex gap-4 mb-4">
          <div className="bg-gray-50 rounded-lg px-4 py-2 text-sm">
            <span className="text-gray-500">Gesamt:</span>{" "}
            <span className="font-semibold">{stats.total}</span>
          </div>
          <div className={`rounded-lg px-4 py-2 text-sm ${stats.ohneKoords > 0 ? "bg-yellow-50" : "bg-green-50"}`}>
            <span className="text-gray-500">Ohne Koordinaten:</span>{" "}
            <span className="font-semibold">{stats.ohneKoords}</span>
          </div>
        </div>
      )}

      {running && (
        <div className="mb-4">
          <p className="text-sm text-blue-700 mb-1">
            Verarbeitet: <strong>{progress}</strong>
            {errors > 0 && <span className="text-red-600 ml-2">({errors} Fehler)</span>}
          </p>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all"
              style={{ width: stats?.ohneKoords ? `${Math.min(100, (progress / stats.ohneKoords) * 100)}%` : "0%" }}
            />
          </div>
        </div>
      )}

      {done && !running && (
        <p className="text-sm text-green-700 mb-4">
          Fertig! {progress} Adressen verarbeitet{errors > 0 ? `, ${errors} Fehler` : ""}.
        </p>
      )}

      <div className="flex gap-2">
        <button
          onClick={startBatch}
          disabled={running || (stats?.ohneKoords === 0)}
          className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
        >
          {running ? "Läuft…" : "Batch-Validierung starten"}
        </button>
        {running && (
          <button
            onClick={() => { abortRef.current = true; }}
            className="px-4 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700"
          >
            Abbrechen
          </button>
        )}
      </div>
    </div>
  );
}
