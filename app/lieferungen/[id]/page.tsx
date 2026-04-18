"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { StatusBadge, MargeBadge } from "@/components/Badge";
import { formatEuro, formatDatum } from "@/lib/utils";

interface Position {
  id: number;
  menge: number;
  einheit: string;
  verkaufspreis: number;
  einkaufspreis: number;
  chargeNr?: string | null;
  rabattProzent?: number;
  notiz?: string | null;
  artikel: { id: number; name: string; einheit: string; mwstSatz: number };
}

interface ArtikelOption {
  id: number;
  name: string;
  standardpreis: number;
  einheit: string;
  aktuellerBestand: number;
  mindestbestand: number;
  lieferanten?: { einkaufspreis: number }[];
}

interface Lieferung {
  id: number;
  datum: string;
  lieferDatum?: string | null;
  status: string;
  notiz?: string;
  rechnungNr?: string;
  rechnungDatum?: string | null;
  bezahltAm?: string | null;
  zahlungsziel?: number | null;
  kunde: { id: number; name: string; firma?: string };
  positionen: Position[];
}

export default function LieferungDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const [showStornoModal, setShowStornoModal] = useState(false);
  const [stornoBegründung, setStornoBegrundung] = useState("");
  const [stornoError, setStornoError] = useState("");
  const [zahlungszielEdit, setZahlungszielEdit] = useState<string>("");
  const [lieferDatumEdit, setLieferDatumEdit] = useState<string>("");
  const [lieferDatumSaved, setLieferDatumSaved] = useState(false);
  const [rechnungNrEdit, setRechnungNrEdit] = useState<string>("");
  const [rechnungNrEditing, setRechnungNrEditing] = useState(false);
  const [rechnungNrError, setRechnungNrError] = useState("");
  const [firmaData, setFirmaData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [rabattEditId, setRabattEditId] = useState<number | null>(null);
  const [rabattEditValue, setRabattEditValue] = useState<string>("");
  const [rabattSavingId, setRabattSavingId] = useState<number | null>(null);

  const [vkEditId, setVkEditId] = useState<number | null>(null);
  const [vkEditValue, setVkEditValue] = useState<string>("");
  const [vkSavingId, setVkSavingId] = useState<number | null>(null);

  const [mengeEditId, setMengeEditId] = useState<number | null>(null);
  const [mengeEditValue, setMengeEditValue] = useState<string>("");
  const [mengeSavingId, setMengeSavingId] = useState<number | null>(null);

  const [notizEditId, setNotizEditId] = useState<number | null>(null);
  const [notizEditValue, setNotizEditValue] = useState<string>("");
  const [notizSavingId, setNotizSavingId] = useState<number | null>(null);

  // Position hinzufügen (nur geplant)
  const [artikelListe, setArtikelListe] = useState<ArtikelOption[]>([]);
  const [showAddPos, setShowAddPos] = useState(false);
  const [addPosArtikelId, setAddPosArtikelId] = useState<string>("");
  const [addPosMenge, setAddPosMenge] = useState<string>("");
  const [addPosVk, setAddPosVk] = useState<string>("");
  const [addPosEk, setAddPosEk] = useState<string>("");
  const [addPosCharge, setAddPosCharge] = useState<string>("");
  const [addPosSaving, setAddPosSaving] = useState(false);
  const [addPosError, setAddPosError] = useState<string>("");

  async function load() {
    setLoading(true);
    const res = await fetch(`/api/lieferungen/${id}`);
    if (!res.ok) { setLoading(false); setError("Lieferung nicht gefunden."); return; }
    const data = await res.json();
    setLieferung(data);
    setZahlungszielEdit(String(data.zahlungsziel ?? 30));
    // Datepicker-Format (YYYY-MM-DD) – Fallback auf Standard-Lieferdatum
    const lieferBasis = data.lieferDatum ?? data.datum;
    setLieferDatumEdit(lieferBasis ? new Date(lieferBasis).toISOString().slice(0, 10) : "");
    setLieferDatumSaved(false);
    setRechnungNrEdit(data.rechnungNr ?? "");
    setRechnungNrEditing(false);
    setRechnungNrError("");
    setLoading(false);
  }

  function startRabattEdit(pos: Position) {
    if (lieferung && lieferung.status === "storniert") return;
    setRabattEditId(pos.id);
    setRabattEditValue(String(pos.rabattProzent ?? 0));
  }

  async function commitRabattEdit(posId: number) {
    const raw = rabattEditValue.trim().replace(",", ".");
    const neu = parseFloat(raw);
    if (isNaN(neu) || neu < 0 || neu > 100) {
      alert("Rabatt muss zwischen 0 und 100 liegen");
      return;
    }
    setRabattSavingId(posId);
    try {
      const res = await fetch(`/api/lieferungen/${id}/positionen/${posId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rabattProzent: neu }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error ?? "Fehler beim Speichern");
        return;
      }
      setRabattEditId(null);
      await load();
    } finally {
      setRabattSavingId(null);
    }
  }

  async function commitPosField(posId: number, field: string, value: unknown, onDone: () => void) {
    const res = await fetch(`/api/lieferungen/${id}/positionen/${posId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [field]: value }),
    });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error ?? "Fehler beim Speichern");
      return;
    }
    onDone();
    await load();
  }

  function canEditPos() {
    return lieferung && lieferung.status !== "storniert";
  }

  async function speichereRechnungNr() {
    const neu = rechnungNrEdit.trim();
    if (!neu) { setRechnungNrError("Rechnungsnummer darf nicht leer sein."); return; }
    setActionLoading(true);
    setRechnungNrError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rechnungNr: neu,
          // rechnungDatum nur setzen wenn noch keins existierte (Übergangs-Rechnungen)
          ...(lieferung?.rechnungDatum ? {} : { rechnungDatum: new Date().toISOString() }),
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error || "Fehler beim Speichern");
      }
      await load();
    } catch (e) {
      setRechnungNrError(e instanceof Error ? e.message : "Fehler beim Speichern.");
    } finally {
      setActionLoading(false);
    }
  }

  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch("/api/artikel?relations=false&limit=500")
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setArtikelListe(d); })
      .catch(() => {});
  }, []);

  function openAddPos() {
    setAddPosArtikelId("");
    setAddPosMenge("");
    setAddPosVk("");
    setAddPosEk("");
    setAddPosCharge("");
    setAddPosError("");
    setShowAddPos(true);
  }

  function onArtikelSelect(artId: string) {
    setAddPosArtikelId(artId);
    const art = artikelListe.find(a => String(a.id) === artId);
    if (art) {
      setAddPosVk(String(art.standardpreis));
      setAddPosEk(String(art.lieferanten?.[0]?.einkaufspreis ?? 0));
    }
  }

  async function saveAddPos() {
    if (!addPosArtikelId) { setAddPosError("Bitte einen Artikel wählen."); return; }
    const menge = parseFloat(addPosMenge.replace(",", "."));
    if (isNaN(menge) || menge <= 0) { setAddPosError("Ungültige Menge."); return; }
    setAddPosSaving(true);
    setAddPosError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}/positionen`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artikelId: Number(addPosArtikelId),
          menge,
          verkaufspreis: addPosVk ? parseFloat(addPosVk.replace(",", ".")) : undefined,
          einkaufspreis: addPosEk ? parseFloat(addPosEk.replace(",", ".")) : undefined,
          chargeNr: addPosCharge.trim() || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setAddPosError((d as { error?: string }).error ?? "Fehler beim Hinzufügen.");
        return;
      }
      setShowAddPos(false);
      await load();
    } finally {
      setAddPosSaving(false);
    }
  }

  async function deletePos(posId: number) {
    if (!confirm("Position wirklich löschen?")) return;
    try {
      const res = await fetch(`/api/lieferungen/${id}/positionen/${posId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setError((d as { error?: string }).error ?? "Fehler beim Löschen.");
        return;
      }
      await load();
    } catch {
      setError("Fehler beim Löschen der Position.");
    }
  }

  useEffect(() => {
    fetch("/api/einstellungen?prefix=firma.")
      .then(r => r.json())
      .then(d => setFirmaData(d))
      .catch(() => {});
    fetch("/api/einstellungen?prefix=system.logo")
      .then(r => r.json())
      .then(d => { if (d["system.logo"]) setLogo(d["system.logo"]); })
      .catch(() => {});
  }, []);

  async function markiereGeliefert() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "geliefert" }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      await load();
    } catch {
      setError("Fehler beim Aktualisieren des Status.");
    } finally {
      setActionLoading(false);
    }
  }

  async function handleStorno(e: React.FormEvent) {
    e.preventDefault();
    if (!stornoBegründung.trim()) { setStornoError("Bitte eine Begründung angeben."); return; }
    setActionLoading(true);
    setStornoError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "storniert", stornoBegründung: stornoBegründung.trim() }),
      });
      if (!res.ok) throw new Error("Fehler beim Stornieren");
      setShowStornoModal(false);
      setStornoBegrundung("");
      await load();
    } catch {
      setStornoError("Fehler beim Stornieren.");
    } finally {
      setActionLoading(false);
    }
  }

  async function rechnungErstellen() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_erstellen" }),
      });
      if (!res.ok) throw new Error("Fehler beim Erstellen der Rechnung");
      await load();
    } catch {
      setError("Fehler beim Erstellen der Rechnung.");
    } finally {
      setActionLoading(false);
    }
  }

  async function markiereBezahlt() {
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bezahltAm: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("Fehler beim Aktualisieren");
      await load();
    } catch {
      setError("Fehler beim Markieren als bezahlt.");
    } finally {
      setActionLoading(false);
    }
  }

  async function speichereZahlungsziel() {
    const tage = parseInt(zahlungszielEdit, 10);
    if (isNaN(tage) || tage < 0) return;
    setActionLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zahlungsziel: tage }),
      });
      if (!res.ok) throw new Error("Fehler beim Speichern");
      await load();
    } catch {
      setError("Fehler beim Speichern des Zahlungsziels.");
    } finally {
      setActionLoading(false);
    }
  }

  async function speichereLieferDatum() {
    setActionLoading(true);
    setError("");
    setLieferDatumSaved(false);
    try {
      // Leerer String → Lieferdatum zurücksetzen (Fallback auf datum)
      const payload: { lieferDatum: string | null } = {
        lieferDatum: lieferDatumEdit.trim() === "" ? null : new Date(lieferDatumEdit).toISOString(),
      };
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error((d as { error?: string }).error || "Fehler beim Speichern");
      }
      setLieferDatumSaved(true);
      setTimeout(() => setLieferDatumSaved(false), 2000);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fehler beim Speichern des Lieferdatums.");
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return <div className="text-gray-400 text-sm p-6">Lade Lieferung…</div>;
  }

  if (!lieferung) {
    return (
      <div>
        <p className="text-red-600 mb-4">{error || "Lieferung nicht gefunden."}</p>
        <Link href="/lieferungen" className="text-green-700 hover:underline text-sm">
          ← Zurück zu Lieferungen
        </Link>
      </div>
    );
  }

  const gesamtUmsatz = lieferung.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis, 0);
  const gesamtEinkauf = lieferung.positionen.reduce((s, p) => s + p.menge * p.einkaufspreis, 0);
  const gesamtMarge = gesamtUmsatz - gesamtEinkauf;
  const gesamtMargePct = gesamtUmsatz > 0 ? (gesamtMarge / gesamtUmsatz) * 100 : 0;

  const heute = new Date();
  heute.setHours(0, 0, 0, 0);
  const zahlungszielTage = lieferung.zahlungsziel ?? 30;
  const basisDatum = lieferung.rechnungDatum ? new Date(lieferung.rechnungDatum) : new Date(lieferung.datum);
  const faelligkeitsDatum = new Date(basisDatum.getTime() + zahlungszielTage * 24 * 60 * 60 * 1000);
  const istGeliefert = lieferung.status === "geliefert";
  const istBezahlt = !!lieferung.bezahltAm;
  const istUeberfaellig = istGeliefert && !istBezahlt && heute > faelligkeitsDatum;
  const faelligSeitTagen = istUeberfaellig
    ? Math.floor((heute.getTime() - faelligkeitsDatum.getTime()) / (24 * 60 * 60 * 1000))
    : 0;

  function ZahlungsstatusBadge() {
    if (!istGeliefert) return null;
    if (istBezahlt)
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-green-100 text-green-800">Bezahlt</span>;
    if (istUeberfaellig)
      return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-red-100 text-red-700">Überfällig ({faelligSeitTagen} Tage)</span>;
    return <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800">Offen</span>;
  }

  const nettobetrag = lieferung.positionen.reduce(
    (s, p) => s + p.menge * p.verkaufspreis * (1 - ((p.rabattProzent ?? 0) / 100)),
    0
  );
  // Group MwSt by rate
  const mwstGruppen = lieferung.positionen.reduce<Record<number, number>>((acc, p) => {
    const satz = p.artikel.mwstSatz ?? 19;
    const netto = p.menge * p.verkaufspreis * (1 - ((p.rabattProzent ?? 0) / 100));
    acc[satz] = (acc[satz] ?? 0) + netto * (satz / 100);
    return acc;
  }, {});
  const mwstGesamt = Object.values(mwstGruppen).reduce((s, v) => s + v, 0);
  const bruttobetrag = nettobetrag + mwstGesamt;
  const docNr = lieferung.rechnungNr ?? `LS-${lieferung.id}`;
  const isRechnung = !!lieferung.rechnungNr;
  const faelligStr = formatDatum(faelligkeitsDatum.toISOString());

  return (
    <div>
      {/* Print-only document layout */}
      <div className="hidden print:block" style={{ fontFamily: "serif", fontSize: "11pt", color: "#000", padding: "0" }}>
        {/* Firma Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div>
            {logo && <img src={logo} style={{ height: "60px", marginBottom: "8px" }} alt="Logo" />}
            {(firmaData["firma.name"] || firmaData["firma.firmenname"]) && (
              <div style={{ fontWeight: "bold", fontSize: "13pt" }}>{firmaData["firma.name"] ?? firmaData["firma.firmenname"]}</div>
            )}
            {(firmaData["firma.strasse"] || firmaData["firma.adresse"]) && (
              <div>{firmaData["firma.strasse"] ?? firmaData["firma.adresse"]}</div>
            )}
            {(firmaData["firma.plz"] || firmaData["firma.ort"]) && (
              <div>{[firmaData["firma.plz"], firmaData["firma.ort"]].filter(Boolean).join(" ")}</div>
            )}
            {(firmaData["firma.telefon"] || firmaData["firma.tel"]) && (
              <div>Tel: {firmaData["firma.telefon"] ?? firmaData["firma.tel"]}</div>
            )}
            {firmaData["firma.email"] && <div>E-Mail: {firmaData["firma.email"]}</div>}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "18pt", fontWeight: "bold", marginBottom: "4px" }}>
              {isRechnung ? "Rechnung" : "Lieferschein"}
            </div>
            <div style={{ fontSize: "10pt", color: "#555" }}>Nr: {docNr}</div>
            <div style={{ fontSize: "10pt", color: "#555" }}>Datum: {formatDatum(lieferung.datum)}</div>
            {isRechnung && (
              <>
                <div style={{ fontSize: "10pt", color: "#555" }}>Zahlungsziel: {zahlungszielTage} Tage</div>
                <div style={{ fontSize: "10pt", color: "#555" }}>Fällig am: {faelligStr}</div>
              </>
            )}
          </div>
        </div>

        <hr style={{ borderTop: "1px solid #333", marginBottom: "16px" }} />

        {/* Empfänger */}
        <div style={{ marginBottom: "24px" }}>
          <div style={{ fontSize: "9pt", color: "#777", marginBottom: "2px" }}>Empfänger</div>
          <div style={{ fontWeight: "bold" }}>
            {lieferung.kunde.firma
              ? `${lieferung.kunde.firma} (${lieferung.kunde.name})`
              : lieferung.kunde.name}
          </div>
        </div>

        {/* Positions table */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px", fontSize: "10pt" }}>
          <thead>
            <tr style={{ borderBottom: "2px solid #333" }}>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Pos</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Artikel</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Charge</th>
              <th style={{ textAlign: "right", padding: "4px 6px" }}>Menge</th>
              <th style={{ textAlign: "left", padding: "4px 6px" }}>Einheit</th>
              <th style={{ textAlign: "right", padding: "4px 6px" }}>Einzelpreis</th>
              <th style={{ textAlign: "right", padding: "4px 6px" }}>Gesamt</th>
            </tr>
          </thead>
          <tbody>
            {lieferung.positionen.map((p, idx) => {
              const gesamt = p.menge * p.verkaufspreis * (1 - ((p.rabattProzent ?? 0) / 100));
              return (
                <tr key={p.id} style={{ borderBottom: "1px solid #ccc" }}>
                  <td style={{ padding: "4px 6px", verticalAlign: "top" }}>{idx + 1}</td>
                  <td style={{ padding: "4px 6px", verticalAlign: "top" }}>
                    <div>{p.artikel.name}</div>
                    {(p.rabattProzent ?? 0) > 0 && (
                      <div style={{ fontSize: "9pt", color: "#555" }}>Rabatt {p.rabattProzent}%</div>
                    )}
                  </td>
                  <td style={{ padding: "4px 6px", verticalAlign: "top", fontFamily: "monospace", fontSize: "9pt", color: "#555" }}>
                    {p.chargeNr ?? "—"}
                  </td>
                  <td style={{ padding: "4px 6px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>{p.menge}</td>
                  <td style={{ padding: "4px 6px", verticalAlign: "top" }}>{p.artikel.einheit}</td>
                  <td style={{ padding: "4px 6px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>{formatEuro(p.verkaufspreis)}</td>
                  <td style={{ padding: "4px 6px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>{formatEuro(gesamt)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* Totals */}
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "24px" }}>
          <table style={{ fontSize: "10pt", borderCollapse: "collapse", minWidth: "240px" }}>
            <tbody>
              <tr>
                <td style={{ padding: "3px 8px" }}>Nettobetrag:</td>
                <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace" }}>{formatEuro(nettobetrag)}</td>
              </tr>
              {Object.entries(mwstGruppen).sort(([a], [b]) => Number(a) - Number(b)).map(([satz, betrag]) => (
                <tr key={satz}>
                  <td style={{ padding: "3px 8px" }}>MwSt {satz}%:</td>
                  <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace" }}>{formatEuro(betrag)}</td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #333" }}>
                <td style={{ padding: "3px 8px", fontWeight: "bold" }}>Bruttobetrag:</td>
                <td style={{ padding: "3px 8px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold" }}>{formatEuro(bruttobetrag)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Notiz */}
        {lieferung.notiz && (
          <div style={{ marginBottom: "24px", fontSize: "10pt", color: "#555", fontStyle: "italic" }}>
            Hinweis: {lieferung.notiz}
          </div>
        )}

        {/* Footer */}
        <hr style={{ borderTop: "1px solid #ccc", marginTop: "32px", marginBottom: "8px" }} />
        <div style={{ fontSize: "9pt", color: "#555", display: "flex", flexWrap: "wrap", gap: "16px" }}>
          {(firmaData["firma.bank"] || firmaData["firma.bankname"]) && <span>Bank: {firmaData["firma.bank"] ?? firmaData["firma.bankname"]}</span>}
          {firmaData["firma.iban"] && <span>IBAN: {firmaData["firma.iban"]}</span>}
          {firmaData["firma.bic"] && <span>BIC: {firmaData["firma.bic"]}</span>}
          {(firmaData["firma.steuernummer"] || firmaData["firma.steuernr"]) && <span>Steuernr.: {firmaData["firma.steuernummer"] ?? firmaData["firma.steuernr"]}</span>}
        </div>
      </div>

      {/* Back link */}
      <Link href="/lieferungen" className="text-sm text-green-700 hover:text-green-900 hover:underline mb-4 inline-block print:hidden">
        ← Zurück zu Lieferungen
      </Link>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 print:hidden">
          {error}
        </div>
      )}

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6 print:hidden">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold mb-1">
              Lieferung #{lieferung.id}
            </h1>
            <div className="flex items-center gap-3 flex-wrap text-sm text-gray-600">
              <span className="font-medium text-gray-800">
                {lieferung.kunde.firma
                  ? `${lieferung.kunde.firma} (${lieferung.kunde.name})`
                  : lieferung.kunde.name}
              </span>
              <span>·</span>
              <span>{formatDatum(lieferung.datum)}</span>
              <span>·</span>
              <StatusBadge status={lieferung.status} />
            </div>
            {lieferung.notiz && (
              <p className="mt-2 text-sm text-gray-500 italic">{lieferung.notiz}</p>
            )}
            {lieferung.rechnungNr && (
              <div className="mt-2 text-sm text-gray-700 print:hidden">
                {rechnungNrEditing ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Rechnung:</span>
                    <input
                      type="text"
                      value={rechnungNrEdit}
                      onChange={(e) => setRechnungNrEdit(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-0.5 text-sm font-mono w-40 focus:outline-none focus:ring-1 focus:ring-green-700"
                      placeholder="RE-2026-0001"
                      autoFocus
                    />
                    <button
                      onClick={speichereRechnungNr}
                      disabled={actionLoading}
                      className="px-2 py-0.5 text-xs bg-green-700 hover:bg-green-800 text-white rounded transition-colors disabled:opacity-60"
                    >
                      Speichern
                    </button>
                    <button
                      onClick={() => { setRechnungNrEditing(false); setRechnungNrEdit(lieferung.rechnungNr ?? ""); setRechnungNrError(""); }}
                      className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors"
                    >
                      Abbrechen
                    </button>
                    {rechnungNrError && (
                      <span className="text-xs text-red-600 w-full">{rechnungNrError}</span>
                    )}
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Rechnung: <span className="font-mono font-medium">{lieferung.rechnungNr}</span></span>
                    <button
                      onClick={() => { setRechnungNrEditing(true); setRechnungNrEdit(lieferung.rechnungNr ?? ""); setRechnungNrError(""); }}
                      className="text-xs text-green-700 hover:text-green-900 underline"
                      title="Rechnungsnummer bearbeiten"
                    >
                      bearbeiten
                    </button>
                  </div>
                )}
              </div>
            )}
            {istGeliefert && (
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <ZahlungsstatusBadge />
                {istBezahlt && lieferung.bezahltAm && (
                  <span className="text-xs text-gray-500">
                    bezahlt am {formatDatum(lieferung.bezahltAm)}
                  </span>
                )}
                {!istBezahlt && (
                  <span className="text-xs text-gray-500">
                    Fällig: {formatDatum(faelligkeitsDatum.toISOString())}
                  </span>
                )}
              </div>
            )}
            <div className="mt-2 flex items-center gap-2 text-sm flex-wrap">
              <label className="text-gray-600 whitespace-nowrap">Lieferdatum:</label>
              <input
                type="date"
                value={lieferDatumEdit}
                onChange={(e) => setLieferDatumEdit(e.target.value)}
                className="border border-gray-300 rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
              />
              <button
                onClick={speichereLieferDatum}
                disabled={actionLoading}
                className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors disabled:opacity-60"
              >
                Speichern
              </button>
              {lieferDatumSaved && (
                <span className="text-xs text-green-700">✓ gespeichert</span>
              )}
              {!lieferung.lieferDatum && (
                <span className="text-xs text-gray-400">(Standard: Erfassungsdatum {formatDatum(lieferung.datum)})</span>
              )}
            </div>
            {istGeliefert && (
              <div className="mt-2 flex items-center gap-2 text-sm">
                <label className="text-gray-600 whitespace-nowrap">Zahlungsziel:</label>
                <input
                  type="number"
                  min={0}
                  value={zahlungszielEdit}
                  onChange={(e) => setZahlungszielEdit(e.target.value)}
                  className="w-20 border border-gray-300 rounded px-2 py-0.5 text-sm font-mono focus:outline-none focus:ring-1 focus:ring-green-700"
                />
                <span className="text-gray-500">Tage</span>
                <button
                  onClick={speichereZahlungsziel}
                  disabled={actionLoading}
                  className="px-2 py-0.5 text-xs bg-gray-100 hover:bg-gray-200 border border-gray-300 rounded transition-colors disabled:opacity-60"
                >
                  Speichern
                </button>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => window.print()}
              className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors print:hidden text-gray-600"
              title="Drucken"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            </button>
            {lieferung.status === "geplant" && (
              <>
                <button
                  onClick={markiereGeliefert}
                  disabled={actionLoading}
                  className="p-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors disabled:opacity-60"
                  title="Als geliefert markieren"
                >
                  {actionLoading ? <span className="w-5 h-5 flex items-center justify-center text-xs">…</span> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
                </button>
                <button
                  onClick={() => { setShowStornoModal(true); setStornoBegrundung(""); setStornoError(""); }}
                  disabled={actionLoading}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors disabled:opacity-60"
                  title="Stornieren"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </>
            )}

            {lieferung.status === "geliefert" && (
              <>
                {!lieferung.rechnungNr && (
                  <button
                    onClick={async () => {
                      setActionLoading(true);
                      setError("");
                      try {
                        const res = await fetch(`/api/lieferungen/${id}`, {
                          method: "PUT",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "geplant" }),
                        });
                        if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "Fehler");
                        await load();
                      } catch (e) {
                        setError(e instanceof Error ? e.message : "Fehler beim Zurücksetzen.");
                      } finally {
                        setActionLoading(false);
                      }
                    }}
                    disabled={actionLoading}
                    className="p-2 bg-amber-100 hover:bg-amber-200 text-amber-800 border border-amber-300 rounded-lg transition-colors disabled:opacity-60"
                    title="Wieder öffnen (zurück zu Geplant)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
                  </button>
                )}
                {!istBezahlt && (
                  <button
                    onClick={markiereBezahlt}
                    disabled={actionLoading}
                    className="p-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-60"
                    title="Als bezahlt markieren"
                  >
                    {actionLoading ? <span className="w-5 h-5 flex items-center justify-center text-xs">…</span> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>}
                  </button>
                )}
                <button
                  onClick={() => { setShowStornoModal(true); setStornoBegrundung(""); setStornoError(""); }}
                  disabled={actionLoading}
                  className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors disabled:opacity-60"
                  title="Stornieren"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                {!lieferung.rechnungNr && (
                  <button
                    onClick={rechnungErstellen}
                    disabled={actionLoading}
                    className="p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-60"
                    title="Rechnung erstellen"
                  >
                    {actionLoading ? <span className="w-5 h-5 flex items-center justify-center text-xs">…</span> : <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>}
                  </button>
                )}
              </>
            )}

            {lieferung.status !== "storniert" && (
              <button
                onClick={() => router.push(`/lieferungen/${id}/lieferschein`)}
                className="p-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg transition-colors"
                title="Lieferschein"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" /></svg>
              </button>
            )}
            {lieferung.rechnungNr && (
              <button
                onClick={() => router.push(`/lieferungen/${id}/rechnung`)}
                className="p-2 bg-green-800 hover:bg-green-700 text-white rounded-lg transition-colors"
                title="Rechnung öffnen"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Positions table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-x-auto mb-6 print:hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              {["Artikel", "Charge", "Menge", "Einheit", "VK", "Rabatt", "EK", "Marge €", "Marge %", "Notiz / Auftragsnr."].map((h) => (
                <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                  {h}
                </th>
              ))}
              {lieferung.status === "geplant" && <th className="px-2 py-3" />}
            </tr>
          </thead>
          <tbody>
            {lieferung.positionen.map((pos) => {
              const margeEuro = pos.menge * (pos.verkaufspreis - pos.einkaufspreis);
              const margePct =
                pos.verkaufspreis > 0
                  ? ((pos.verkaufspreis - pos.einkaufspreis) / pos.verkaufspreis) * 100
                  : 0;
              return (
                <tr key={pos.id} className="border-b last:border-0 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3 font-medium">{pos.artikel.name}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs font-mono">{pos.chargeNr ?? "—"}</td>
                  {/* Menge – inline edit */}
                  <td className="px-4 py-3 font-mono">
                    {mengeEditId === pos.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0.001}
                          step="any"
                          autoFocus
                          value={mengeEditValue}
                          onChange={(e) => setMengeEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); const v = parseFloat(mengeEditValue.replace(",", ".")); if (isNaN(v) || v <= 0) { alert("Menge muss größer als 0 sein"); return; } setMengeSavingId(pos.id); commitPosField(pos.id, "menge", v, () => setMengeEditId(null)).finally(() => setMengeSavingId(null)); } else if (e.key === "Escape") setMengeEditId(null);
                          }}
                          className="w-20 border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                        <button onClick={() => { const v = parseFloat(mengeEditValue.replace(",", ".")); if (isNaN(v) || v <= 0) { alert("Menge muss größer als 0 sein"); return; } setMengeSavingId(pos.id); commitPosField(pos.id, "menge", v, () => setMengeEditId(null)).finally(() => setMengeSavingId(null)); }} disabled={mengeSavingId === pos.id} className="text-green-700 hover:text-green-900 text-xs font-medium">{mengeSavingId === pos.id ? "…" : "✓"}</button>
                        <button onClick={() => setMengeEditId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { if (!canEditPos()) return; setMengeEditId(pos.id); setMengeEditValue(String(pos.menge)); }} disabled={!canEditPos()} className="hover:underline disabled:no-underline disabled:cursor-default" title={canEditPos() ? "Menge bearbeiten" : "Nicht bearbeitbar"}>
                        {pos.menge}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{pos.artikel.einheit}</td>
                  {/* VK – inline edit */}
                  <td className="px-4 py-3 font-mono">
                    {vkEditId === pos.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          step="any"
                          autoFocus
                          value={vkEditValue}
                          onChange={(e) => setVkEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); const v = parseFloat(vkEditValue.replace(",", ".")); if (isNaN(v) || v < 0) { alert("Verkaufspreis ungültig"); return; } setVkSavingId(pos.id); commitPosField(pos.id, "verkaufspreis", v, () => setVkEditId(null)).finally(() => setVkSavingId(null)); } else if (e.key === "Escape") setVkEditId(null);
                          }}
                          className="w-24 border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                        <button onClick={() => { const v = parseFloat(vkEditValue.replace(",", ".")); if (isNaN(v) || v < 0) { alert("Verkaufspreis ungültig"); return; } setVkSavingId(pos.id); commitPosField(pos.id, "verkaufspreis", v, () => setVkEditId(null)).finally(() => setVkSavingId(null)); }} disabled={vkSavingId === pos.id} className="text-green-700 hover:text-green-900 text-xs font-medium">{vkSavingId === pos.id ? "…" : "✓"}</button>
                        <button onClick={() => setVkEditId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { if (!canEditPos()) return; setVkEditId(pos.id); setVkEditValue(String(pos.verkaufspreis)); }} disabled={!canEditPos()} className="hover:underline disabled:no-underline disabled:cursor-default" title={canEditPos() ? "VK bearbeiten" : "Lieferung storniert"}>
                        {formatEuro(pos.verkaufspreis)}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {rabattEditId === pos.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.1}
                          autoFocus
                          value={rabattEditValue}
                          onChange={(e) => setRabattEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              commitRabattEdit(pos.id);
                            } else if (e.key === "Escape") {
                              setRabattEditId(null);
                            }
                          }}
                          className="w-16 border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                        <button
                          onClick={() => commitRabattEdit(pos.id)}
                          disabled={rabattSavingId === pos.id}
                          className="text-green-700 hover:text-green-900 text-xs font-medium"
                        >
                          {rabattSavingId === pos.id ? "…" : "✓"}
                        </button>
                        <button
                          onClick={() => setRabattEditId(null)}
                          className="text-gray-400 hover:text-gray-600 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startRabattEdit(pos)}
                        disabled={lieferung.status === "storniert"}
                        className="hover:underline disabled:no-underline disabled:cursor-not-allowed"
                        title={
                          lieferung.status === "storniert"
                            ? "Lieferung storniert"
                            : "Rabatt bearbeiten"
                        }
                      >
                        {pos.rabattProzent && pos.rabattProzent > 0 ? (
                          <span className="px-1.5 py-0.5 rounded bg-green-100 text-green-700 font-medium">{pos.rabattProzent}%</span>
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono">{formatEuro(pos.einkaufspreis)}</td>
                  <td className="px-4 py-3 font-mono">{formatEuro(margeEuro)}</td>
                  <td className="px-4 py-3">
                    <MargeBadge pct={margePct} />
                  </td>
                  {/* Notiz / Auftragsnr. – inline edit */}
                  <td className="px-4 py-3 text-xs text-gray-600">
                    {notizEditId === pos.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          autoFocus
                          value={notizEditValue}
                          onChange={(e) => setNotizEditValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") { e.preventDefault(); setNotizSavingId(pos.id); commitPosField(pos.id, "notiz", notizEditValue, () => setNotizEditId(null)).finally(() => setNotizSavingId(null)); } else if (e.key === "Escape") setNotizEditId(null);
                          }}
                          placeholder="Auftragsnr. / Notiz…"
                          className="w-36 border border-gray-300 rounded px-1.5 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-green-600"
                        />
                        <button onClick={() => { setNotizSavingId(pos.id); commitPosField(pos.id, "notiz", notizEditValue, () => setNotizEditId(null)).finally(() => setNotizSavingId(null)); }} disabled={notizSavingId === pos.id} className="text-green-700 hover:text-green-900 text-xs font-medium">{notizSavingId === pos.id ? "…" : "✓"}</button>
                        <button onClick={() => setNotizEditId(null)} className="text-gray-400 hover:text-gray-600 text-xs">✕</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => { setNotizEditId(pos.id); setNotizEditValue(pos.notiz ?? ""); }} className="hover:underline text-left w-full" title="Notiz / Auftragsnummer bearbeiten">
                        {pos.notiz ? pos.notiz : <span className="text-gray-300">—</span>}
                      </button>
                    )}
                  </td>
                  {lieferung.status === "geplant" && (
                    <td className="px-2 py-3">
                      <button
                        onClick={() => deletePos(pos.id)}
                        className="text-red-400 hover:text-red-600 text-xs"
                        title="Position löschen"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
            <tr>
              <td colSpan={5} className="px-4 py-3 font-semibold text-gray-700">Gesamt</td>
              <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gesamtUmsatz)}</td>
              <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gesamtEinkauf)}</td>
              <td className="px-4 py-3 font-mono font-semibold">{formatEuro(gesamtMarge)}</td>
              <td className="px-4 py-3">
                <MargeBadge pct={gesamtMargePct} />
              </td>
              <td className="px-4 py-3" />
              {lieferung.status === "geplant" && <td />}
            </tr>
          </tfoot>
        </table>

        {/* Artikel hinzufügen (nur geplant) */}
        {lieferung.status === "geplant" && (
          <div className="border-t border-gray-200 px-4 py-3">
            {!showAddPos ? (
              <button
                onClick={openAddPos}
                className="text-sm text-green-700 hover:text-green-900 font-medium flex items-center gap-1"
              >
                <span className="text-lg leading-none">+</span> Artikel hinzufügen
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-3 items-end">
                  <div className="flex-1 min-w-48">
                    <label className="block text-xs text-gray-500 mb-1">Artikel</label>
                    <select
                      value={addPosArtikelId}
                      onChange={e => onArtikelSelect(e.target.value)}
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                    >
                      <option value="">— Artikel wählen —</option>
                      {artikelListe.map(a => (
                        <option key={a.id} value={String(a.id)}>{a.name}</option>
                      ))}
                    </select>
                  </div>
                  <div className="w-24">
                    <label className="block text-xs text-gray-500 mb-1">Menge</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={addPosMenge}
                      onChange={e => setAddPosMenge(e.target.value)}
                      placeholder="0"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-500 mb-1">VK (€)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={addPosVk}
                      onChange={e => setAddPosVk(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                    />
                  </div>
                  <div className="w-28">
                    <label className="block text-xs text-gray-500 mb-1">EK (€)</label>
                    <input
                      type="number"
                      min={0}
                      step="any"
                      value={addPosEk}
                      onChange={e => setAddPosEk(e.target.value)}
                      placeholder="0.00"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                    />
                  </div>
                  <div className="w-32">
                    <label className="block text-xs text-gray-500 mb-1">Charge (opt.)</label>
                    <input
                      type="text"
                      value={addPosCharge}
                      onChange={e => setAddPosCharge(e.target.value)}
                      placeholder="CH-2026-001"
                      className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-green-700"
                    />
                  </div>
                </div>
                {addPosError && (
                  <p className="text-xs text-red-600">{addPosError}</p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={saveAddPos}
                    disabled={addPosSaving}
                    className="px-3 py-1.5 bg-green-700 hover:bg-green-800 text-white rounded text-sm font-medium disabled:opacity-60"
                  >
                    {addPosSaving ? "Speichern…" : "Hinzufügen"}
                  </button>
                  <button
                    onClick={() => setShowAddPos(false)}
                    className="px-3 py-1.5 border border-gray-300 rounded text-sm hover:bg-gray-50"
                  >
                    Abbrechen
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Storno Modal */}
      {showStornoModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 print:hidden">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h2 className="text-lg font-semibold">Lieferung stornieren</h2>
              <button
                onClick={() => setShowStornoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <form onSubmit={handleStorno} className="p-5 space-y-4">
              {stornoError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {stornoError}
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Begründung <span className="text-red-500">*</span>
                </label>
                <textarea
                  rows={3}
                  value={stornoBegründung}
                  onChange={(e) => setStornoBegrundung(e.target.value)}
                  placeholder="Grund für die Stornierung…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-700 resize-none"
                  required
                />
              </div>
              <div className="flex justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setShowStornoModal(false)}
                  className="px-4 py-2 text-sm text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-colors disabled:opacity-60"
                >
                  {actionLoading ? "Stornieren…" : "Stornieren bestätigen"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
