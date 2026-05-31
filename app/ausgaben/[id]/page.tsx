"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import CameraUpload from "@/components/CameraUpload";
import { BUCHUNGSTYPEN, ZAHLUNGSWEGE, BUCHUNGSTYP_KONTEN_SKR03, SACHKONTEN_SKR03, KILOMETERPAUSCHALE_EUR, type Buchungstyp } from "@/lib/datev";

const FALLBACK_AUSGABEN_KAT = ["Wareneinkauf", "Betriebsbedarf", "Fahrtkosten", "Bürobedarf", "Telefon/Internet", "Versicherung", "Miete", "Personal", "Sonstige"];

interface Lieferant { id: number; name: string }

type Ctx = { params: Promise<{ id: string }> };

export default function AusgabeDetailPage({ params }: Ctx) {
  const router = useRouter();
  const [id, setId] = useState<number | null>(null);
  const [lieferanten, setLieferanten] = useState<Lieferant[]>([]);
  const [kategorienList, setKategorienList] = useState<string[]>(FALLBACK_AUSGABEN_KAT);
  const [kostenstellenList, setKostenstellenList] = useState<string[]>([]);
  const [sachkontoMap, setSachkontoMap] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [fehler, setFehler] = useState("");
  const [laden, setLaden] = useState(true);

  const [datum, setDatum] = useState("");
  const [belegNr, setBelegNr] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [betragNetto, setBetragNetto] = useState("");
  const [mwstSatz, setMwstSatz] = useState("19");
  const [kategorie, setKategorie] = useState("Sonstige");
  const [lieferantId, setLieferantId] = useState("");
  const [bezahltAm, setBezahltAm] = useState("");
  const [notiz, setNotiz] = useState("");
  const [ausleger, setAusleger] = useState("");
  const [privaterAusleger, setPrivaterAusleger] = useState(false);
  const [erfasstVon, setErfasstVon] = useState("");
  const [loginUser, setLoginUser] = useState("");

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

  // Beleg state
  const [belegPfad, setBelegPfad] = useState<string>("");
  const [belegDateiname, setBelegDateiname] = useState<string>("");
  const [belegFile, setBelegFile] = useState<File | null>(null);
  const [belegPreview, setBelegPreview] = useState<string>("");
  const [belegName, setBelegName] = useState<string>("");
  const [kiLaeding, setKiLaeding] = useState(false);
  const [kiHinweis, setKiHinweis] = useState("");
  const [belegUploading, setBelegUploading] = useState(false);

  useEffect(() => {
    params.then(p => {
      const numId = parseInt(p.id, 10);
      setId(numId);
      fetch(`/api/ausgaben/${numId}`).then(r => r.json()).then(a => {
        setDatum(a.datum?.slice(0, 10) ?? "");
        setBelegNr(a.belegNr ?? "");
        setBeschreibung(a.beschreibung ?? "");
        setBetragNetto(String(a.betragNetto ?? ""));
        setMwstSatz(String(a.mwstSatz ?? 19));
        setKategorie(a.kategorie ?? "Sonstige");
        setLieferantId(a.lieferantId ? String(a.lieferantId) : "");
        setBezahltAm(a.bezahltAm?.slice(0, 10) ?? "");
        setNotiz(a.notiz ?? "");
        if (a.ausleger) { setAusleger(a.ausleger); setPrivaterAusleger(true); }
        setErfasstVon(a.erfasstVon ?? "");
        setBelegPfad(a.belegPfad ?? "");
        setBelegDateiname(a.belegDateiname ?? "");
        // DATEV-Felder aus DB
        setBuchungstyp(a.buchungstyp ?? "Betriebsausgabe");
        setZahlungsweg(a.zahlungsweg ?? "");
        setSachkonto(a.sachkonto ?? "");
        if (a.sachkonto) sachkontoManual.current = true; // bereits gespeichert → nicht auto-überschreiben
        setKostenstelle(a.kostenstelle ?? "");
        setReiseZiel(a.reiseZiel ?? "");
        setReiseKm(a.reiseKm ? String(a.reiseKm) : "");
        setReiseKilometerpauschale(a.reiseKilometerpauschale ?? false);
        setReiseZweck(a.reiseZweck ?? "");
        setBewirtungTeilnehmer(a.bewirtungTeilnehmer ?? "");
        setBewirtungZweck(a.bewirtungZweck ?? "");
        setLaden(false);
      });
    });
    fetch("/api/auth/me").then(r => r.ok ? r.json() : null).then(d => { if (d?.benutzername) setLoginUser(d.benutzername); }).catch(() => {});
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

  // Auto-suggest Sachkonto nur wenn nicht bereits manuell gesetzt
  useEffect(() => {
    if (sachkontoManual.current || laden) return;
    const typeOverride = BUCHUNGSTYP_KONTEN_SKR03[buchungstyp as Buchungstyp];
    setSachkonto(typeOverride ?? sachkontoMap[kategorie] ?? SACHKONTEN_SKR03[kategorie] ?? "");
  }, [buchungstyp, kategorie, sachkontoMap, laden]);

  // Kilometerpauschale
  useEffect(() => {
    if (buchungstyp === "Reisekosten" && reiseKilometerpauschale && reiseKm) {
      const km = parseFloat(reiseKm);
      if (!isNaN(km)) setBetragNetto((km * KILOMETERPAUSCHALE_EUR).toFixed(2));
    }
  }, [buchungstyp, reiseKilometerpauschale, reiseKm]);

  // Privatentnahme/einlage: MwSt auf 0
  useEffect(() => {
    if (!laden && (buchungstyp === "Privatentnahme" || buchungstyp === "Privateinlage")) {
      setMwstSatz("0");
    }
  }, [buchungstyp, laden]);

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
    const imgSrc = belegPreview || (belegPfad ? belegPfad : null);
    if (!imgSrc) return;
    setKiLaeding(true);
    setKiHinweis("");
    try {
      let imageData = belegPreview;
      if (!imageData && belegPfad) {
        const r = await fetch(belegPfad);
        const blob = await r.blob();
        imageData = await new Promise<string>((res) => {
          const fr = new FileReader();
          fr.onload = () => res(fr.result as string);
          fr.readAsDataURL(blob);
        });
      }
      const res = await fetch("/api/ki/beleg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
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

  async function belegUploadSofort() {
    if (!belegFile || !id) return;
    setBelegUploading(true);
    const fd = new FormData();
    fd.append("file", belegFile);
    const res = await fetch(`/api/ausgaben/${id}/beleg`, { method: "POST", body: fd });
    if (res.ok) {
      const d = await res.json();
      setBelegPfad(d.belegPfad);
      setBelegDateiname(d.belegDateiname ?? belegFile.name);
      setBelegFile(null);
      setBelegPreview("");
      setBelegName("");
    }
    setBelegUploading(false);
  }

  async function belegLoeschen() {
    if (!id) return;
    await fetch(`/api/ausgaben/${id}/beleg`, { method: "DELETE" });
    setBelegPfad("");
    setBelegDateiname("");
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault();
    if (!beschreibung.trim() || !betragNetto) {
      setFehler("Bitte Beschreibung und Betrag ausfüllen.");
      return;
    }
    setSaving(true);
    setFehler("");

    if (belegFile && id) {
      const fd = new FormData();
      fd.append("file", belegFile);
      const ur = await fetch(`/api/ausgaben/${id}/beleg`, { method: "POST", body: fd });
      if (ur.ok) {
        const d = await ur.json();
        setBelegPfad(d.belegPfad);
        setBelegFile(null);
        setBelegPreview("");
        setBelegName("");
      }
    }

    const res = await fetch(`/api/ausgaben/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        datum,
        belegNr: belegNr || null,
        beschreibung,
        betragNetto: netto,
        mwstSatz: parseFloat(mwstSatz),
        kategorie,
        lieferantId: lieferantId || null,
        bezahltAm: bezahltAm || null,
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
    setSaving(false);
    if (res.ok) {
      router.push("/ausgaben");
    } else {
      const data = await res.json();
      setFehler(data.error ?? "Fehler beim Speichern");
    }
  }

  if (laden) return <div className="p-8 text-center text-gray-400">Lade…</div>;

  return (
    <div className="max-w-xl mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <Link href="/ausgaben" className="text-gray-500 hover:text-gray-800">← Zurück</Link>
        <h1 className="text-2xl font-bold">Ausgabe bearbeiten</h1>
      </div>

      <form onSubmit={speichern} className="bg-white border rounded p-5 space-y-4">
        {fehler && <div className="bg-red-50 text-red-700 px-3 py-2 rounded text-sm">{fehler}</div>}

        {/* ── Beleg ── */}
        <div>
          <label className="block text-sm font-medium mb-2">Beleg (Foto / Upload)</label>

          {belegPfad && !belegPreview && (() => {
            const isPdf = /\.pdf$/i.test(belegPfad);
            return (
            <div className="space-y-2">
              <div className="border rounded-xl overflow-hidden bg-gray-50 flex items-center justify-center min-h-48">
                {isPdf ? (
                  <a href={belegPfad} target="_blank" rel="noopener noreferrer"
                    className="flex flex-col items-center justify-center py-8 px-4 text-center hover:bg-gray-100 w-full">
                    <svg className="w-16 h-16 text-red-500 mb-2" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm4 18H6V4h7v5h5v11zM8 13h8v1H8v-1zm0 3h8v1H8v-1zm0-6h5v1H8v-1z" />
                    </svg>
                    <p className="text-sm font-medium text-blue-700 underline break-all">
                      {belegDateiname || belegPfad.split("/").pop()}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">PDF öffnen</p>
                  </a>
                ) : (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={belegPfad} alt="Beleg" className="max-h-72 max-w-full object-contain" />
                )}
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs text-gray-500 flex-1 truncate">{belegDateiname || belegPfad.split("/").pop()}</span>
                <button type="button" onClick={() => setBelegPreview("__replace__")}
                  className="text-xs text-blue-600 hover:underline shrink-0">Ersetzen</button>
                <button type="button" onClick={belegLoeschen}
                  className="text-xs text-red-500 hover:underline shrink-0">Löschen</button>
              </div>
              {!isPdf && (
                <button type="button" onClick={kiAnalyse} disabled={kiLaeding}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 disabled:opacity-50">
                  {kiLaeding ? <span className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" /> : <span>🤖</span>}
                  {kiLaeding ? "KI analysiert…" : "KI: Felder automatisch ausfüllen"}
                </button>
              )}
            </div>
            );
          })()}

          {(!belegPfad || belegPreview) && (
            <>
              <CameraUpload
                onImageSelected={handleBelegSelected}
                imagePreview={belegPreview === "__replace__" ? "" : belegPreview}
                imageName={belegName}
                onRemove={() => {
                  setBelegFile(null);
                  setBelegPreview("");
                  setBelegName("");
                  setKiHinweis("");
                }}
                maxResolution={1200}
              />
              {belegPreview && belegPreview !== "__replace__" && (
                <div className="flex gap-2 mt-2">
                  {!belegPreview.startsWith("data:application/pdf") && (
                    <button type="button" onClick={kiAnalyse} disabled={kiLaeding}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded border border-purple-300 bg-purple-50 text-purple-700 text-sm font-medium hover:bg-purple-100 disabled:opacity-50">
                      {kiLaeding ? <span className="animate-spin w-4 h-4 border-2 border-purple-500 border-t-transparent rounded-full" /> : <span>🤖</span>}
                      {kiLaeding ? "Analysiert…" : "KI-Analyse"}
                    </button>
                  )}
                  <button type="button" onClick={belegUploadSofort} disabled={belegUploading}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded border border-green-300 bg-green-50 text-green-700 text-sm font-medium hover:bg-green-100 disabled:opacity-50">
                    {belegUploading ? "Hochladen…" : "Beleg speichern"}
                  </button>
                </div>
              )}
            </>
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
            <label className="block text-sm font-medium mb-1">Beleg-Nr.</label>
            <input type="text" value={belegNr} onChange={e => setBelegNr(e.target.value)}
              placeholder="z.B. RE-2026-1234"
              className="w-full border rounded px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Beschreibung *</label>
          <input type="text" value={beschreibung} onChange={e => setBeschreibung(e.target.value)}
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
              Kilometerpauschale (0,30 €/km, §9 Abs. 1 Nr. 4 EStG)
            </label>
            {reiseKilometerpauschale && (
              <div>
                <label className="block text-xs font-medium text-sky-700 mb-1">Kilometer</label>
                <input type="number" step="1" min="0" value={reiseKm}
                  onChange={e => setReiseKm(e.target.value)} placeholder="z.B. 120"
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

        {buchungstyp === "Bewirtung" && (
          <div className="border border-amber-200 rounded p-4 bg-amber-50 space-y-3">
            <h3 className="text-sm font-semibold text-amber-800">Bewirtungskosten-Details</h3>
            <div className="bg-amber-100 border border-amber-300 rounded p-2 text-xs text-amber-800">
              Nur 70 % steuerlich abzugsfähig (§ 4 Abs. 5 Nr. 2 EStG). DATEV markiert mit BU-Schlüssel 9.
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

        <div>
          <label className="block text-sm font-medium mb-1">Bezahlt am</label>
          <input type="date" value={bezahltAm} onChange={e => setBezahltAm(e.target.value)}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="border rounded p-3 bg-orange-50 space-y-2">
          <label className="flex items-center gap-2 text-sm cursor-pointer font-medium text-orange-800">
            <input type="checkbox" checked={privaterAusleger} onChange={e => {
              setPrivaterAusleger(e.target.checked);
              if (!e.target.checked) setAusleger("");
              else if (!ausleger) setAusleger(loginUser);
            }} />
            Privat ausgelegt – Erstattung ausstehend
          </label>
          {privaterAusleger && (
            <div>
              <label className="block text-xs text-orange-700 mb-1">Ausgelegt von (Name)</label>
              <input type="text" value={ausleger} onChange={e => setAusleger(e.target.value)}
                placeholder="z.B. Max Müller"
                className="w-full border border-orange-200 rounded px-3 py-2 text-sm bg-white" />
              {bezahltAm && (
                <p className="text-xs text-green-700 mt-1">
                  Erstattet am {new Date(bezahltAm).toLocaleDateString("de-DE")}
                </p>
              )}
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Erfasst von</label>
          <input type="text" value={erfasstVon} onChange={e => setErfasstVon(e.target.value)}
            placeholder="Benutzername / Name"
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Notiz</label>
          <textarea value={notiz} onChange={e => setNotiz(e.target.value)} rows={2}
            className="w-full border rounded px-3 py-2 text-sm" />
        </div>

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={saving}
            className="bg-blue-600 text-white px-5 py-2 rounded hover:bg-blue-700 text-sm disabled:opacity-50 w-full sm:w-auto">
            {saving ? "Speichern…" : "Speichern"}
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
