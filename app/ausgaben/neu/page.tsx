"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CameraUpload from "@/components/CameraUpload";
import { BUCHUNGSTYPEN, ZAHLUNGSWEGE, BUCHUNGSTYP_KONTEN_SKR03, SACHKONTEN_SKR03, KILOMETERPAUSCHALE_EUR, type Buchungstyp } from "@/lib/datev";

const FALLBACK_AUSGABEN_KAT = ["Wareneinkauf", "Betriebsbedarf", "Fahrtkosten", "Bürobedarf", "Telefon/Internet", "Versicherung", "Miete", "Personal", "Sonstige"];

interface Lieferant {
  id: number;
  name: string;
}

export default function NeueAusgabePage() {
  const router = useRouter();
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [kategorienList, setKategorienList] = useState<string[]>(FALLBACK_AUSGABEN_KAT);
  const [kostenstellenList, setKostenstellenList] = useState<string[]>([]);
  const [sachkontoMap, setSachkontoMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState("");
  const [loginUser, setLoginUser] = useState("");

  const heute = new Date().toISOString().slice(0, 10);
  const [datum, setDatum] = useState(heute);
  const [belegNr, setBelegNr] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [betragNetto, setBetragNetto] = useState("");
  const [mwstSatz, setMwstSatz] = useState("19");
  const [kategorie, setKategorie] = useState("Sonstige");
  const [lieferantId, setLieferantId] = useState("");
  const [bezahltHeute, setBezahltHeute] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [privaterAusleger, setPrivaterAusleger] = useState(false);
  const [ausleger, setAusleger] = useState("");
  const [erfasstVon, setErfasstVon] = useState("");

  // DATEV-Felder
  const [buchungstyp, setBuchungstyp] = useState("Betriebsausgabe");
  const [zahlungsweg, setZahlungsweg] = useState("");
  const [sachkonto, setSachkonto] = useState("");
  const sachkontoManual = useRef(false);
  const [kostenstelle, setKostenstelle] = useState("");
  // Reisekosten
  const [reiseZiel, setReiseZiel] = useState("");
  const [reiseKm, setReiseKm] = useState("");
  const [reiseKilometerpauschale, setReiseKilometerpauschale] = useState(false);
  const [reiseZweck, setReiseZweck] = useState("");
  // Bewirtung
  const [bewirtungTeilnehmer, setBewirtungTeilnehmer] = useState("");
  const [bewirtungZweck, setBewirtungZweck] = useState("");

  // Beleg upload state
  const [belegFile, setBelegFile] = useState<File | null>(null);
  const [belegPreview, setBelegPreview] = useState<string>("");
  const [belegName, setBelegName] = useState<string>("");
  const [kiLaeding, setKiLaeding] = useState(false);
  const [kiHinweis, setKiHinweis] = useState("");

  useEffect(() => {
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => {
      if (d?.benutzername) { setLoginUser(d.benutzername); setErfasstVon(d.benutzername); }
    }).catch(() => {});
    fetch("/api/lieferanten").then(r => r.ok ? r.json() : []).then(d => setLieferanten(Array.isArray(d) ? d : []));
    fetch("/api/einstellungen?prefix=ausgaben.")
      .then((r) => r.json())
      .then((d) => {
        if (d["ausgaben.kategorien"]) {
          try {
            const parsed = JSON.parse(d["ausgaben.kategorien"]);
            if (Array.isArray(parsed) && parsed.length) setKategorienList(parsed);
          } catch { /* ignore */ }
        }
        if (d["ausgaben.kostenstellen"]) {
          try { setKostenstellenList(JSON.parse(d["ausgaben.kostenstellen"]) ?? []); } catch { /* ignore */ }
        }
        if (d["ausgaben.sachkonten"]) {
          try { setSachkontoMap(JSON.parse(d["ausgaben.sachkonten"]) ?? {}); } catch { /* ignore */ }
        }
      })
      .catch(() => {});
  }, []);

  // Auto-suggest Sachkonto wenn Buchungstyp oder Kategorie wechselt
  useEffect(() => {
    if (sachkontoManual.current) return;
    const typeOverride = BUCHUNGSTYP_KONTEN_SKR03[buchungstyp as Buchungstyp];
    setSachkonto(typeOverride ?? sachkontoMap[kategorie] ?? SACHKONTEN_SKR03[kategorie] ?? "");
  }, [buchungstyp, kategorie, sachkontoMap]);

  // Kilometerpauschale: betrag auto berechnen
  useEffect(() => {
    if (buchungstyp === "Reisekosten" && reiseKilometerpauschale && reiseKm) {
      const km = parseFloat(reiseKm);
      if (!isNaN(km)) setBetragNetto((km * KILOMETERPAUSCHALE_EUR).toFixed(2));
    }
  }, [buchungstyp, reiseKilometerpauschale, reiseKm]);

  // Privatentnahme/einlage: MwSt auf 0 setzen
  useEffect(() => {
    if (buchungstyp === "Privatentnahme" || buchungstyp === "Privateinlage") {
      setMwstSatz("0");
    }
  }, [buchungstyp]);

  const isPrivat = buchungstyp === "Privatentnahme" || buchungstyp === "Privateinlage";
  const netto = parseFloat(betragNetto) || 0;
  const mwstBetrag = netto * (parseFloat(mwstSatz) / 100);
  const brutto = netto + mwstBetrag;

  function handleBelegSelected(file: File, preview: string) {
    setBelegFile(file);
    setBelegPreview(preview);
    setBelegName(file.name);
    setKiHinweis("");
  }

  async function kiAnalyse() {
    if (!belegPreview) return;
    setKiLaeding(true);
    setKiHinweis("");
    try {
      const res = await fetch("/api/ki/beleg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: belegPreview }),
      });
      if (!res.ok) {
        const d = await res.json();
        setKiHinweis("KI-Fehler: " + (d.error ?? "Unbekannt"));
        return;
      }
      const d = await res.json();
      if (d.datum) setDatum(d.datum);
      if (d.belegNr) setBelegNr(d.belegNr);
      if (d.beschreibung) setBeschreibung(d.beschreibung);
      if (d.betragNetto !== null && d.betragNetto !== undefined) setBetragNetto(String(d.betragNetto));
      if (d.mwstSatz !== undefined) setMwstSatz(String(d.mwstSatz));
      if (d.kategorie) setKategorie(d.kategorie);
      setKiHinweis("Felder wurden automatisch ausgefüllt – bitte prüfen.");
    } catch {
      setKiHinweis("KI-Analyse fehlgeschlagen.");
    } finally {
      setKiLaeding(false);
    }
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!beschreibung.trim() || !betragNetto) {
      setFehler("Bitte Beschreibung und Betrag ausfüllen.");
      return;
    }
    setSaving(true);
    setFehler("");

    const res = await fetch("/api/ausgaben", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum,
        belegNr: belegNr || null,
        beschreibung,
        betragNetto: netto,
        mwstSatz: parseFloat(mwstSatz),
        kategorie,
        lieferantId: lieferantId || null,
        bezahltAm: bezahltHeute ? new Date().toISOString() : null,
        notiz: notiz || null,
        ausleger: privaterAusleger ? (ausleger.trim() || loginUser || "Ich") : null,
        erfasstVon: erfasstVon.trim() || null,
        // DATEV
        buchungstyp,
        sachkonto: sachkonto || null,
        kostenstelle: kostenstelle || null,
        zahlungsweg: zahlungsweg || null,
        reiseZiel: reiseZiel || null,
        reiseKm: reiseKm ? parseFloat(reiseKm) : null,
        reiseKilometerpauschale,
        reiseZweck: reiseZweck || null,
        bewirtungTeilnehmer: bewirtungTeilnehmer || null,
        bewirtungZweck: bewirtungZweck || null,
      }),
    });

    if (!res.ok) {
      const data = await res.json();
      setFehler(data.error ?? "Fehler beim Speichern");
      setSaving(false);
      return;
    }

    const ausgabe = await res.json();

    if (belegFile && ausgabe.id) {
      const fd = new FormData();
      fd.append("file", belegFile);
      await fetch(`/api/ausgaben/${ausgabe.id}/beleg`, { method: "POST", body: fd });
    }

    setSaving(false);
    router.push("/ausgaben");
  }

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ausgaben" className="text-gray-500 hover:text-gray-800">← Zurück</Link>
        <h1 className="text-2xl font-bold">Neue Ausgabe</h1>
      </div>

      <form onSubmit={speichern} className="bg-white border rounded p-5 space-y-4">
        {fehler && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{fehler}</div>}

        {/* ── Beleg hochladen ── */}
        <div>
          <label className="block text-sm font-medium mb-2">Beleg (Foto / Upload)</label>
          <CameraUpload
            onImageSelected={handleBelegSelected}
            imagePreview={belegPreview}
            imageName={belegName}
            onRemove={() => { setBelegFile(null); setBelegPreview(""); setBelegName(""); setKiHinweis(""); }}
            maxResolution={1200}
          />

          {belegPreview && !belegPreview.startsWith("data:application/pdf") && (
            <button
              type="button"
              onClick={kiAnalyse}
              disabled={kiLaeding}
              className="mt-2 w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 disabled:opacity-50"
            >
              {kiLaeding ? (
                <span className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" />
              ) : (
                <span>🤖</span>
              )}
              {kiLaeding ? "KI analysiert…" : "KI: Felder automatisch ausfüllen"}
            </button>
          )}

          {kiHinweis && (
            <p className="mt-1 text-xs text-purple-700 bg-purple-50 rounded px-2 py-1">{kiHinweis}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Datum</label>
            <input type="date" value={datum} onChange={e => setDatum(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm" required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Beleg-Nr. (Eingangsrechnung)</label>
            <input type="text" value={belegNr} onChange={e => setBelegNr(e.target.value)}
              placeholder="z.B. RE-2026-1234"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung *</label>
          <input type="text" value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
            placeholder="z.B. Düngemittel Lieferung März"
            className="w-full border rounded px-3 py-2 text-sm" required />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Kategorie</label>
            <select value={kategorie} onChange={e => { setKategorie(e.target.value); sachkontoManual.current = false; }}
              className="w-full border rounded px-3 py-2 text-sm">
              {kategorienList.map(k => <option key={k}>{k}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Buchungstyp</label>
            <select value={buchungstyp} onChange={e => { setBuchungstyp(e.target.value); sachkontoManual.current = false; }}
              className="w-full border rounded px-3 py-2 text-sm">
              {BUCHUNGSTYPEN.map(bt => <option key={bt}>{bt}</option>)}
            </select>
          </div>
        </div>

        {/* Privatentnahme/einlage Info */}
        {isPrivat && (
          <div className="bg-blue-50 border border-blue-200 rounded p-3 text-sm text-blue-800">
            <p className="font-medium">{buchungstyp}</p>
            <p className="text-xs mt-0.5">
              {buchungstyp === "Privatentnahme"
                ? "Konto 1800 (SKR03) / 2100 (SKR04) — keine MwSt, kein Lieferant"
                : "Konto 1890 (SKR03) / 2110 (SKR04) — Einlage des Inhabers"}
            </p>
          </div>
        )}

        {/* Reisekosten Subformular */}
        {buchungstyp === "Reisekosten" && (
          <div className="border border-sky-200 rounded p-4 bg-sky-50 space-y-3">
            <h3 className="text-sm font-semibold text-sky-800">Reisekosten-Details</h3>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Reiseziel</label>
                <input value={reiseZiel} onChange={e => setReiseZiel(e.target.value)}
                  placeholder="z.B. Berlin"
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Geschäftlicher Zweck</label>
                <input value={reiseZweck} onChange={e => setReiseZweck(e.target.value)}
                  placeholder="z.B. Kundentermin"
                  className="w-full border rounded px-2 py-1 text-sm" />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer text-sky-800">
              <input type="checkbox" checked={reiseKilometerpauschale}
                onChange={e => setReiseKilometerpauschale(e.target.checked)} />
              Kilometerpauschale anwenden (0,30 €/km, §9 Abs. 1 Nr. 4 EStG)
            </label>
            {reiseKilometerpauschale && (
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Kilometer</label>
                <input type="number" step="1" min="0" value={reiseKm}
                  onChange={e => setReiseKm(e.target.value)}
                  placeholder="z.B. 120"
                  className="w-full border rounded px-2 py-1 text-sm" />
                {reiseKm && (
                  <p className="text-xs text-sky-700 mt-1">
                    Betrag netto: {(parseFloat(reiseKm) * KILOMETERPAUSCHALE_EUR).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} (wird automatisch gesetzt)
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Bewirtung Subformular */}
        {buchungstyp === "Bewirtung" && (
          <div className="border border-amber-200 rounded p-4 bg-amber-50 space-y-3">
            <h3 className="text-sm font-semibold text-amber-800">Bewirtungskosten-Details</h3>
            <div className="bg-amber-100 border border-amber-300 rounded p-2 text-xs text-amber-800">
              Nur 70 % steuerlich abzugsfähig (§ 4 Abs. 5 Nr. 2 EStG). Der volle Betrag wird gespeichert —
              DATEV markiert den nicht abzugsfähigen Anteil automatisch (BU-Schlüssel 9).
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Teilnehmer</label>
              <input value={bewirtungTeilnehmer} onChange={e => setBewirtungTeilnehmer(e.target.value)}
                placeholder="z.B. Max Müller, Anna Schmidt (Fa. XY)"
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-medium text-amber-700 mb-1">Geschäftlicher Anlass</label>
              <input value={bewirtungZweck} onChange={e => setBewirtungZweck(e.target.value)}
                placeholder="z.B. Jahresgespräch Kunde XY"
                className="w-full border rounded px-2 py-1 text-sm" />
            </div>
          </div>
        )}

        {!isPrivat && (
          <div>
            <label className="block text-sm font-medium mb-1">Lieferant (optional)</label>
            <select value={lieferantId} onChange={e => setLieferantId(e.target.value)}
              className="w-full border rounded px-3 py-2 text-sm">
              <option value="">— kein Lieferant —</option>
              {lieferanten.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">
              Betrag netto (€) *
              {buchungstyp === "Reisekosten" && reiseKilometerpauschale && " (auto)"}
            </label>
            <input type="number" step="0.01" min="0" value={betragNetto}
              onChange={e => setBetragNetto(e.target.value)}
              readOnly={buchungstyp === "Reisekosten" && reiseKilometerpauschale}
              placeholder="0,00"
              className={`w-full border rounded px-3 py-2 text-sm ${buchungstyp === "Reisekosten" && reiseKilometerpauschale ? "bg-gray-50 text-gray-500" : ""}`}
              required />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">MwSt-Satz</label>
            <select value={mwstSatz} onChange={e => setMwstSatz(e.target.value)}
              disabled={isPrivat}
              className="w-full border rounded px-3 py-2 text-sm disabled:bg-gray-50 disabled:text-gray-400">
              <option value="19">19 %</option>
              <option value="7">7 %</option>
              <option value="0">0 % (steuerfrei)</option>
            </select>
          </div>
        </div>

        {netto > 0 && (
          <div className="bg-gray-50 border rounded p-3 text-sm grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs text-gray-500">Netto</div>
              <div className="font-medium">{netto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">MwSt {mwstSatz}%</div>
              <div className="font-medium text-amber-600">{mwstBetrag.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Brutto</div>
              <div className="font-bold text-blue-700">{brutto.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</div>
            </div>
          </div>
        )}

        {/* DATEV Buchungskonten */}
        <div className="border rounded p-4 bg-gray-50 space-y-3">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Buchungskonto (DATEV)</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Zahlungsweg</label>
              <select value={zahlungsweg} onChange={e => setZahlungsweg(e.target.value)}
                className="w-full border rounded px-2 py-1 text-sm">
                <option value="">— auswählen —</option>
                {ZAHLUNGSWEGE.map(z => <option key={z}>{z}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sachkonto (DATEV)</label>
              <input type="text" value={sachkonto}
                onChange={e => { setSachkonto(e.target.value); sachkontoManual.current = true; }}
                placeholder="z.B. 4530 (auto)"
                className="w-full border rounded px-2 py-1 text-sm font-mono" />
              <p className="text-xs text-gray-400 mt-0.5">Wird aus Buchungstyp/Kategorie vorgeschlagen.</p>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Kostenstelle</label>
            <input list="kostenstellen-list" value={kostenstelle} onChange={e => setKostenstelle(e.target.value)}
              placeholder="z.B. Vertrieb"
              className="w-full border rounded px-2 py-1 text-sm" />
            <datalist id="kostenstellen-list">
              {kostenstellenList.map(k => <option key={k} value={k} />)}
            </datalist>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input type="checkbox" checked={bezahltHeute} onChange={e => setBezahltHeute(e.target.checked)} />
          Bereits bezahlt (heute)
        </label>

        <div className="border rounded p-3 bg-orange-50 space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-orange-800">
            <input type="checkbox" checked={privaterAusleger} onChange={e => {
            setPrivaterAusleger(e.target.checked);
            if (e.target.checked && !ausleger) setAusleger(loginUser);
          }} />
            Privat ausgelegt – Erstattung ausstehend
          </label>
          {privaterAusleger && (
            <div>
              <label className="block text-xs text-orange-700 mb-1">Ausgelegt von (Name)</label>
              <input
                type="text"
                value={ausleger}
                onChange={e => setAusleger(e.target.value)}
                placeholder="z.B. Max Müller"
                className="w-full border border-orange-200 rounded px-3 py-2 text-sm bg-white"
              />
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Erfasst von</label>
          <input type="text" value={erfasstVon} onChange={e => setErfasstVon(e.target.value)}
            placeholder="Benutzername / Name"
            className="w-full border rounded px-3 py-2 text-sm" />
          <p className="text-xs text-gray-400 mt-0.5">Vorbelegt mit dem eingeloggten Benutzer.</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notiz</label>
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={2}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50 w-full sm:w-auto">
            {saving ? "Speichern…" : "Ausgabe speichern"}
          </button>
          <Link href="/ausgaben"
            className="px-5 py-2 rounded border text-sm hover:bg-gray-50 w-full sm:w-auto text-center">
            Abbrechen
          </Link>
        </div>
      </form>
    </div>
  );
}
