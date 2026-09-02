"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatEuro } from "@/lib/utils";
import { useToast } from "@/components/ToastProvider";
import AudioRecorder from "@/components/AudioRecorder";
import KonfidenzBadge from "@/components/KonfidenzBadge";
import { matchArtikel, normalisiereSuchtext, type Konfidenz } from "@/lib/kiMatching";
import * as Sentry from "@sentry/nextjs";

const LAGER_KATEGORIEN_OHNE = ["Beratung", "Analysen"];

interface Bestellposition {
  id: number;
  menge: number;
  einheit: string;
  einkaufspreis: number;
  status: string;
  bestelltAm: string | null;
  geliefertAm: string | null;
  notiz: string | null;
  createdAt: string;
  lieferant: { id: number; name: string; email: string | null; telefon: string | null; frachtkosten: number; mindestbestellwert: number };
  artikel: { id: number; name: string; artikelnummer: string; einheit: string; kategorie: string; aktuellerBestand: number; lagerort: string | null };
  kunde: { id: number; name: string; firma: string | null } | null;
  lieferung: { id: number; datum: string } | null;
  bestellung: { id: number; nummer: string } | null;
}

interface ArtikelTreffer {
  id: number;
  name: string;
  artikelnummer: string | null;
  einheit: string;
}

interface LieferantOption {
  id: number;
  name: string;
}

interface DiktatKiPosition {
  name: string;
  menge: number;
  einheit?: string | null;
  lieferant?: string | null;
  notiz?: string | null;
}

interface DiktatPosition {
  ki: DiktatKiPosition;
  kandidaten: ArtikelTreffer[];
  artikelId: string;
  menge: string;
  einheit: string;
  notiz: string;
  lieferantId: string;
  konfidenz: Konfidenz;
  fehler?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  offen:     { label: "Offen",     color: "bg-yellow-100 text-yellow-800" },
  bestellt:  { label: "Bestellt",  color: "bg-blue-100 text-blue-800" },
  geliefert: { label: "Geliefert", color: "bg-green-100 text-green-800" },
  storniert: { label: "Storniert", color: "bg-gray-100 text-gray-500" },
};

export default function BestelllistePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [positionen, setPositionen] = useState<Bestellposition[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<"offen" | "bestellt" | "alle">("offen");
  const [updating, setUpdating] = useState<number | null>(null);
  const [buendeln, setBuendeln] = useState<number | null>(null); // lieferantId, während "Lieferantenbestellung erstellen" läuft
  const [lieferantWechsel, setLieferantWechsel] = useState<number | null>(null); // positionId, deren Lieferant-Dropdown offen ist
  const [lieferantenListe, setLieferantenListe] = useState<LieferantOption[]>([]);

  // + Position hinzufügen
  const [formOffen, setFormOffen] = useState(false);
  const [suchtext, setSuchtext] = useState("");
  const [treffer, setTreffer] = useState<ArtikelTreffer[]>([]);
  const [sucheLaeuft, setSucheLaeuft] = useState(false);
  const [gewaehlterArtikel, setGewaehlterArtikel] = useState<ArtikelTreffer | null>(null);
  const [neuMenge, setNeuMenge] = useState("");
  const [neuEinheit, setNeuEinheit] = useState("");
  const [neuNotiz, setNeuNotiz] = useState("");
  const [neuLieferantId, setNeuLieferantId] = useState("");
  const [keinLieferantHinterlegt, setKeinLieferantHinterlegt] = useState(false);
  const [addFehler, setAddFehler] = useState("");
  const [adding, setAdding] = useState(false);
  const suchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Diktieren — mehrere Positionen per Spracheingabe erfassen (Alternative zum manuellen
  // "+ Position hinzufügen"-Formular)
  const [diktatOffen, setDiktatOffen] = useState(false);
  const [diktatAnalysing, setDiktatAnalysing] = useState(false);
  const [diktatFehler, setDiktatFehler] = useState("");
  const [diktatPositionen, setDiktatPositionen] = useState<DiktatPosition[]>([]);
  const [diktatSubmitting, setDiktatSubmitting] = useState(false);

  async function load() {
    setLoading(true);
    const param = statusFilter === "alle" ? "alle" : statusFilter;
    try {
      const res = await fetch(`/api/bestellliste?status=${param}`);
      if (!res.ok) {
        // Ohne Rückmeldung sähe ein HTTP-Fehler wie eine leere Bestellliste aus.
        showToast("Bestellliste konnte nicht geladen werden.", "error");
        setPositionen([]);
        return;
      }
      const data = await res.json();
      setPositionen(Array.isArray(data) ? data : []);
    } catch (err) {
      Sentry.captureException(err);
      showToast("Bestellliste konnte nicht geladen werden.", "error");
      setPositionen([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [statusFilter]);

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferantenListe(Array.isArray(d) ? d.map((l: { id: number; name: string }) => ({ id: l.id, name: l.name })) : []))
      .catch((err) => Sentry.captureException(err));
  }, []);

  // Artikel-Suche (debounced), analog zur "Andere Rechnung suchen"-Suche im Bankabgleich
  useEffect(() => {
    if (suchTimer.current) clearTimeout(suchTimer.current);
    if (suchtext.trim().length < 2 || gewaehlterArtikel) {
      setTreffer([]);
      return;
    }
    suchTimer.current = setTimeout(async () => {
      setSucheLaeuft(true);
      try {
        const res = await fetch(`/api/artikel?search=${encodeURIComponent(suchtext.trim())}&limit=15&relations=false`);
        if (res.ok) setTreffer(await res.json());
      } catch (err) {
        Sentry.captureException(err);
      } finally {
        setSucheLaeuft(false);
      }
    }, 300);
    return () => { if (suchTimer.current) clearTimeout(suchTimer.current); };
  }, [suchtext, gewaehlterArtikel]);

  function waehleArtikel(a: ArtikelTreffer) {
    setGewaehlterArtikel(a);
    setSuchtext(a.name);
    setTreffer([]);
    setNeuEinheit(a.einheit);
    setKeinLieferantHinterlegt(false);
    setNeuLieferantId("");
  }

  function resetForm() {
    setSuchtext("");
    setGewaehlterArtikel(null);
    setNeuMenge("");
    setNeuEinheit("");
    setNeuNotiz("");
    setNeuLieferantId("");
    setKeinLieferantHinterlegt(false);
    setAddFehler("");
  }

  async function handleAdd() {
    if (!gewaehlterArtikel) { setAddFehler("Bitte einen Artikel auswählen."); return; }
    const menge = parseFloat(neuMenge);
    if (!Number.isFinite(menge) || menge <= 0) { setAddFehler("Bitte eine gültige Menge eingeben."); return; }
    if (keinLieferantHinterlegt && !neuLieferantId) { setAddFehler("Bitte einen Lieferanten auswählen."); return; }

    setAdding(true);
    setAddFehler("");
    try {
      const res = await fetch("/api/bestellliste", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: gewaehlterArtikel.id,
          menge,
          einheit: neuEinheit || gewaehlterArtikel.einheit,
          notiz: neuNotiz || undefined,
          lieferantId: neuLieferantId || undefined,
        }),
      });
      if (res.status === 422) {
        // Kein Lieferant für den Artikel hinterlegt — Dropdown zur manuellen Wahl einblenden.
        setKeinLieferantHinterlegt(true);
        setAddFehler("Für diesen Artikel ist noch kein Lieferant hinterlegt — bitte auswählen.");
        return;
      }
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setAddFehler(d.error ?? "Position konnte nicht angelegt werden.");
        return;
      }
      resetForm();
      showToast("Position zur Bestellliste hinzugefügt.", "success");
      load();
    } catch (err) {
      Sentry.captureException(err);
      setAddFehler("Netzwerkfehler.");
    } finally {
      setAdding(false);
    }
  }

  // ── Diktieren: mehrere Positionen per Spracheingabe erfassen ──────────────

  function matchLieferantName(name: string | null | undefined): string {
    if (!name) return "";
    const norm = normalisiereSuchtext(name);
    const treffer =
      lieferantenListe.find((l) => normalisiereSuchtext(l.name) === norm) ??
      lieferantenListe.find(
        (l) => normalisiereSuchtext(l.name).includes(norm) || norm.includes(normalisiereSuchtext(l.name))
      );
    return treffer ? String(treffer.id) : "";
  }

  async function handleDiktatTranscript(text: string) {
    setDiktatAnalysing(true);
    setDiktatFehler("");
    setDiktatPositionen([]);
    try {
      const res = await fetch("/api/ki/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, feature: "bestellliste" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "KI-Analyse fehlgeschlagen");
      const kiPositionen: DiktatKiPosition[] = Array.isArray(data.ergebnis?.positionen) ? data.ergebnis.positionen : [];
      if (kiPositionen.length === 0) {
        setDiktatFehler("Keine Artikel-Position erkannt. Bitte erneut versuchen.");
        return;
      }

      const zeilen: DiktatPosition[] = await Promise.all(
        kiPositionen.map(async (ki) => {
          let kandidaten: ArtikelTreffer[] = [];
          if (ki.name) {
            try {
              const r = await fetch(`/api/artikel?search=${encodeURIComponent(ki.name)}&limit=5&relations=false`);
              if (r.ok) kandidaten = await r.json();
            } catch (err) {
              Sentry.captureException(err);
            }
          }
          const { artikel: match, konfidenz } = matchArtikel(
            { name: ki.name },
            kandidaten.map((k) => ({ ...k, artikelnummer: k.artikelnummer ?? "" }))
          );
          return {
            ki,
            kandidaten,
            artikelId: match ? String(match.id) : "",
            menge: ki.menge != null ? String(ki.menge) : "",
            einheit: ki.einheit || match?.einheit || "",
            notiz: ki.notiz ?? "",
            lieferantId: matchLieferantName(ki.lieferant),
            konfidenz: match ? konfidenz : "keine",
          };
        })
      );
      setDiktatPositionen(zeilen);
    } catch (err) {
      Sentry.captureException(err);
      setDiktatFehler(err instanceof Error ? err.message : "Fehler bei der Spracherkennung.");
    } finally {
      setDiktatAnalysing(false);
    }
  }

  function updateDiktatPosition(idx: number, patch: Partial<DiktatPosition>) {
    setDiktatPositionen((prev) => prev.map((p, i) => (i === idx ? { ...p, ...patch, fehler: undefined } : p)));
  }

  function removeDiktatPosition(idx: number) {
    setDiktatPositionen((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleDiktatSubmit() {
    const kandidatenZeilen = diktatPositionen
      .map((p, idx) => ({ p, idx }))
      .filter(({ p }) => p.artikelId && parseFloat(p.menge) > 0);
    if (kandidatenZeilen.length === 0) return;

    setDiktatSubmitting(true);
    const erledigtIdx = new Set<number>();
    let hinzugefuegt = 0;
    for (const { p, idx } of kandidatenZeilen) {
      try {
        const res = await fetch("/api/bestellliste", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            artikelId: parseInt(p.artikelId, 10),
            menge: parseFloat(p.menge),
            einheit: p.einheit || undefined,
            notiz: p.notiz || undefined,
            lieferantId: p.lieferantId || undefined,
          }),
        });
        if (res.status === 422) {
          setDiktatPositionen((prev) =>
            prev.map((row, i) => (i === idx ? { ...row, fehler: "Kein Lieferant hinterlegt — bitte auswählen." } : row))
          );
          continue;
        }
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          setDiktatPositionen((prev) =>
            prev.map((row, i) => (i === idx ? { ...row, fehler: d.error ?? "Fehler beim Hinzufügen." } : row))
          );
          continue;
        }
        erledigtIdx.add(idx);
        hinzugefuegt++;
      } catch (err) {
        Sentry.captureException(err);
        setDiktatPositionen((prev) =>
          prev.map((row, i) => (i === idx ? { ...row, fehler: "Netzwerkfehler." } : row))
        );
      }
    }
    setDiktatSubmitting(false);
    if (hinzugefuegt > 0) {
      showToast(`${hinzugefuegt} Position${hinzugefuegt === 1 ? "" : "en"} zur Bestellliste hinzugefügt.`, "success");
      load();
    }
    setDiktatPositionen((prev) => {
      const rest = prev.filter((_, i) => !erledigtIdx.has(i));
      if (rest.length === 0) setDiktatOffen(false);
      return rest;
    });
  }

  async function updateStatus(id: number, status: string) {
    setUpdating(id);
    await fetch(`/api/bestellliste/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setUpdating(null);
    load();
  }

  async function handleLieferantWechseln(id: number, lieferantId: number) {
    setUpdating(id);
    try {
      const res = await fetch(`/api/bestellliste/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferantId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        showToast(d.error ?? "Lieferant konnte nicht geändert werden.", "error");
      }
    } catch (err) {
      Sentry.captureException(err);
      showToast("Netzwerkfehler.", "error");
    } finally {
      setUpdating(null);
      setLieferantWechsel(null);
      load();
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Position aus Bestellliste entfernen?")) return;
    setUpdating(id);
    await fetch(`/api/bestellliste/${id}`, { method: "DELETE" });
    setUpdating(null);
    load();
  }

  // Bündelt alle offenen, noch nicht zugeordneten Positionen eines Lieferanten zu einer
  // formellen Lieferantenbestellung und springt dorthin (Versand/Nachweis passiert dort).
  async function handleBuendeln(lieferantId: number, items: Bestellposition[]) {
    const offeneIds = items.filter((i) => i.status === "offen" && !i.bestellung).map((i) => i.id);
    if (offeneIds.length === 0) return;
    setBuendeln(lieferantId);
    try {
      const res = await fetch("/api/bestellungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferantId, bestellpositionIds: offeneIds }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error ?? "Bestellung konnte nicht erstellt werden.", "error");
        return;
      }
      showToast(`Lieferantenbestellung ${data.nummer} erstellt.`, "success");
      router.push(`/bestellungen/${data.id}`);
    } catch (err) {
      Sentry.captureException(err);
      showToast("Netzwerkfehler.", "error");
    } finally {
      setBuendeln(null);
    }
  }

  // Group by Lieferant
  const grouped = positionen.reduce<Record<number, { lieferant: Bestellposition["lieferant"]; items: Bestellposition[] }>>((acc, p) => {
    if (!acc[p.lieferant.id]) acc[p.lieferant.id] = { lieferant: p.lieferant, items: [] };
    acc[p.lieferant.id].items.push(p);
    return acc;
  }, {});

  const totalOffen = positionen.filter((p) => p.status === "offen").length;
  const totalBestellt = positionen.filter((p) => p.status === "bestellt").length;

  return (
    <div className="max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bestellliste</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {totalOffen > 0 && <span className="text-yellow-700 font-medium">{totalOffen} offen</span>}
            {totalOffen > 0 && totalBestellt > 0 && <span className="text-gray-400"> · </span>}
            {totalBestellt > 0 && <span className="text-blue-700 font-medium">{totalBestellt} bestellt</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => { setFormOffen((v) => !v); setDiktatOffen(false); }}
            className="px-3 py-1.5 text-sm rounded-lg bg-green-700 hover:bg-green-800 text-white font-medium transition-colors"
          >
            {formOffen ? "Abbrechen" : "+ Position hinzufügen"}
          </button>
          <button
            onClick={() => { setDiktatOffen((v) => !v); setFormOffen(false); }}
            className="px-3 py-1.5 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors inline-flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-14 0m7 7v4m-4 0h8M12 1a3 3 0 00-3 3v7a3 3 0 006 0V4a3 3 0 00-3-3z" />
            </svg>
            {diktatOffen ? "Abbrechen" : "Diktieren"}
          </button>
          <div className="flex gap-1">
            {(["offen", "bestellt", "alle"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setStatusFilter(f)}
                className={`px-3 py-1.5 text-sm rounded-lg transition-colors capitalize ${statusFilter === f ? "bg-green-700 text-white" : "bg-gray-100 hover:bg-gray-200 text-gray-700"}`}
              >
                {f === "offen" ? "Offen" : f === "bestellt" ? "Bestellt" : "Alle"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {formOffen && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-3">Position erfassen</p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="relative sm:col-span-2">
              <label className="block text-xs font-medium text-gray-500 mb-1">Artikel</label>
              <input
                type="text"
                value={suchtext}
                onChange={(e) => { setSuchtext(e.target.value); setGewaehlterArtikel(null); }}
                placeholder="Artikelname eingeben…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
              />
              {sucheLaeuft && <div className="text-xs text-gray-400 mt-1">Suche…</div>}
              {treffer.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {treffer.map((a) => (
                    <li key={a.id}>
                      <button
                        onClick={() => waehleArtikel(a)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-green-50 border-b border-gray-50 last:border-0"
                      >
                        <span className="font-medium">{a.name}</span>
                        {a.artikelnummer && <span className="text-gray-400 ml-2 font-mono text-xs">{a.artikelnummer}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Menge</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={neuMenge}
                  onChange={(e) => setNeuMenge(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                />
                <input
                  type="text"
                  value={neuEinheit}
                  onChange={(e) => setNeuEinheit(e.target.value)}
                  placeholder="Einheit"
                  className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notiz (optional)</label>
              <input
                type="text"
                value={neuNotiz}
                onChange={(e) => setNeuNotiz(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
              />
            </div>
            {keinLieferantHinterlegt && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-gray-500 mb-1">Lieferant</label>
                <select
                  value={neuLieferantId}
                  onChange={(e) => setNeuLieferantId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                >
                  <option value="">— Lieferant wählen —</option>
                  {lieferantenListe.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
            )}
          </div>
          {addFehler && <p className="text-xs text-red-600 mt-2">{addFehler}</p>}
          <div className="flex justify-end mt-3">
            <button
              onClick={handleAdd}
              disabled={adding}
              className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {adding ? "Fügt hinzu…" : "Hinzufügen"}
            </button>
          </div>
        </div>
      )}

      {diktatOffen && (
        <div className="mb-6 bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-gray-700 mb-1">Position(en) diktieren</p>
          <p className="text-xs text-gray-500 mb-3">
            Sprich Artikel, Menge und optional Lieferant ein — z.&nbsp;B. „50 Kilo Rindermais bei
            Lieferant Müller, dazu 3 Sack Mineralfutter&quot;. Mehrere Artikel in einem Satz werden
            als eigene Positionen erkannt.
          </p>

          {diktatPositionen.length === 0 && (
            <>
              <AudioRecorder
                onTranscript={handleDiktatTranscript}
                feature="bestellliste"
                maxDurationSec={90}
                placeholder="Aufnahme starten (max. 90 Sek.)"
              />
              {diktatAnalysing && (
                <div className="flex items-center gap-2 mt-3 text-sm text-blue-700">
                  <div className="w-4 h-4 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
                  KI erkennt Positionen…
                </div>
              )}
              {diktatFehler && <p className="text-xs text-red-600 mt-2">{diktatFehler}</p>}
            </>
          )}

          {diktatPositionen.length > 0 && (
            <div className="space-y-3">
              {diktatPositionen.map((pos, idx) => (
                <div key={idx} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{pos.ki.name}</p>
                      <KonfidenzBadge k={pos.konfidenz} />
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDiktatPosition(idx)}
                      className="text-gray-300 hover:text-red-500 transition-colors shrink-0 ml-2"
                      title="Position entfernen"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="block text-xs font-medium text-gray-500 mb-1">Artikel</label>
                      <select
                        value={pos.artikelId}
                        onChange={(e) => updateDiktatPosition(idx, { artikelId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                      >
                        <option value="">— Artikel wählen —</option>
                        {pos.kandidaten.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.name}{a.artikelnummer ? ` (${a.artikelnummer})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Menge</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={pos.menge}
                          onChange={(e) => updateDiktatPosition(idx, { menge: e.target.value })}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                        <input
                          type="text"
                          value={pos.einheit}
                          onChange={(e) => updateDiktatPosition(idx, { einheit: e.target.value })}
                          placeholder="Einheit"
                          className="w-24 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-500 mb-1">Lieferant (optional)</label>
                      <select
                        value={pos.lieferantId}
                        onChange={(e) => updateDiktatPosition(idx, { lieferantId: e.target.value })}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-green-600"
                      >
                        <option value="">— automatisch —</option>
                        {lieferantenListe.map((l) => (
                          <option key={l.id} value={l.id}>{l.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  {pos.fehler && <p className="text-xs text-red-600 mt-2">{pos.fehler}</p>}
                </div>
              ))}

              <div className="flex items-center justify-between gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setDiktatPositionen([])}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Verwerfen, neu aufnehmen
                </button>
                <button
                  onClick={handleDiktatSubmit}
                  disabled={diktatSubmitting || diktatPositionen.every((p) => !p.artikelId)}
                  className="px-4 py-2 text-sm bg-green-700 hover:bg-green-800 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                >
                  {diktatSubmitting
                    ? "Fügt hinzu…"
                    : `${diktatPositionen.filter((p) => p.artikelId).length} Position${diktatPositionen.filter((p) => p.artikelId).length === 1 ? "" : "en"} hinzufügen`}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400 py-8 text-center">Lade…</p>
      ) : positionen.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <p className="text-4xl mb-3">📋</p>
          <p className="text-sm">Keine Bestellpositionen vorhanden.</p>
          <p className="text-xs mt-1">Über &quot;+ Position hinzufügen&quot; erfassen oder entstehen automatisch beim Annehmen eines Angebots.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(grouped).map(({ lieferant, items }) => {
            const gesamtWert = items.reduce((s, i) => s + i.menge * i.einkaufspreis, 0);
            const offenUnbestellt = items.filter((i) => i.status === "offen" && !i.bestellung);
            const mbw = lieferant.mindestbestellwert;
            const mbwErreicht = mbw > 0 && gesamtWert >= mbw;
            const mbwFehlt = mbw > 0 && gesamtWert < mbw;
            return (
              <div key={lieferant.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                {/* Lieferant Header */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <Link href={`/lieferanten/${lieferant.id}`} className="font-semibold text-gray-900 hover:text-green-700">
                      {lieferant.name}
                    </Link>
                    <div className="flex flex-wrap gap-3 text-xs text-gray-500 mt-0.5">
                      {lieferant.telefon && <span>📞 {lieferant.telefon}</span>}
                      {lieferant.email && <a href={`mailto:${lieferant.email}`} className="hover:text-green-700">✉️ {lieferant.email}</a>}
                      {lieferant.frachtkosten > 0 && (
                        <span className="text-gray-600">🚚 Fracht: {formatEuro(lieferant.frachtkosten)}</span>
                      )}
                      {mbw > 0 && (
                        <span className={mbwErreicht ? "text-green-700 font-medium" : "text-amber-600 font-medium"}>
                          {mbwErreicht ? "✓" : "!"} MBW: {formatEuro(mbw)}
                          {mbwFehlt && <span className="ml-1 text-gray-400 font-normal">(noch {formatEuro(mbw - gesamtWert)})</span>}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className={`text-sm font-semibold ${mbwErreicht ? "text-green-700" : mbwFehlt ? "text-amber-700" : "text-gray-700"}`}>
                        {formatEuro(gesamtWert)}
                      </div>
                      <div className="text-xs text-gray-400">{items.length} Position{items.length !== 1 ? "en" : ""}</div>
                    </div>
                    {offenUnbestellt.length > 0 && (
                      <button
                        onClick={() => handleBuendeln(lieferant.id, items)}
                        disabled={buendeln === lieferant.id}
                        className="text-xs px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
                        title="Bündelt alle offenen Positionen zu einer Lieferantenbestellung"
                      >
                        {buendeln === lieferant.id ? "Erstellt…" : `${offenUnbestellt.length} zu Bestellung bündeln`}
                      </button>
                    )}
                  </div>
                </div>

                {/* Positionen */}
                <div className="divide-y divide-gray-100">
                  {items.map((pos) => {
                    const sc = STATUS_CONFIG[pos.status] ?? STATUS_CONFIG.offen;
                    const isUpdating = updating === pos.id;
                    const lagerRelevant = !LAGER_KATEGORIEN_OHNE.includes(pos.artikel.kategorie);
                    const gebuendelt = !!pos.bestellung;
                    return (
                      <div key={pos.id} className={`px-5 py-3 flex gap-3 items-start ${isUpdating ? "opacity-50" : ""}`}>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>{sc.label}</span>
                            <Link href={`/artikel/${pos.artikel.id}`} className="font-medium text-gray-900 hover:text-green-700 text-sm">
                              {pos.artikel.name}
                            </Link>
                            <Link
                              href={`/artikel/${pos.artikel.id}?tab=kunden`}
                              className="text-gray-400 hover:text-green-700"
                              title="Wer hat/bekommt diesen Artikel?"
                            >
                              👥
                            </Link>
                            <span className="text-xs text-gray-400 font-mono">{pos.artikel.artikelnummer}</span>
                            {lagerRelevant && (
                              pos.artikel.aktuellerBestand <= 0
                                ? <span className="text-xs text-red-600 font-medium">● Kein Lager</span>
                                : pos.artikel.aktuellerBestand < pos.menge
                                ? <span className="text-xs text-amber-600 font-medium">● {pos.artikel.aktuellerBestand} {pos.artikel.einheit} (Lager)</span>
                                : <span className="text-xs text-green-600">● {pos.artikel.aktuellerBestand} {pos.artikel.einheit}</span>
                            )}
                            {lagerRelevant && pos.artikel.lagerort && (
                              <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{pos.artikel.lagerort}</span>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap gap-4 text-xs text-gray-500">
                            <span className="font-medium text-gray-700">{pos.menge} {pos.einheit}</span>
                            {pos.einkaufspreis > 0 && (
                              <span>{formatEuro(pos.menge * pos.einkaufspreis)} ({formatEuro(pos.einkaufspreis)}/{pos.einheit})</span>
                            )}
                            {pos.kunde && (
                              <Link href={`/kunden/${pos.kunde.id}`} className="hover:text-green-700">
                                Für: {pos.kunde.firma || pos.kunde.name}
                              </Link>
                            )}
                            {pos.lieferung && (
                              <Link href={`/lieferungen/${pos.lieferung.id}`} className="hover:text-green-700">
                                Lieferung #{pos.lieferung.id}
                              </Link>
                            )}
                            {pos.bestellung && (
                              <Link href={`/bestellungen/${pos.bestellung.id}`} className="text-blue-600 hover:underline font-medium">
                                → {pos.bestellung.nummer}
                              </Link>
                            )}
                          </div>
                          {pos.bestelltAm && (
                            <p className="text-xs text-blue-600 mt-0.5">Bestellt: {new Date(pos.bestelltAm).toLocaleDateString("de-DE")}</p>
                          )}
                          {pos.geliefertAm && (
                            <p className="text-xs text-green-600 mt-0.5">Geliefert: {new Date(pos.geliefertAm).toLocaleDateString("de-DE")}</p>
                          )}
                          {pos.notiz && <p className="text-xs text-gray-500 mt-0.5 italic">{pos.notiz}</p>}
                          {!gebuendelt && lieferantWechsel === pos.id && (
                            <div className="mt-1.5 flex items-center gap-1.5">
                              <select
                                autoFocus
                                defaultValue=""
                                onChange={(e) => e.target.value && handleLieferantWechseln(pos.id, Number(e.target.value))}
                                className="text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-green-600"
                              >
                                <option value="" disabled>— anderer Lieferant —</option>
                                {lieferantenListe.filter((l) => l.id !== pos.lieferant.id).map((l) => (
                                  <option key={l.id} value={l.id}>{l.name}</option>
                                ))}
                              </select>
                              <button onClick={() => setLieferantWechsel(null)} className="text-xs text-gray-400 hover:text-gray-600">Abbrechen</button>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 items-end shrink-0">
                          {!gebuendelt && pos.status === "offen" && (
                            <button
                              onClick={() => setLieferantWechsel(lieferantWechsel === pos.id ? null : pos.id)}
                              disabled={isUpdating}
                              className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-40"
                            >
                              Lieferant ändern
                            </button>
                          )}
                          {!gebuendelt && pos.status === "offen" && (
                            <button
                              onClick={() => updateStatus(pos.id, "bestellt")}
                              disabled={isUpdating}
                              className="text-xs px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                              title="Nur Status setzen, ohne formelle Lieferantenbestellung"
                            >
                              Bestellen
                            </button>
                          )}
                          {pos.status === "bestellt" && (
                            <button
                              onClick={() => updateStatus(pos.id, "geliefert")}
                              disabled={isUpdating}
                              className="text-xs px-2.5 py-1 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg font-medium transition-colors disabled:opacity-40"
                            >
                              Erhalten
                            </button>
                          )}
                          {!gebuendelt && pos.status !== "geliefert" && pos.status !== "storniert" && (
                            <button
                              onClick={() => updateStatus(pos.id, "offen")}
                              disabled={isUpdating || pos.status === "offen"}
                              className="text-xs text-gray-400 hover:text-gray-600 disabled:opacity-30"
                            >
                              Zurücksetzen
                            </button>
                          )}
                          {!gebuendelt && (
                            <button
                              onClick={() => handleDelete(pos.id)}
                              disabled={isUpdating}
                              className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40"
                            >
                              Entfernen
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
