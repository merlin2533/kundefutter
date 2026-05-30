"use client";
import { useEffect, useState, Suspense, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Artikel {
  id: number;
  name: string;
  artikelnummer: string | null;
  einheit: string;
  standardpreis: number;
}

interface KampagneArtikel {
  artikelId: string;
  sonderpreis: string;
}

interface Kunde {
  id: number;
  name: string;
  firma: string | null;
  ort: string | null;
  kategorie: string;
}

interface ZielgruppeKriterien {
  ort: string;
  plz: string;
  kategorie: string;
  tag: string;
  bedarfArtikelId: string;
  letzteKaufMonate: string;
}

function KampagneNeuInner() {
  const router = useRouter();
  const [artikel, setArtikel] = useState<Artikel[]>([]);
  const [alleKunden, setAlleKunden] = useState<Kunde[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const [name, setName] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [von, setVon] = useState(today);
  const [bis, setBis] = useState("");
  const [rabattProzent, setRabattProzent] = useState("");
  const [kampagneArtikel, setKampagneArtikel] = useState<KampagneArtikel[]>([]);

  // Zielgruppe state
  const [kriterien, setKriterien] = useState<ZielgruppeKriterien>({
    ort: "", plz: "", kategorie: "", tag: "", bedarfArtikelId: "", letzteKaufMonate: "",
  });
  const [selectedKunden, setSelectedKunden] = useState<Kunde[]>([]);
  const [suchvorschau, setSuchvorschau] = useState<Kunde[]>([]);
  const [loadingVorschau, setLoadingVorschau] = useState(false);
  const [manuellerKundeId, setManuellerKundeId] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/artikel?limit=500").then((r) => r.json()).catch(() => []),
      fetch("/api/kunden?aktiv=true&limit=1000&kontakte=false").then((r) => r.json()).catch(() => []),
    ]).then(([artData, kundenData]) => {
      setArtikel(Array.isArray(artData) ? artData : []);
      setAlleKunden(Array.isArray(kundenData) ? kundenData : []);
    });
  }, []);

  const artikelOptions = artikel.map((a) => ({
    value: a.id,
    label: a.name,
    sub: [a.artikelnummer, a.einheit].filter(Boolean).join(" · "),
  }));

  const kundenOptions = alleKunden
    .filter((k) => !selectedKunden.some((s) => s.id === k.id))
    .map((k) => ({
      value: k.id,
      label: k.firma ? `${k.firma} (${k.name})` : k.name,
      sub: k.ort ?? undefined,
    }));

  const suchematchKunden = useCallback(() => {
    setLoadingVorschau(true);
    const params = new URLSearchParams({ aktiv: "true", limit: "200", kontakte: "false" });
    if (kriterien.ort) params.set("ort", kriterien.ort);
    if (kriterien.plz) params.set("plz", kriterien.plz);
    if (kriterien.kategorie) params.set("kategorie", kriterien.kategorie);
    if (kriterien.tag) params.set("tag", kriterien.tag);

    fetch(`/api/kunden?${params}`)
      .then((r) => r.ok ? r.json() : [])
      .then((data: Kunde[]) => {
        let results: Kunde[] = Array.isArray(data) ? data : [];
        // letzteKaufMonate filter is client-side approximation for preview
        setSuchvorschau(results.filter((k) => !selectedKunden.some((s) => s.id === k.id)));
      })
      .catch(() => setSuchvorschau([]))
      .finally(() => setLoadingVorschau(false));
  }, [kriterien, selectedKunden]);

  function alleAusKriterienHinzufuegen() {
    const neu = suchvorschau.filter((k) => !selectedKunden.some((s) => s.id === k.id));
    setSelectedKunden((prev) => [...prev, ...neu]);
    setSuchvorschau([]);
  }

  function kundeAusVorschauHinzufuegen(kunde: Kunde) {
    setSelectedKunden((prev) => [...prev, kunde]);
    setSuchvorschau((prev) => prev.filter((k) => k.id !== kunde.id));
  }

  function manuellenKundeHinzufuegen(idStr: string) {
    const id = parseInt(idStr, 10);
    if (isNaN(id)) return;
    const kunde = alleKunden.find((k) => k.id === id);
    if (!kunde || selectedKunden.some((s) => s.id === id)) return;
    setSelectedKunden((prev) => [...prev, kunde]);
    setManuellerKundeId("");
  }

  function kundeEntfernen(id: number) {
    setSelectedKunden((prev) => prev.filter((k) => k.id !== id));
  }

  function addArtikel() {
    setKampagneArtikel((prev) => [...prev, { artikelId: "", sonderpreis: "" }]);
  }

  function removeArtikel(index: number) {
    setKampagneArtikel((prev) => prev.filter((_, i) => i !== index));
  }

  function updateArtikel(index: number, field: keyof KampagneArtikel, value: string) {
    setKampagneArtikel((prev) => {
      const updated = [...prev];
      if (field === "artikelId") {
        const art = artikel.find((a) => String(a.id) === value);
        updated[index] = {
          ...updated[index],
          artikelId: value,
          sonderpreis: art ? String(art.standardpreis) : updated[index].sonderpreis,
        };
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name ist erforderlich."); return; }
    if (!von || !bis) { setError("Gültigkeitszeitraum erforderlich."); return; }
    setSaving(true);
    setError("");
    try {
      const validArtikel = kampagneArtikel.filter((a) => a.artikelId);
      const kriterienObj = Object.values(kriterien).some((v) => v)
        ? Object.fromEntries(Object.entries(kriterien).filter(([, v]) => v))
        : null;

      const res = await fetch("/api/kampagnen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          beschreibung: beschreibung.trim() || null,
          von,
          bis,
          rabattProzent: rabattProzent ? parseFloat(rabattProzent) : null,
          zielgruppeKriterien: kriterienObj,
          artikel: validArtikel.map((a) => ({
            artikelId: parseInt(a.artikelId, 10),
            sonderpreis: a.sonderpreis ? parseFloat(a.sonderpreis) : null,
          })),
          kunden: selectedKunden.map((k) => ({ kundeId: k.id })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/kampagnen/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  const KATEGORIEN = ["Landwirt", "Händler", "Genossenschaft", "Lohnunternehmer", "Sonstige"];

  return (
    <div className="max-w-3xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/kampagnen" className="hover:text-green-700">Kampagnen</Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Kampagne</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">Neue Kampagne erstellen</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Kampagnendaten */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Kampagnendaten</h2>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="z.B. Frühjahrsangebot 2025"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Beschreibung (optional)</label>
            <textarea
              value={beschreibung}
              onChange={(e) => setBeschreibung(e.target.value)}
              rows={2}
              placeholder="Kurze Beschreibung der Kampagne…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Von <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={von}
                onChange={(e) => setVon(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Bis <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={bis}
                onChange={(e) => setBis(e.target.value)}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Rabatt % (optional)</label>
              <input
                type="number"
                step="0.1"
                min="0"
                max="100"
                value={rabattProzent}
                onChange={(e) => setRabattProzent(e.target.value)}
                placeholder="z.B. 5"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
          </div>
        </div>

        {/* Artikel */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-gray-900">Artikel (optional)</h2>
            <button
              type="button"
              onClick={addArtikel}
              className="text-xs px-3 py-1.5 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded-lg transition-colors"
            >
              + Artikel hinzufügen
            </button>
          </div>

          {kampagneArtikel.length === 0 ? (
            <p className="text-sm text-gray-400">Keine Artikel zugeordnet — der Rabatt gilt dann allgemein.</p>
          ) : (
            <div className="space-y-3">
              {kampagneArtikel.map((a, i) => (
                <div key={i} className="flex items-end gap-3 border border-gray-200 rounded-lg p-3">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Artikel</label>
                    <SearchableSelect
                      options={artikelOptions}
                      value={a.artikelId}
                      onChange={(v) => updateArtikel(i, "artikelId", v)}
                      placeholder="Artikel wählen…"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Sonderpreis (€)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={a.sonderpreis}
                      onChange={(e) => updateArtikel(i, "sonderpreis", e.target.value)}
                      placeholder="optional"
                      className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeArtikel(i)}
                    className="text-xs text-red-500 hover:text-red-700 pb-1.5"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Zielgruppe */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
          <h2 className="text-base font-semibold text-gray-900">Zielgruppe (Kunden)</h2>
          <p className="text-xs text-gray-500">Kunden nach Kriterien suchen oder manuell hinzufügen.</p>

          {/* Criteria filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pb-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Ort</label>
              <input
                type="text"
                value={kriterien.ort}
                onChange={(e) => setKriterien({ ...kriterien, ort: e.target.value })}
                placeholder="z.B. Münster"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">PLZ</label>
              <input
                type="text"
                value={kriterien.plz}
                onChange={(e) => setKriterien({ ...kriterien, plz: e.target.value })}
                placeholder="z.B. 48"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Kategorie</label>
              <select
                value={kriterien.kategorie}
                onChange={(e) => setKriterien({ ...kriterien, kategorie: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-600"
              >
                <option value="">Alle</option>
                {KATEGORIEN.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Tag</label>
              <input
                type="text"
                value={kriterien.tag}
                onChange={(e) => setKriterien({ ...kriterien, tag: e.target.value })}
                placeholder="z.B. vip"
                className="w-full border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Bedarf-Artikel</label>
              <SearchableSelect
                options={artikelOptions}
                value={kriterien.bedarfArtikelId}
                onChange={(v) => setKriterien({ ...kriterien, bedarfArtikelId: v })}
                placeholder="Beliebig"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={suchematchKunden}
                disabled={loadingVorschau}
                className="w-full px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {loadingVorschau ? "Suche…" : "Kunden suchen"}
              </button>
            </div>
          </div>

          {/* Search preview */}
          {suchvorschau.length > 0 && (
            <div className="border border-blue-200 rounded-lg bg-blue-50 p-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-medium text-blue-800">{suchvorschau.length} Kunden gefunden</p>
                <button
                  type="button"
                  onClick={alleAusKriterienHinzufuegen}
                  className="text-xs px-2 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Alle hinzufügen
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {suchvorschau.map((k) => (
                  <div key={k.id} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border border-blue-100">
                    <span className="text-gray-800">{k.firma ? `${k.firma} (${k.name})` : k.name} {k.ort && <span className="text-gray-400">— {k.ort}</span>}</span>
                    <button
                      type="button"
                      onClick={() => kundeAusVorschauHinzufuegen(k)}
                      className="text-green-700 hover:text-green-900 font-medium ml-2 shrink-0"
                    >
                      +
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual add */}
          <div className="flex gap-2 items-end pt-1">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Kunde manuell hinzufügen</label>
              <SearchableSelect
                options={kundenOptions}
                value={manuellerKundeId}
                onChange={(v) => setManuellerKundeId(v)}
                placeholder="Kunde suchen…"
              />
            </div>
            <button
              type="button"
              onClick={() => manuellenKundeHinzufuegen(manuellerKundeId)}
              disabled={!manuellerKundeId}
              className="px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
            >
              Hinzufügen
            </button>
          </div>

          {/* Selected customers */}
          {selectedKunden.length > 0 ? (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-3 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                <span className="text-xs font-medium text-gray-700">{selectedKunden.length} Kunden ausgewählt</span>
                <button
                  type="button"
                  onClick={() => setSelectedKunden([])}
                  className="text-xs text-red-500 hover:text-red-700"
                >
                  Alle entfernen
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto divide-y divide-gray-100">
                {selectedKunden.map((k) => (
                  <div key={k.id} className="flex items-center justify-between px-3 py-2 text-sm hover:bg-gray-50">
                    <span className="text-gray-800">{k.firma ? `${k.firma} (${k.name})` : k.name}
                      {k.ort && <span className="text-gray-400 text-xs ml-1">— {k.ort}</span>}
                    </span>
                    <button
                      type="button"
                      onClick={() => kundeEntfernen(k.id)}
                      className="text-red-400 hover:text-red-600 text-xs ml-2 shrink-0"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Noch keine Kunden ausgewählt.</p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end">
          <Link
            href="/kampagnen"
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Kampagne speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function KampagneNeuPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <KampagneNeuInner />
    </Suspense>
  );
}
