"use client";
import { useEffect, useRef, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import SearchableSelect from "@/components/SearchableSelect";

interface Lieferant {
  id: number;
  name: string;
  firma: string | null;
}

function EingangsrechnungNeuInner() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const kiFileInputRef = useRef<HTMLInputElement>(null);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [zugferdLoading, setZugferdLoading] = useState(false);
  const [zugferdHint, setZugferdHint] = useState("");
  const [kiLoading, setKiLoading] = useState(false);
  const [kiHint, setKiHint] = useState("");
  const [erkannteIban, setErkannteIban] = useState<{ iban: string; bic: string | null; lieferantId: string } | null>(null);
  const [ibanSaved, setIbanSaved] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const [lieferantId, setLieferantId] = useState("");
  const [nummer, setNummer] = useState("");
  const [datum, setDatum] = useState(today);
  const [faelligAm, setFaelligAm] = useState("");
  const [betrag, setBetrag] = useState("");
  const [mwst, setMwst] = useState("19");
  const [notiz, setNotiz] = useState("");

  useEffect(() => {
    fetch("/api/lieferanten?limit=500")
      .then((r) => r.json())
      .then((d) => setLieferanten(Array.isArray(d) ? d : []))
      .catch(() => {});
  }, []);

  const lieferantenOptions = lieferanten.map((l) => ({
    value: l.id,
    label: l.firma ?? l.name,
    sub: l.firma ? l.name : undefined,
  }));

  const bruttoValue =
    betrag && mwst
      ? (parseFloat(betrag) * (1 + parseFloat(mwst) / 100)).toLocaleString("de-DE", {
          style: "currency",
          currency: "EUR",
        })
      : null;

  async function handleZugferdUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setZugferdLoading(true);
    setZugferdHint("");
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/eingangsrechnungen/zugferd-import", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "ZUGFeRD-Import fehlgeschlagen");
        return;
      }

      // Felder vorbelegen
      if (data.rechnungNummer) setNummer(data.rechnungNummer);
      if (data.datum) setDatum(data.datum);
      if (data.faelligAm) setFaelligAm(data.faelligAm);
      if (data.betragNetto != null) setBetrag(String(data.betragNetto.toFixed(2)));
      if (data.mwstSatz != null) setMwst(String(data.mwstSatz));

      // Lieferanten-Matchversuch über Namen
      let matchHint = "";
      let matchedId = "";
      if (data.lieferantName) {
        const nameLower = data.lieferantName.toLowerCase();
        const match = lieferanten.find(
          (l) =>
            (l.firma ?? l.name).toLowerCase().includes(nameLower) ||
            nameLower.includes((l.firma ?? l.name).toLowerCase())
        );
        if (match) {
          setLieferantId(String(match.id));
          matchedId = String(match.id);
          matchHint = `Lieferant automatisch erkannt: ${match.firma ?? match.name}`;
        } else {
          matchHint = `Lieferant laut Rechnung: „${data.lieferantName}" — bitte manuell zuordnen.`;
        }
      }

      // IBAN/BIC merken für Angebot zum Speichern
      setErkannteIban(null);
      setIbanSaved(false);
      if (data.iban && matchedId) {
        setErkannteIban({ iban: data.iban, bic: data.bic ?? null, lieferantId: matchedId });
      }

      const parts: string[] = [];
      if (data.rechnungNummer) parts.push(`Nr. ${data.rechnungNummer}`);
      if (data.betragBrutto != null)
        parts.push(
          `Brutto ${data.betragBrutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`
        );
      if (data.iban) parts.push(`IBAN: ${data.iban.replace(/(.{4})/g, "$1 ").trim()}`);
      setZugferdHint(
        [matchHint, parts.length ? `Erkannte Daten: ${parts.join(", ")}` : ""].filter(Boolean).join(" — ")
      );
    } catch {
      setError("Fehler beim Lesen der Datei");
    } finally {
      setZugferdLoading(false);
      // Input zurücksetzen damit dieselbe Datei nochmals gewählt werden kann
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleKiUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setKiLoading(true);
    setKiHint("");
    setError("");

    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/ki/beleg", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        setKiHint("KI-Fehler: " + (data.error ?? "Unbekannt"));
        return;
      }

      if (data.datum) setDatum(data.datum);
      if (data.belegNr) setNummer(data.belegNr);
      if (data.faelligAm) setFaelligAm(data.faelligAm);
      if (data.betragNetto != null) setBetrag(String(data.betragNetto.toFixed(2)));
      if (data.mwstSatz != null) setMwst(String(data.mwstSatz));
      if (data.beschreibung) setNotiz((prev) => prev || data.beschreibung);

      let matchHint = "";
      let matchedIdKi = "";
      if (data.lieferant) {
        const nameLower = data.lieferant.toLowerCase();
        const match = lieferanten.find(
          (l) =>
            (l.firma ?? l.name).toLowerCase().includes(nameLower) ||
            nameLower.includes((l.firma ?? l.name).toLowerCase())
        );
        if (match) {
          setLieferantId(String(match.id));
          matchedIdKi = String(match.id);
          matchHint = `Lieferant erkannt: ${match.firma ?? match.name}`;
        } else {
          matchHint = `Lieferant laut Rechnung: „${data.lieferant}" — bitte manuell zuordnen.`;
        }
      }

      // IBAN/BIC merken
      setErkannteIban(null);
      setIbanSaved(false);
      if (data.iban && matchedIdKi) {
        setErkannteIban({ iban: data.iban, bic: data.bic ?? null, lieferantId: matchedIdKi });
      }

      const parts: string[] = [];
      if (data.belegNr) parts.push(`Nr. ${data.belegNr}`);
      if (data.betragBrutto != null)
        parts.push(
          `Brutto ${data.betragBrutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`
        );
      if (data.faelligAm)
        parts.push(`Fällig ${new Date(data.faelligAm + "T00:00:00").toLocaleDateString("de-DE")}`);
      if (data.iban) parts.push(`IBAN: ${data.iban.replace(/(.{4})/g, "$1 ").trim()}`);

      setKiHint(
        [matchHint, parts.length ? `Erkannte Daten: ${parts.join(", ")}` : ""].filter(Boolean).join(" — ")
      );
    } catch {
      setKiHint("Fehler beim Lesen der Datei");
    } finally {
      setKiLoading(false);
      if (kiFileInputRef.current) kiFileInputRef.current.value = "";
    }
  }

  async function handleIbanSpeichern() {
    if (!erkannteIban) return;
    try {
      await fetch(`/api/lieferanten/${erkannteIban.lieferantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ iban: erkannteIban.iban, bic: erkannteIban.bic }),
      });
      setIbanSaved(true);
    } catch { /* ignore */ }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!lieferantId) {
      setError("Bitte einen Lieferanten wählen.");
      return;
    }
    if (!nummer.trim()) {
      setError("Rechnungsnummer ist erforderlich.");
      return;
    }
    if (!betrag || parseFloat(betrag) < 0) {
      setError("Betrag ist erforderlich.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/eingangsrechnungen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lieferantId: parseInt(lieferantId, 10),
          nummer: nummer.trim(),
          datum,
          faelligAm: faelligAm || null,
          betrag: parseFloat(betrag),
          mwst: parseFloat(mwst),
          notiz: notiz.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Fehler beim Speichern");
      router.push(`/eingangsrechnungen/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unbekannter Fehler");
      setSaving(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <nav className="flex items-center gap-2 text-sm text-gray-500 mb-6">
        <Link href="/eingangsrechnungen" className="hover:text-green-700">
          Eingangsrechnungen
        </Link>
        <span>›</span>
        <span className="text-gray-900 font-medium">Neue Eingangsrechnung</span>
      </nav>

      <h1 className="text-2xl font-bold text-gray-900 mb-6">
        Neue Eingangsrechnung erfassen
      </h1>

      {/* ZUGFeRD-Import */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 text-blue-600 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-900 mb-1">
              ZUGFeRD / Factur-X automatisch einlesen
            </p>
            <p className="text-xs text-blue-700 mb-3">
              XML- oder PDF-Datei hochladen — Felder werden automatisch vorausgefüllt.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.pdf,application/xml,text/xml,application/pdf"
              onChange={handleZugferdUpload}
              className="hidden"
              id="zugferd-upload"
            />
            <label
              htmlFor="zugferd-upload"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                ${zugferdLoading
                  ? "bg-blue-200 text-blue-500 cursor-not-allowed"
                  : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
            >
              {zugferdLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Wird gelesen…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  ZUGFeRD-Datei hochladen
                </>
              )}
            </label>
            {zugferdHint && (
              <p className="mt-2 text-xs text-blue-800 bg-blue-100 rounded-lg px-3 py-2">
                {zugferdHint}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* KI-Erkennung */}
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <div className="flex items-start gap-3">
          <div className="shrink-0 text-green-700 mt-0.5">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-green-900 mb-1">
              KI-Erkennung — PDF oder Foto hochladen
            </p>
            <p className="text-xs text-green-700 mb-3">
              Beliebige Rechnung als PDF, JPG oder PNG hochladen — KI erkennt automatisch alle Felder.
            </p>
            <input
              ref={kiFileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              onChange={handleKiUpload}
              className="hidden"
              id="ki-upload"
            />
            <label
              htmlFor="ki-upload"
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-colors
                ${kiLoading
                  ? "bg-green-200 text-green-500 cursor-not-allowed"
                  : "bg-green-700 text-white hover:bg-green-800"
                }`}
            >
              {kiLoading ? (
                <>
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  KI analysiert…
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  Datei hochladen
                </>
              )}
            </label>
            {kiHint && (
              <p className="mt-2 text-xs text-green-800 bg-green-100 rounded-lg px-3 py-2">
                {kiHint}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* IBAN-Erkennungs-Banner */}
      {erkannteIban && !ibanSaved && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-3">
          <svg className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
            <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
            <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1zm5-1a1 1 0 100 2h1a1 1 0 100-2H9z" clipRule="evenodd" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-900">IBAN erkannt</p>
            <p className="text-xs text-amber-700 mt-0.5 font-mono">
              {erkannteIban.iban.replace(/(.{4})/g, "$1 ").trim()}
              {erkannteIban.bic && ` · ${erkannteIban.bic}`}
            </p>
            <p className="text-xs text-amber-600 mt-1">
              Soll diese IBAN beim Lieferanten gespeichert werden?
            </p>
          </div>
          <button
            type="button"
            onClick={handleIbanSpeichern}
            className="shrink-0 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium rounded-lg transition-colors"
          >
            IBAN speichern
          </button>
        </div>
      )}
      {erkannteIban && ibanSaved && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-sm text-green-800">
          IBAN beim Lieferanten gespeichert.
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 space-y-4">
        {error && (
          <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Lieferant <span className="text-red-500">*</span>
          </label>
          <SearchableSelect
            options={lieferantenOptions}
            value={lieferantId}
            onChange={setLieferantId}
            placeholder="Lieferant wählen…"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Rechnungsnummer <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={nummer}
            onChange={(e) => setNummer(e.target.value)}
            required
            placeholder="z.B. RE-2025-12345"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechnungsdatum
            </label>
            <input
              type="date"
              value={datum}
              onChange={(e) => setDatum(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Fällig am
            </label>
            <input
              type="date"
              value={faelligAm}
              onChange={(e) => setFaelligAm(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Betrag (netto) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={betrag}
              onChange={(e) => setBetrag(e.target.value)}
              required
              placeholder="0,00"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            />
            {bruttoValue && (
              <p className="text-xs text-gray-500 mt-1">Brutto: {bruttoValue}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">MwSt. %</label>
            <select
              value={mwst}
              onChange={(e) => setMwst(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600"
            >
              <option value="0">0%</option>
              <option value="7">7%</option>
              <option value="19">19%</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Notiz (optional)
          </label>
          <textarea
            value={notiz}
            onChange={(e) => setNotiz(e.target.value)}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-600 resize-none"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row gap-3 sm:justify-end pt-2">
          <Link
            href="/eingangsrechnungen"
            className="w-full sm:w-auto text-center px-5 py-2 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Abbrechen
          </Link>
          <button
            type="submit"
            disabled={saving}
            className="w-full sm:w-auto px-5 py-2 bg-green-700 text-white text-sm font-medium rounded-lg hover:bg-green-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Speichere…" : "Eingangsrechnung speichern"}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function EingangsrechnungNeuPage() {
  return (
    <Suspense fallback={<div className="text-center py-16 text-gray-400">Lade…</div>}>
      <EingangsrechnungNeuInner />
    </Suspense>
  );
}
