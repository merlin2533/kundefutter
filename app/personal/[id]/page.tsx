"use client";
import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { MONATE_KURZ, getJahreListeNum, formatDatum, WOCHENTAGE, parseBevorzugteArbeitszeiten } from "@/lib/utils";
import * as Sentry from "@sentry/nextjs";

const TYP_LABEL: Record<string, string> = { festgehalt: "Festgehalt", minijob: "Minijob", stundenbasis: "Stundenbasis" };
const TYP_COLOR: Record<string, string> = {
  festgehalt: "bg-blue-100 text-blue-800",
  minijob: "bg-purple-100 text-purple-800",
  stundenbasis: "bg-orange-100 text-orange-800",
};
const STATUS_COLOR: Record<string, string> = {
  OFFEN: "bg-amber-100 text-amber-800",
  ABGERECHNET: "bg-blue-100 text-blue-800",
  AUSGEZAHLT: "bg-green-100 text-green-700",
  BEANTRAGT: "bg-yellow-100 text-yellow-800",
  GENEHMIGT: "bg-green-100 text-green-700",
  ABGELEHNT: "bg-red-100 text-red-700",
};
const ART_LABEL: Record<string, string> = { arbeit: "Arbeit", urlaub: "Urlaub", krank: "Krank", feiertag: "Feiertag" };
const ART_COLOR: Record<string, string> = {
  arbeit: "bg-green-100 text-green-700",
  urlaub: "bg-blue-100 text-blue-800",
  krank: "bg-red-100 text-red-700",
  feiertag: "bg-gray-100 text-gray-600",
};
const TYPEN = [
  { value: "festgehalt", label: "Festgehalt (monatl. Brutto)" },
  { value: "minijob", label: "Minijob (Monatspauschale)" },
  { value: "stundenbasis", label: "Stundenbasis (Stundenlohn)" },
];
const inputCls = "w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500";

const MONATE = MONATE_KURZ;

interface Mitarbeiter {
  id: number;
  vorname: string;
  nachname: string;
  typ: string;
  aktiv: boolean;
  eintrittsdatum: string;
  austrittsdatum: string | null;
  email: string | null;
  telefon: string | null;
  iban: string | null;
  bic: string | null;
  kontoinhaber: string | null;
  grundgehalt: number | null;
  minijobPauschale: number | null;
  stundenlohn: number | null;
  wochenstunden: number | null;
  urlaubstageProJahr: number;
  kostenstelle: string | null;
  notiz: string | null;
  bevorzugteArbeitszeiten: string | null;
}

interface Arbeitsstunde {
  id: number;
  datum: string;
  stunden: number;
  art: string;
  notiz: string | null;
}

interface Gehaltsabrechnung {
  id: number;
  monat: number;
  jahr: number;
  stundenGesamt: number | null;
  brutto: number;
  netto: number;
  abzuege: number;
  status: string;
  zahlungsDatum: string | null;
  notiz: string | null;
}

interface Urlaubsantrag {
  id: number;
  von: string;
  bis: string;
  tage: number;
  status: string;
  notiz: string | null;
}

type Params = { params: Promise<{ id: string }> };

function DetailContent({ mitarbeiterId }: { mitarbeiterId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = searchParams.get("tab") ?? "stammdaten";

  const [ma, setMa] = useState<Mitarbeiter | null>(null);
  const [loading, setLoading] = useState(true);
  const [stunden, setStunden] = useState<Arbeitsstunde[]>([]);
  const [abrechnungen, setAbrechnungen] = useState<Gehaltsabrechnung[]>([]);
  const [urlaubsantraege, setUrlaubsantraege] = useState<Urlaubsantrag[]>([]);
  const [stundenMonat, setStundenMonat] = useState(new Date().getMonth() + 1);
  const [stundenJahr, setStundenJahr] = useState(new Date().getFullYear());
  const [abrError, setAbrError] = useState("");
  const [actionLoading, setActionLoading] = useState(false);
  const [istAdmin, setIstAdmin] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const numId = parseInt(mitarbeiterId, 10);

  useEffect(() => {
    fetch(`/api/personal/mitarbeiter/${numId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setMa(d); })
      .finally(() => setLoading(false));
  }, [numId]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setIstAdmin(d?.user?.rolle === "admin"))
      .catch((err) => Sentry.captureException(err));
  }, []);

  useEffect(() => {
    if (activeTab === "stunden") {
      fetch(`/api/personal/arbeitsstunden?mitarbeiterId=${numId}&monat=${stundenMonat}&jahr=${stundenJahr}`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setStunden(Array.isArray(d) ? d : []));
    }
  }, [activeTab, numId, stundenMonat, stundenJahr]);

  useEffect(() => {
    if (activeTab === "abrechnung") {
      fetch(`/api/personal/abrechnungen?mitarbeiterId=${numId}`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setAbrechnungen(Array.isArray(d) ? d : []));
    }
  }, [activeTab, numId]);

  useEffect(() => {
    if (activeTab === "urlaub") {
      fetch(`/api/personal/urlaubsantraege?mitarbeiterId=${numId}`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setUrlaubsantraege(Array.isArray(d) ? d : []));
    }
  }, [activeTab, numId]);

  async function handleAuszahlen(abrId: number) {
    if (!confirm("Jetzt als ausgezahlt markieren und Ausgabe erstellen?")) return;
    setActionLoading(true);
    setAbrError("");
    const res = await fetch(`/api/personal/abrechnungen/${abrId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktion: "auszahlen" }),
    });
    setActionLoading(false);
    if (!res.ok) {
      const d = await res.json();
      setAbrError(d.error ?? "Fehler");
    } else {
      const data = await res.json();
      setAbrechnungen((prev) => prev.map((a) => a.id === abrId ? data.abrechnung : a));
    }
  }

  async function handleAbrechnen(abrId: number) {
    setActionLoading(true);
    const res = await fetch(`/api/personal/abrechnungen/${abrId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktion: "abrechnen" }),
    });
    setActionLoading(false);
    if (res.ok) {
      const d = await res.json();
      setAbrechnungen((prev) => prev.map((a) => a.id === abrId ? d : a));
    }
  }

  async function handleUrlaubAktion(antragId: number, aktion: "genehmigen" | "ablehnen") {
    const res = await fetch(`/api/personal/urlaubsantraege/${antragId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktion }),
    });
    if (res.ok) {
      const d = await res.json();
      setUrlaubsantraege((prev) => prev.map((u) => u.id === antragId ? d : u));
    }
  }

  async function handleDeleteStunde(stundeId: number) {
    if (!confirm("Stundeneintrag löschen?")) return;
    const res = await fetch(`/api/personal/arbeitsstunden/${stundeId}`, { method: "DELETE" });
    if (res.ok) setStunden((prev) => prev.filter((s) => s.id !== stundeId));
  }

  async function handleDeleteAbrechnung(abrId: number) {
    if (!confirm("Diese Abrechnung endgültig löschen?")) return;
    setActionLoading(true);
    setAbrError("");
    const res = await fetch(`/api/personal/abrechnungen/${abrId}`, { method: "DELETE" });
    setActionLoading(false);
    if (!res.ok) {
      const d = await res.json().catch((err) => {
        Sentry.captureException(err);
        return {};
      });
      setAbrError(d.error ?? "Löschen fehlgeschlagen");
    } else {
      setAbrechnungen((prev) => prev.filter((a) => a.id !== abrId));
    }
  }

  async function handleDeactivate() {
    if (!ma) return;
    if (!confirm(`Mitarbeiter ${ma.vorname} ${ma.nachname} deaktivieren?`)) return;
    const res = await fetch(`/api/personal/mitarbeiter/${numId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ aktiv: false }),
    });
    if (res.ok) {
      setMa((prev) => prev ? { ...prev, aktiv: false } : prev);
    } else {
      const d = await res.json().catch((err) => {
        Sentry.captureException(err);
        return ({});
      });
      setAbrError(d.error ?? "Fehler beim Deaktivieren");
    }
  }

  function setTab(tab: string) {
    router.push(`/personal/${numId}?tab=${tab}`, { scroll: false });
  }

  function startEditing() {
    if (!ma) return;
    const bevorzugt = parseBevorzugteArbeitszeiten(ma.bevorzugteArbeitszeiten) ?? {};
    const arbeitszeitFelder: Record<string, string> = {};
    for (const w of WOCHENTAGE) {
      arbeitszeitFelder[`arbeitszeit_${w.key}`] = typeof bevorzugt[w.key] === "number" ? String(bevorzugt[w.key]) : "";
    }
    setEditForm({
      ...arbeitszeitFelder,
      vorname: ma.vorname,
      nachname: ma.nachname,
      typ: ma.typ,
      eintrittsdatum: ma.eintrittsdatum.slice(0, 10),
      austrittsdatum: ma.austrittsdatum ? ma.austrittsdatum.slice(0, 10) : "",
      wochenstunden: ma.wochenstunden != null ? String(ma.wochenstunden) : "",
      urlaubstageProJahr: String(ma.urlaubstageProJahr),
      kostenstelle: ma.kostenstelle ?? "",
      grundgehalt: ma.grundgehalt != null ? String(ma.grundgehalt) : "",
      minijobPauschale: ma.minijobPauschale != null ? String(ma.minijobPauschale) : "",
      stundenlohn: ma.stundenlohn != null ? String(ma.stundenlohn) : "",
      email: ma.email ?? "",
      telefon: ma.telefon ?? "",
      iban: ma.iban ?? "",
      bic: ma.bic ?? "",
      kontoinhaber: ma.kontoinhaber ?? "",
      notiz: ma.notiz ?? "",
    });
    setSaveError("");
    setEditing(true);
  }

  function setEditField(field: string, value: string) {
    setEditForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    if (!editForm.vorname?.trim() || !editForm.nachname?.trim()) {
      setSaveError("Vorname und Nachname sind erforderlich.");
      return;
    }
    setSaving(true);
    setSaveError("");
    const bevorzugt: Record<string, number> = {};
    for (const w of WOCHENTAGE) {
      const v = editForm[`arbeitszeit_${w.key}`];
      if (v !== undefined && v !== "") bevorzugt[w.key] = parseFloat(v);
    }
    const payload: Record<string, unknown> = {
      vorname: editForm.vorname.trim(),
      bevorzugteArbeitszeiten: Object.keys(bevorzugt).length > 0 ? JSON.stringify(bevorzugt) : null,
      nachname: editForm.nachname.trim(),
      typ: editForm.typ,
      eintrittsdatum: editForm.eintrittsdatum,
      austrittsdatum: editForm.austrittsdatum || null,
      wochenstunden: editForm.wochenstunden ? parseFloat(editForm.wochenstunden) : null,
      urlaubstageProJahr: parseInt(editForm.urlaubstageProJahr, 10) || 0,
      kostenstelle: editForm.kostenstelle || null,
      grundgehalt: editForm.grundgehalt ? parseFloat(editForm.grundgehalt) : null,
      minijobPauschale: editForm.minijobPauschale ? parseFloat(editForm.minijobPauschale) : null,
      stundenlohn: editForm.stundenlohn ? parseFloat(editForm.stundenlohn) : null,
      email: editForm.email || null,
      telefon: editForm.telefon || null,
      iban: editForm.iban || null,
      bic: editForm.bic || null,
      kontoinhaber: editForm.kontoinhaber || null,
      notiz: editForm.notiz || null,
    };
    try {
      const res = await fetch(`/api/personal/mitarbeiter/${numId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return {};
        });
        setSaveError(d.error ?? "Fehler beim Speichern");
        return;
      }
      const updated = await res.json();
      setMa(updated);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-8 text-center text-gray-500">Lade…</div>;
  if (!ma) return (
    <div className="p-8 text-center">
      <p className="text-gray-500 mb-3">Mitarbeiter nicht gefunden.</p>
      <Link href="/personal" className="text-green-700 hover:underline">← Zurück</Link>
    </div>
  );

  const stundenSumme = stunden.filter((s) => s.art === "arbeit").reduce((sum, s) => sum + s.stunden, 0);
  const urlaubTage = stunden.filter((s) => s.art === "urlaub").reduce((sum, s) => sum + s.stunden / 8, 0);
  const krankTage = stunden.filter((s) => s.art === "krank").reduce((sum, s) => sum + s.stunden / 8, 0);

  const urlaubGenehmigt = urlaubsantraege
    .filter((u) => u.status === "GENEHMIGT" && new Date(u.von).getFullYear() === new Date().getFullYear())
    .reduce((sum, u) => sum + u.tage, 0);
  const urlaubRest = ma.urlaubstageProJahr - urlaubGenehmigt;

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <Link href="/personal" className="text-gray-400 hover:text-gray-600 text-sm">← Personal</Link>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">{ma.vorname} {ma.nachname}</h1>
            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TYP_COLOR[ma.typ] ?? "bg-gray-100"}`}>
              {TYP_LABEL[ma.typ] ?? ma.typ}
            </span>
            {!ma.aktiv && (
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">Inaktiv</span>
            )}
          </div>
          <div className="text-sm text-gray-500 mt-1">
            {ma.email && <span className="mr-4">{ma.email}</span>}
            {ma.telefon && <span>{ma.telefon}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          {ma.aktiv && (
            <button onClick={handleDeactivate} className="text-xs border px-3 py-1.5 rounded hover:bg-gray-50 text-gray-600">
              Deaktivieren
            </button>
          )}
          <Link href={`/personal/abrechnungen/neu?mitarbeiterId=${ma.id}`} className="bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-800">
            + Abrechnung
          </Link>
          <Link href={`/personal/${ma.id}/stunden/neu`} className="border px-3 py-1.5 rounded text-xs hover:bg-gray-50">
            + Stunden
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {[
          { key: "stammdaten", label: "Stammdaten" },
          { key: "stunden", label: "Stunden" },
          { key: "abrechnung", label: "Abrechnung" },
          { key: "urlaub", label: "Urlaub" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === t.key ? "border-green-700 text-green-700" : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Stammdaten */}
      {activeTab === "stammdaten" && (
        <div>
          <div className="flex justify-end mb-4">
            {!editing && (
              <button onClick={startEditing} className="text-sm text-green-700 hover:text-green-900 font-medium">
                Bearbeiten
              </button>
            )}
          </div>

          {saveError && (
            <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {saveError}
            </div>
          )}

          {editing ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-1">Beschäftigung</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Vorname *</label>
                    <input value={editForm.vorname ?? ""} onChange={(e) => setEditField("vorname", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Nachname *</label>
                    <input value={editForm.nachname ?? ""} onChange={(e) => setEditField("nachname", e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beschäftigungstyp</label>
                  <select value={editForm.typ ?? ""} onChange={(e) => setEditField("typ", e.target.value)} className={inputCls}>
                    {TYPEN.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Eintrittsdatum</label>
                    <input type="date" value={editForm.eintrittsdatum ?? ""} onChange={(e) => setEditField("eintrittsdatum", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Austrittsdatum</label>
                    <input type="date" value={editForm.austrittsdatum ?? ""} onChange={(e) => setEditField("austrittsdatum", e.target.value)} className={inputCls} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Urlaubstage/Jahr</label>
                    <input type="number" min="0" max="365" value={editForm.urlaubstageProJahr ?? ""} onChange={(e) => setEditField("urlaubstageProJahr", e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kostenstelle</label>
                    <input value={editForm.kostenstelle ?? ""} onChange={(e) => setEditField("kostenstelle", e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-1">Bevorzugte Arbeitszeiten</h3>
                <p className="text-xs text-gray-500 -mt-2">
                  Vorbelegung für die Arbeitszeiterfassung — dort muss dann nur noch bestätigt werden.
                </p>
                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                  {WOCHENTAGE.map((w) => (
                    <div key={w.key}>
                      <label className="block text-xs font-medium text-gray-500 mb-1 text-center">{w.label}</label>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="24"
                        placeholder="–"
                        value={editForm[`arbeitszeit_${w.key}`] ?? ""}
                        onChange={(e) => setEditField(`arbeitszeit_${w.key}`, e.target.value)}
                        className={`${inputCls} text-center px-1`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-1">Vergütung</h3>
                {editForm.typ === "festgehalt" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Grundgehalt brutto (€/Monat)</label>
                    <input type="number" step="0.01" min="0" value={editForm.grundgehalt ?? ""} onChange={(e) => setEditField("grundgehalt", e.target.value)} className={inputCls} />
                  </div>
                )}
                {editForm.typ === "minijob" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Monatliche Pauschale (€)</label>
                    <input type="number" step="0.01" min="0" max="556" value={editForm.minijobPauschale ?? ""} onChange={(e) => setEditField("minijobPauschale", e.target.value)} className={inputCls} />
                  </div>
                )}
                {editForm.typ === "stundenbasis" && (
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Stundenlohn brutto (€/h)</label>
                      <input type="number" step="0.01" min="0" value={editForm.stundenlohn ?? ""} onChange={(e) => setEditField("stundenlohn", e.target.value)} className={inputCls} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wochenstunden (Soll)</label>
                      <input type="number" step="0.5" min="0" max="60" value={editForm.wochenstunden ?? ""} onChange={(e) => setEditField("wochenstunden", e.target.value)} className={inputCls} />
                    </div>
                  </div>
                )}
                {editForm.typ !== "stundenbasis" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wochenstunden (optional)</label>
                    <input type="number" step="0.5" min="0" max="60" value={editForm.wochenstunden ?? ""} onChange={(e) => setEditField("wochenstunden", e.target.value)} className={inputCls} />
                  </div>
                )}
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-1">Kontakt</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">E-Mail</label>
                  <input type="email" value={editForm.email ?? ""} onChange={(e) => setEditField("email", e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                  <input value={editForm.telefon ?? ""} onChange={(e) => setEditField("telefon", e.target.value)} className={inputCls} />
                </div>
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-1">Bankverbindung</h3>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">IBAN</label>
                  <input value={editForm.iban ?? ""} onChange={(e) => setEditField("iban", e.target.value.toUpperCase())} className={`${inputCls} font-mono`} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">BIC</label>
                    <input value={editForm.bic ?? ""} onChange={(e) => setEditField("bic", e.target.value.toUpperCase())} className={`${inputCls} font-mono`} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kontoinhaber (falls abweichend)</label>
                    <input value={editForm.kontoinhaber ?? ""} onChange={(e) => setEditField("kontoinhaber", e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800 mb-1">Notiz</h3>
                <textarea rows={2} value={editForm.notiz ?? ""} onChange={(e) => setEditField("notiz", e.target.value)} className={`${inputCls} resize-none`} />
              </div>

              <div className="md:col-span-2 flex justify-end gap-3">
                <button onClick={() => setEditing(false)} disabled={saving} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50 disabled:opacity-50">
                  Abbrechen
                </button>
                <button onClick={handleSave} disabled={saving} className="bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-green-800 disabled:opacity-50">
                  {saving ? "Speichern…" : "Speichern"}
                </button>
              </div>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">Beschäftigung</h3>
                <Row label="Typ" value={TYP_LABEL[ma.typ] ?? ma.typ} />
                <Row label="Eintritt" value={formatDatum(ma.eintrittsdatum)} />
                {ma.austrittsdatum && <Row label="Austritt" value={formatDatum(ma.austrittsdatum)} />}
                {ma.wochenstunden != null && <Row label="Wochenstunden" value={`${ma.wochenstunden} h`} />}
                <Row label="Urlaubstage/Jahr" value={`${ma.urlaubstageProJahr} Tage`} />
                {ma.kostenstelle && <Row label="Kostenstelle" value={ma.kostenstelle} />}
                {(() => {
                  const bevorzugt = parseBevorzugteArbeitszeiten(ma.bevorzugteArbeitszeiten);
                  if (!bevorzugt) return null;
                  const text = WOCHENTAGE
                    .filter((w) => typeof bevorzugt[w.key] === "number")
                    .map((w) => `${w.label} ${bevorzugt[w.key]}h`)
                    .join(" · ");
                  return text ? <Row label="Bevorzugte Arbeitszeiten" value={text} /> : null;
                })()}
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">Vergütung</h3>
                {ma.typ === "festgehalt" && <Row label="Grundgehalt" value={`${(ma.grundgehalt ?? 0).toFixed(2)} €/Mon.`} />}
                {ma.typ === "minijob" && <Row label="Pauschale" value={`${(ma.minijobPauschale ?? 0).toFixed(2)} €/Mon.`} />}
                {ma.typ === "stundenbasis" && (
                  <>
                    <Row label="Stundenlohn" value={`${(ma.stundenlohn ?? 0).toFixed(2)} €/h`} />
                    {ma.wochenstunden != null && (
                      <Row label="Plankosten/Monat" value={`≈ ${((ma.stundenlohn ?? 0) * ma.wochenstunden * 4.33).toFixed(2)} €`} />
                    )}
                  </>
                )}
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">Kontakt</h3>
                {ma.email && <Row label="E-Mail" value={ma.email} />}
                {ma.telefon && <Row label="Telefon" value={ma.telefon} />}
                {!ma.email && !ma.telefon && <p className="text-sm text-gray-400">Keine Kontaktdaten</p>}
              </div>

              <div className="bg-white border rounded-lg p-5 space-y-3">
                <h3 className="font-semibold text-gray-800">Bankverbindung</h3>
                {ma.iban ? (
                  <>
                    <Row label="IBAN" value={ma.iban} mono />
                    {ma.bic && <Row label="BIC" value={ma.bic} mono />}
                    {ma.kontoinhaber && <Row label="Kontoinhaber" value={ma.kontoinhaber} />}
                  </>
                ) : (
                  <p className="text-sm text-gray-400">Keine Bankverbindung hinterlegt</p>
                )}
              </div>

              {ma.notiz && (
                <div className="md:col-span-2 bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <p className="text-sm text-amber-900">{ma.notiz}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tab: Stunden */}
      {activeTab === "stunden" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex gap-2">
              <select
                value={stundenMonat}
                onChange={(e) => setStundenMonat(parseInt(e.target.value, 10))}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {MONATE.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select
                value={stundenJahr}
                onChange={(e) => setStundenJahr(parseInt(e.target.value, 10))}
                className="border rounded-lg px-3 py-1.5 text-sm"
              >
                {getJahreListeNum().map((y) => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
            <Link href={`/personal/${ma.id}/stunden/neu`} className="bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-800">
              + Stunden erfassen
            </Link>
          </div>

          {/* Stunden-Summary */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-center">
              <div className="text-xs text-green-700 mb-1">Arbeitsstunden</div>
              <div className="text-xl font-bold text-green-800">{stundenSumme.toFixed(1)} h</div>
            </div>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-center">
              <div className="text-xs text-blue-700 mb-1">Urlaubstage</div>
              <div className="text-xl font-bold text-blue-800">{urlaubTage.toFixed(1)}</div>
            </div>
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
              <div className="text-xs text-red-700 mb-1">Krankentage</div>
              <div className="text-xl font-bold text-red-800">{krankTage.toFixed(1)}</div>
            </div>
          </div>

          {stunden.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
              Keine Einträge für diesen Monat
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Datum</th>
                    <th className="px-4 py-2 text-left">Art</th>
                    <th className="px-4 py-2 text-right">Stunden</th>
                    <th className="px-4 py-2 text-left hidden md:table-cell">Notiz</th>
                    <th className="px-4 py-2 text-right">Löschen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {stunden.map((s) => (
                    <tr key={s.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{formatDatum(s.datum)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ART_COLOR[s.art] ?? "bg-gray-100"}`}>
                          {ART_LABEL[s.art] ?? s.art}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right font-mono">{s.stunden.toFixed(1)}</td>
                      <td className="px-4 py-2 text-gray-500 hidden md:table-cell">{s.notiz ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <button onClick={() => handleDeleteStunde(s.id)} className="text-xs text-red-500 hover:text-red-700">
                          Löschen
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Abrechnung */}
      {activeTab === "abrechnung" && (
        <div>
          {abrError && <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700 mb-4">{abrError}</div>}
          <div className="flex justify-end mb-4">
            <Link href={`/personal/abrechnungen/neu?mitarbeiterId=${ma.id}`} className="bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-800">
              + Neue Abrechnung
            </Link>
          </div>

          {abrechnungen.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
              Noch keine Abrechnungen vorhanden
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Zeitraum</th>
                    {ma.typ === "stundenbasis" && <th className="px-4 py-2 text-right hidden sm:table-cell">Stunden</th>}
                    <th className="px-4 py-2 text-right">Brutto</th>
                    <th className="px-4 py-2 text-right">Netto</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left hidden md:table-cell">Zahlung</th>
                    <th className="px-4 py-2 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {abrechnungen.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium">
                        {MONATE[a.monat - 1]} {a.jahr}
                      </td>
                      {ma.typ === "stundenbasis" && (
                        <td className="px-4 py-2 text-right hidden sm:table-cell text-gray-500 text-xs">
                          {a.stundenGesamt != null ? `${a.stundenGesamt.toFixed(1)} h` : "—"}
                        </td>
                      )}
                      <td className="px-4 py-2 text-right">{a.brutto.toFixed(2)} €</td>
                      <td className="px-4 py-2 text-right font-medium">{a.netto.toFixed(2)} €</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[a.status] ?? "bg-gray-100"}`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell text-gray-500 text-xs">
                        {a.zahlungsDatum ? formatDatum(a.zahlungsDatum) : "—"}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {a.status === "OFFEN" && (
                            <button
                              onClick={() => handleAbrechnen(a.id)}
                              disabled={actionLoading}
                              className="text-xs text-blue-600 hover:underline disabled:opacity-50"
                            >
                              Abrechnen
                            </button>
                          )}
                          {a.status === "ABGERECHNET" && (
                            <button
                              onClick={() => handleAuszahlen(a.id)}
                              disabled={actionLoading}
                              className="text-xs text-green-700 hover:underline disabled:opacity-50"
                            >
                              Auszahlen
                            </button>
                          )}
                          <Link href={`/personal/abrechnungen/${a.id}/druck`} className="text-xs text-gray-500 hover:underline" target="_blank">
                            Druck
                          </Link>
                          {istAdmin && a.status !== "AUSGEZAHLT" && (
                            <button
                              onClick={() => handleDeleteAbrechnung(a.id)}
                              disabled={actionLoading}
                              className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                            >
                              Löschen
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab: Urlaub */}
      {activeTab === "urlaub" && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 text-sm">
              <span className="text-blue-700 font-medium">{urlaubRest} Tage</span>
              <span className="text-blue-600"> Resturlaub ({ma.urlaubstageProJahr} gesamt − {urlaubGenehmigt} genommen)</span>
            </div>
            <Link href={`/personal/${ma.id}/urlaub/neu`} className="bg-green-700 text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-green-800">
              + Urlaubsantrag
            </Link>
          </div>

          {urlaubsantraege.length === 0 ? (
            <div className="bg-white border rounded-lg p-8 text-center text-gray-400">
              Keine Urlaubsanträge vorhanden
            </div>
          ) : (
            <div className="bg-white border rounded-lg overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                    <th className="px-4 py-2 text-left">Von</th>
                    <th className="px-4 py-2 text-left">Bis</th>
                    <th className="px-4 py-2 text-right">Tage</th>
                    <th className="px-4 py-2 text-left">Status</th>
                    <th className="px-4 py-2 text-left hidden md:table-cell">Notiz</th>
                    <th className="px-4 py-2 text-right">Aktionen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {urlaubsantraege.map((u) => (
                    <tr key={u.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2">{formatDatum(u.von)}</td>
                      <td className="px-4 py-2">{formatDatum(u.bis)}</td>
                      <td className="px-4 py-2 text-right">{u.tage}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLOR[u.status] ?? "bg-gray-100"}`}>
                          {u.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 hidden md:table-cell text-gray-500">{u.notiz ?? "—"}</td>
                      <td className="px-4 py-2 text-right">
                        <div className="flex justify-end gap-2">
                          {u.status === "BEANTRAGT" && (
                            <>
                              <button onClick={() => handleUrlaubAktion(u.id, "genehmigen")} className="text-xs text-green-700 hover:underline">
                                Genehmigen
                              </button>
                              <button onClick={() => handleUrlaubAktion(u.id, "ablehnen")} className="text-xs text-red-500 hover:underline">
                                Ablehnen
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`font-medium ${mono ? "font-mono text-xs" : ""}`}>{value}</span>
    </div>
  );
}

export default function PersonalDetailPage({ params }: Params) {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    params.then((p) => setId(p.id));
  }, [params]);

  if (!id) return null;

  return (
    <Suspense fallback={null}>
      <DetailContent mitarbeiterId={id} />
    </Suspense>
  );
}
