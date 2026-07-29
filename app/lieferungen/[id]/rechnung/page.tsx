"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { formatEuro, formatDatum, addTage, formatMenge, rundeKaufmaennisch } from "@/lib/utils";
import NextcloudUploadButton from "@/components/NextcloudUploadButton";
import { erzeugeGiroCodeDataUrl } from "@/lib/girocode";
import DokumentFooter from "@/components/DokumentFooter";
import EmailVersandModal, { EmailKontakt } from "@/components/EmailVersandModal";
import RechnungLoeschenModal from "@/components/RechnungLoeschenModal";
import * as Sentry from "@sentry/nextjs";

interface ArtikelInfo {
  id: number;
  name: string;
  einheit: string;
  mwstSatz: number;
  kategorie?: string | null;
  unterkategorie?: string | null;
}

interface Position {
  id: number;
  menge: number;
  verkaufspreis: number;
  einkaufspreis: number;
  rabattProzent?: number | null;
  chargeNr?: string | null;
  notiz?: string | null;
  artikel: ArtikelInfo;
}

interface Kontakt {
  typ: string;
  wert: string;
  label?: string | null;
  vorname?: string | null;
  nachname?: string | null;
  rechnungsEmail?: boolean;
  lieferscheinEmail?: boolean;
}

interface Kunde {
  name: string;
  firma?: string | null;
  strasse?: string | null;
  plz?: string | null;
  ort?: string | null;
  kontakte?: Kontakt[];
}

interface Lieferung {
  id: number;
  datum: string;
  createdAt: string;
  lieferDatum?: string | null;
  rechnungNr?: string | null;
  rechnungDatum?: string | null;
  lieferscheinNr?: string | null;
  rechnungStorniert?: string | null;
  rechnungVersendetAm?: string | null;
  zahlungsziel?: number | null;
  bezahltAm?: string | null;
  notiz?: string | null;
  kundeId: number;
  kunde: Kunde;
  positionen: Position[];
}

export default function RechnungPrintPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [lieferung, setLieferung] = useState<Lieferung | null>(null);
  const [firmaData, setFirmaData] = useState<Record<string, string>>({});
  const [footerData, setFooterData] = useState<Record<string, string>>({});
  const [logo, setLogo] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [giroCode, setGiroCode] = useState<string>("");
  const [canShare, setCanShare] = useState(false);
  const [shareMsg, setShareMsg] = useState("");
  const [mailSending, setMailSending] = useState(false);
  const [mailMsg, setMailMsg] = useState("");
  const [mailModalOffen, setMailModalOffen] = useState(false);
  const [mailFehler, setMailFehler] = useState("");
  const [stornoLoading, setStornoLoading] = useState(false);
  const [istAdmin, setIstAdmin] = useState(false);
  const [loeschModalOpen, setLoeschModalOpen] = useState(false);
  const [loeschLoading, setLoeschLoading] = useState(false);
  const [loeschError, setLoeschError] = useState<string | undefined>(undefined);
  const [lsNrEdit, setLsNrEdit] = useState(false);
  const [lsNrInput, setLsNrInput] = useState("");
  const [lsNrSaving, setLsNrSaving] = useState(false);
  const [reNrEdit, setReNrEdit] = useState(false);
  const [reNrInput, setReNrInput] = useState("");
  const [reNrSaving, setReNrSaving] = useState(false);
  const [rdEdit, setRdEdit] = useState(false);
  const [rdInput, setRdInput] = useState("");
  const [rdSaving, setRdSaving] = useState(false);

  async function handleLsNrSpeichern() {
    setLsNrSaving(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferscheinNr: lsNrInput.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLieferung((prev) => (prev ? { ...prev, lieferscheinNr: updated.lieferscheinNr ?? null } : prev));
        setLsNrEdit(false);
      } else {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setError((d as { error?: string }).error ?? "Lieferschein-Nr. konnte nicht gespeichert werden.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Speichern der Lieferschein-Nr.");
    } finally {
      setLsNrSaving(false);
    }
  }

  async function handleReNrSpeichern() {
    if (!reNrInput.trim()) return;
    setReNrSaving(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rechnungNr: reNrInput.trim() }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLieferung((prev) => (prev ? { ...prev, rechnungNr: updated.rechnungNr ?? prev.rechnungNr } : prev));
        setReNrEdit(false);
      } else {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setError((d as { error?: string }).error ?? "Rechnungsnummer konnte nicht gespeichert werden.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Speichern der Rechnungsnummer.");
    } finally {
      setReNrSaving(false);
    }
  }

  async function handleRdSpeichern() {
    setRdSaving(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rechnungDatum: rdInput.trim() === "" ? null : new Date(rdInput).toISOString(),
        }),
      });
      if (res.ok) {
        const updated = await res.json();
        setLieferung((prev) => (prev ? { ...prev, rechnungDatum: updated.rechnungDatum ?? null } : prev));
        setRdEdit(false);
      } else {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setError((d as { error?: string }).error ?? "Rechnungsdatum konnte nicht gespeichert werden.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Speichern des Rechnungsdatums.");
    } finally {
      setRdSaving(false);
    }
  }

  async function handleStorno() {
    if (!lieferung?.rechnungNr) return;
    const grund = window.prompt(
      `Rechnung ${lieferung.rechnungNr} stornieren?\nSie verschwindet aus der Rechnungsliste. Grund (optional):`,
      "",
    );
    if (grund === null) return; // Abbrechen
    setStornoLoading(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_stornieren", grund }),
      });
      if (res.ok) {
        setLieferung(await res.json());
      } else {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setError((d as { error?: string }).error ?? "Storno fehlgeschlagen.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler beim Storno.");
    } finally {
      setStornoLoading(false);
    }
  }

  async function handleStornoAufheben() {
    if (!lieferung?.rechnungNr) return;
    setStornoLoading(true);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_storno_aufheben" }),
      });
      if (res.ok) {
        setLieferung(await res.json());
      } else {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setError((d as { error?: string }).error ?? "Aktion fehlgeschlagen.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setError("Netzwerkfehler.");
    } finally {
      setStornoLoading(false);
    }
  }

  async function handleLoeschen(begruendung: string) {
    setLoeschLoading(true);
    setLoeschError(undefined);
    try {
      const res = await fetch(`/api/lieferungen/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aktion: "rechnung_loeschen", begruendung }),
      });
      if (res.ok) {
        setLoeschModalOpen(false);
        // Ohne Rechnungsnummer würde diese Seite beim Neuladen sofort eine neue
        // Rechnung erstellen (siehe init()) – daher zurück zur Lieferung navigieren.
        router.push(`/lieferungen/${id}`);
      } else {
        const d = await res.json().catch((err) => {
          Sentry.captureException(err);
          return ({});
        });
        setLoeschError((d as { error?: string }).error ?? "Löschen fehlgeschlagen.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setLoeschError("Netzwerkfehler beim Löschen.");
    } finally {
      setLoeschLoading(false);
    }
  }

  function downloadPdf() {
    const a = document.createElement("a");
    a.href = `/api/exporte/rechnung?lieferungId=${id}`;
    a.download = "";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  // PDF exakt aus der Bildschirm-Vorschau erzeugen (entspricht 1:1 der Ansicht).
  // Mehrseitig, falls die Rechnung länger als eine A4-Seite ist.
  const [vorschauPdfLoading, setVorschauPdfLoading] = useState(false);
  async function downloadVorschauPdf() {
    setVorschauPdfLoading(true);
    try {
      const { default: html2canvas } = await import("html2canvas");
      const { jsPDF } = await import("jspdf");
      const element = document.querySelector<HTMLElement>("[data-print-area]");
      if (!element) return;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgH = (canvas.height * pageW) / canvas.width;
      const imgData = canvas.toDataURL("image/png");
      let heightLeft = imgH;
      let position = 0;
      pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
      heightLeft -= pageH;
      while (heightLeft > 0) {
        position -= pageH;
        pdf.addPage();
        pdf.addImage(imgData, "PNG", 0, position, pageW, imgH);
        heightLeft -= pageH;
      }
      pdf.save(`Rechnung_${(lieferung?.rechnungNr ?? `LS-${id}`).replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`);
    } catch (err) {
      Sentry.captureException(err);
      setError("PDF konnte nicht erzeugt werden.");
    } finally {
      setVorschauPdfLoading(false);
    }
  }

  async function loadLieferung(): Promise<Lieferung | null> {
    const res = await fetch(`/api/lieferungen/${id}`);
    if (!res.ok) {
      setError("Lieferung nicht gefunden.");
      return null;
    }
    return res.json();
  }

  useEffect(() => {
    async function init() {
      setLoading(true);
      try {
        let data = await loadLieferung();
        if (!data) { setLoading(false); return; }

        // If no invoice number yet, create one
        if (!data.rechnungNr) {
          const patchRes = await fetch(`/api/lieferungen/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ aktion: "rechnung_erstellen" }),
          });
          if (patchRes.ok) {
            data = await patchRes.json();
          } else {
            const errBody = await patchRes.json().catch((err) => {
              Sentry.captureException(err);
              return ({});
            });
            // If it failed because one already exists, reload to get current data
            if ((errBody as { error?: string }).error?.includes("bereits")) {
              data = await loadLieferung();
              if (!data) { setLoading(false); return; }
            } else {
              setError((errBody as { error?: string }).error ?? "Fehler beim Erstellen der Rechnungsnummer.");
            }
          }
        }

        setLieferung(data);
      } catch (err) {
        Sentry.captureException(err);
        setError("Fehler beim Laden der Lieferung.");
      } finally {
        setLoading(false);
      }
    }

    init(); // eslint-disable-line react-hooks/exhaustive-deps

    Promise.all([
      fetch("/api/einstellungen?prefix=firma.").then((r) => r.ok ? r.json() : {}),
      fetch("/api/einstellungen?prefix=system.logo").then((r) => r.ok ? r.json() : {}),
      fetch("/api/einstellungen?prefix=dokument.").then((r) => r.ok ? r.json() : {}),
    ]).then(([fd, ld, ftr]) => {
      setFirmaData(fd as Record<string, string>);
      if ((ld as Record<string, string>)["system.logo"]) setLogo((ld as Record<string, string>)["system.logo"]);
      setFooterData(ftr as Record<string, string>);
    }).catch((err) => {
      Sentry.captureException(err);
    });

    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      setCanShare(true);
    }

    fetch("/api/auth/me")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setIstAdmin(d?.user?.rolle === "admin"))
      .catch((err) => {
        Sentry.captureException(err);
        return setIstAdmin(false);
      });
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // GiroCode erzeugen, sobald Firmen- und Rechnungsdaten vorliegen
  useEffect(() => {
    if (!lieferung) { setGiroCode(""); return; }
    const iban = firmaData["firma.iban"] ?? "";
    const bic = firmaData["firma.bic"] ?? "";
    const empfaenger =
      firmaData["firma.firmenname"] ?? firmaData["firma.name"] ?? "";
    if (!iban || !empfaenger) { setGiroCode(""); return; }

    const netto = lieferung.positionen.reduce(
      (s, p) => s + p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100),
      0,
    );
    const mwst = lieferung.positionen.reduce(
      (s, p) => s + p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100) * ((p.artikel.mwstSatz ?? 19) / 100),
      0,
    );
    const brutto = rundeKaufmaennisch(netto + mwst, 2);
    const verwendung = `Rechnung ${lieferung.rechnungNr ?? `LS-${lieferung.id}`}`;

    let cancelled = false;
    erzeugeGiroCodeDataUrl({ empfaenger, iban, bic, betrag: brutto, verwendungszweck: verwendung })
      .then((url) => { if (!cancelled && url) setGiroCode(url); })
      .catch((err) => {
        Sentry.captureException(err);
      });
    return () => { cancelled = true; };
  }, [lieferung, firmaData]);

  async function handleTeilen() {
    if (!lieferung) return;
    const url = typeof window !== "undefined" ? window.location.href : "";
    const title = `Rechnung ${lieferung.rechnungNr ?? `LS-${lieferung.id}`}`;
    const text = `Rechnung ${lieferung.rechnungNr ?? ""} – ${lieferung.kunde.firma ?? lieferung.kunde.name}`;
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        await navigator.share({ title, text, url });
        return;
      }
      if (typeof navigator !== "undefined" && navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        setShareMsg("Link kopiert");
        setTimeout(() => setShareMsg(""), 2500);
      }
    } catch (err) {
      Sentry.captureException(err);
      // Benutzer hat Dialog abgebrochen – ignorieren
    }
  }

  async function handleMailSenden(empfaenger: string, cc: string) {
    setMailSending(true);
    setMailMsg("");
    setMailFehler("");
    try {
      const res = await fetch("/api/exporte/rechnung/mail", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lieferungId: Number(id), empfaenger, cc }),
      });
      const data = await res.json() as { ok?: boolean; empfaenger?: string; error?: string };
      if (data.ok) {
        setMailMsg(`Rechnung an ${data.empfaenger ?? empfaenger} gesendet.`);
        setMailModalOffen(false);
        setLieferung((prev) => (prev ? { ...prev, rechnungVersendetAm: new Date().toISOString() } : prev));
      } else {
        setMailFehler(data.error ?? "Fehler beim Versand.");
      }
    } catch (err) {
      Sentry.captureException(err);
      setMailFehler("Netzwerkfehler beim E-Mail-Versand.");
    } finally {
      setMailSending(false);
    }
  }

  if (loading) {
    return (
      <div className="p-8 text-gray-500 text-sm">
        Rechnung wird vorbereitet…
      </div>
    );
  }

  if (!lieferung) {
    return (
      <div className="p-8">
        <p className="text-red-600 mb-4">{error || "Lieferung nicht gefunden."}</p>
        <Link href="/lieferungen" className="text-green-700 hover:underline text-sm">
          ← Zurück zu Lieferungen
        </Link>
      </div>
    );
  }

  // ---- calculations ----
  const zahlungszielTage = lieferung.zahlungsziel ?? 30;
  const basisDatum = lieferung.rechnungDatum
    ? new Date(lieferung.rechnungDatum)
    : new Date(lieferung.datum);
  const faelligkeitsDatum = addTage(basisDatum, zahlungszielTage);

  // Per-position netto
  const positionenMitNetto = lieferung.positionen.map((p) => ({
    ...p,
    netto: p.menge * p.verkaufspreis * (1 - (p.rabattProzent ?? 0) / 100),
  }));

  const hatRabatt = positionenMitNetto.some((p) => (p.rabattProzent ?? 0) > 0);
  const hatCharge = positionenMitNetto.some((p) => p.chargeNr);
  // Pos., Artikel, Menge, Einheit, Einzelpreis, Gesamt (+ Charge/Rabatt % falls vorhanden) —
  // für colSpan der Betrags-/Notiz-/Zahlungsinfo-Zeilen unterhalb der Positionstabelle.
  const anzahlSpalten = 6 + (hatCharge ? 1 : 0) + (hatRabatt ? 1 : 0);

  // Feste Spaltenbreiten (Summe immer exakt 100%) für die <colgroup> der Positionstabelle.
  // table-layout: fixed + diese Breiten verhindern, dass nicht umbrechbarer Inhalt in den
  // einspaltigen Kopf-/Fußzeilen (Adressblock, DokumentFooter) die Tabelle über die
  // Positions-Spalten hinaus aufbläht und rechts aus dem Seitenrand herausläuft.
  const SPALTE_POS = 6;
  const SPALTE_CHARGE = 14;
  const SPALTE_MENGE = 9;
  const SPALTE_EINHEIT = 9;
  const SPALTE_EINZELPREIS = 13;
  const SPALTE_RABATT = 9;
  const SPALTE_GESAMT = 13;
  const spalteArtikel =
    100 -
    SPALTE_POS -
    (hatCharge ? SPALTE_CHARGE : 0) -
    SPALTE_MENGE -
    SPALTE_EINHEIT -
    SPALTE_EINZELPREIS -
    (hatRabatt ? SPALTE_RABATT : 0) -
    SPALTE_GESAMT;

  const nettobetrag = positionenMitNetto.reduce((s, p) => s + p.netto, 0);

  // MwSt grouping
  const mwstGruppen = positionenMitNetto.reduce<Record<number, number>>((acc, p) => {
    const satz = p.artikel.mwstSatz ?? 19;
    acc[satz] = (acc[satz] ?? 0) + p.netto * (satz / 100);
    return acc;
  }, {});

  const mwstGesamt = Object.values(mwstGruppen).reduce((s, v) => s + v, 0);
  const bruttobetrag = rundeKaufmaennisch(nettobetrag + mwstGesamt, 2);

  const rechnungNr = lieferung.rechnungNr ?? `LS-${lieferung.id}`;
  const rechnungsDatumStr = lieferung.rechnungDatum
    ? formatDatum(lieferung.rechnungDatum)
    : formatDatum(lieferung.datum);
  const lieferDatumStr = formatDatum(lieferung.lieferDatum ?? lieferung.datum);
  // Lieferschein-Nr.: manuell anpassbar, ergibt sich sonst aus dem Auftrag (Lieferungs-ID)
  const lieferscheinNrAnzeige = lieferung.lieferscheinNr?.trim() || String(lieferung.id);

  const EIGENTUMSVORBEHALT_DEFAULT =
    "Die Ware bleibt bis zur vollständigen Bezahlung unser Eigentum.";
  const eigentumsvorbehaltText =
    footerData["dokument.rechnung.eigentumsvorbehalt"]?.trim() || EIGENTUMSVORBEHALT_DEFAULT;

  const firmenname = firmaData["firma.name"] ?? firmaData["firma.firmenname"] ?? "";
  const firmaAdresse = firmaData["firma.strasse"] ?? firmaData["firma.adresse"] ?? "";
  const firmaPlz = firmaData["firma.plz"] ?? "";
  const firmaOrt = firmaData["firma.ort"] ?? "";
  const firmaTel = firmaData["firma.telefon"] ?? firmaData["firma.tel"] ?? "";
  const firmaEmail = firmaData["firma.email"] ?? "";
  const firmaSteuernr = firmaData["firma.steuernummer"] ?? firmaData["firma.steuernr"] ?? "";
  const firmaUstId = firmaData["firma.ustIdNr"] ?? "";
  const firmaOeko = firmaData["firma.oekoNummer"] ?? "";
  const firmaIban = firmaData["firma.iban"] ?? "";
  const firmaBic = firmaData["firma.bic"] ?? "";
  const firmaBankname = firmaData["firma.bank"] ?? firmaData["firma.bankname"] ?? "";


  return (
    <>
      <style>{`
        @media print {
          /* Seitenrand über @page (20 mm) statt Padding – wiederholt sich auf JEDER Seite,
             damit bei mehrseitigen Rechnungen Kopf/Fuß nicht auf Seite 2+ verrutschen.
             Das Anschriftfeld liegt dadurch weiterhin bei 45 mm/20 mm (Fensterkuvert/Binect). */
          @page { margin: 20mm; size: A4 portrait; }
          .print-hidden { display: none !important; }
          body { margin: 0 !important; padding: 0 !important; }
          main { padding: 0 !important; max-width: 100% !important; }
          [data-print-area] { min-height: 0 !important; padding: 0 !important; max-width: 100% !important; margin: 0 !important; }
          tr { page-break-inside: avoid; break-inside: avoid; }
          .no-break { page-break-inside: avoid; break-inside: avoid; }
          .no-break-before { page-break-before: avoid; break-before: avoid; }
          /* Kopf (thead) und Fuß (tfoot) der Dokumenttabelle wiederholen sich automatisch
             auf jeder gedruckten Seite – Kernmechanismus für saubere Mehrseiten-Rechnungen. */
          thead { display: table-header-group; }
          tfoot { display: table-footer-group; }
          .falzmarke { display: block !important; position: fixed; left: 0; width: 10mm; height: 0; border-top: 0.3pt solid #aaa; }
          .falzmarke-1 { top: 105mm; }
          .falzmarke-2 { top: 210mm; }
        }
        .falzmarke { display: none; }
      `}</style>
      <div aria-hidden="true" className="falzmarke falzmarke-1" />
      <div aria-hidden="true" className="falzmarke falzmarke-2" />

      {/* Screen-only controls – sticky so user always has a way out */}
      <div className="print-hidden sticky top-0 z-20 flex items-center flex-wrap gap-1.5 p-2.5 bg-white/95 backdrop-blur border-b border-gray-200 shadow-sm no-print">
        <button
          onClick={() => {
            if (typeof window !== "undefined" && window.history.length > 1) router.back();
            else router.push(`/lieferungen/${id}`);
          }}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors"
          title="Schließen – zurück zur vorherigen Seite"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <button
          onClick={() => window.print()}
          className="flex items-center gap-1.5 px-3 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg transition-colors text-sm"
          title="Drucken"
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
          <span className="hidden sm:inline">Drucken</span>
        </button>
        {lieferung?.rechnungNr && (
          <button
            onClick={downloadVorschauPdf}
            disabled={vorschauPdfLoading}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-700 transition-colors text-sm disabled:opacity-60"
            title="PDF herunterladen – exakt wie diese Vorschau"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">{vorschauPdfLoading ? "Erzeuge…" : "PDF"}</span>
          </button>
        )}
        {lieferung?.rechnungNr && (
          <button
            onClick={downloadPdf}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-gray-500 transition-colors text-sm"
            title="E-Rechnung als PDF mit eingebettetem ZUGFeRD/Factur-X (für Buchhaltung)"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
            <span className="hidden sm:inline">E-Rechnung</span>
          </button>
        )}
        <button
          onClick={handleTeilen}
          className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm"
          title={canShare ? "Rechnung teilen" : "Link kopieren"}
        >
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          <span className="hidden sm:inline">{canShare ? "Teilen" : "Link kopieren"}</span>
        </button>
        {lieferung?.rechnungNr && (
          <button
            onClick={() => { setMailMsg(""); setMailFehler(""); setMailModalOffen(true); }}
            disabled={mailSending}
            className="flex items-center gap-1.5 px-3 py-2 bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white rounded-lg transition-colors text-sm"
            title="Per E-Mail senden"
          >
            {mailSending
              ? <><svg className="w-5 h-5 animate-spin shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg><span className="hidden sm:inline">Sendet…</span></>
              : <><svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg><span className="hidden sm:inline">E-Mail</span></>
            }
          </button>
        )}
        {lieferung && (
          <NextcloudUploadButton
            kundeId={lieferung.kunde ? (lieferung as unknown as { kundeId: number }).kundeId ?? 0 : 0}
            typ="rechnung"
            dateiName={`Rechnung_${lieferung.rechnungNr ?? `LS-${lieferung.id}`}.pdf`}
            getInhalt={async () => {
              try {
                const { default: html2canvas } = await import("html2canvas");
                const { jsPDF } = await import("jspdf");
                const element = document.querySelector<HTMLElement>("[data-print-area]");
                if (!element) return null;
                const canvas = await html2canvas(element, { scale: 2, useCORS: true });
                const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
                const imgData = canvas.toDataURL("image/png");
                const pdfWidth = pdf.internal.pageSize.getWidth();
                const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
                pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
                return pdf.output("datauristring").split(",")[1];
              } catch (err) {
                Sentry.captureException(err);
                return null;
              }
            }}
          />
        )}
        {lieferung?.rechnungNr && !lieferung.rechnungStorniert && (
          <button
            onClick={handleStorno}
            disabled={stornoLoading}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50 rounded-lg transition-colors text-sm"
            title="Rechnung stornieren – verschwindet aus der Rechnungsliste"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <span className="hidden sm:inline">Stornieren</span>
          </button>
        )}
        {lieferung?.rechnungNr && lieferung.rechnungStorniert && (
          <button
            onClick={handleStornoAufheben}
            disabled={stornoLoading}
            className="flex items-center gap-1.5 px-3 py-2 border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 rounded-lg transition-colors text-sm"
            title="Storno aufheben – Rechnung erscheint wieder in der Liste"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" /></svg>
            <span className="hidden sm:inline">Storno aufheben</span>
          </button>
        )}
        {istAdmin && lieferung?.rechnungNr && (
          <button
            onClick={() => { setLoeschError(undefined); setLoeschModalOpen(true); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-red-300 text-red-700 hover:bg-red-100 rounded-lg transition-colors text-sm"
            title="Rechnung endgültig löschen (nur Administratoren)"
          >
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            <span className="hidden sm:inline">Löschen</span>
          </button>
        )}
        {lieferung?.rechnungVersendetAm && (
          <span
            className="inline-flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-2 py-1 ml-1"
            title={`Rechnung wurde per E-Mail versendet am ${formatDatum(lieferung.rechnungVersendetAm)}`}
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
            Per E-Mail versendet ({formatDatum(lieferung.rechnungVersendetAm)})
          </span>
        )}
        {shareMsg && (
          <span className="text-xs text-green-700 font-medium ml-1">{shareMsg}</span>
        )}
        {mailMsg && (
          <span className={`text-xs font-medium ml-1 ${mailMsg.includes("gesendet") ? "text-green-700" : "text-red-600"}`}>
            {mailMsg}
          </span>
        )}
        {error && (
          <span className="text-sm text-red-600 ml-1">{error}</span>
        )}
      </div>

      <RechnungLoeschenModal
        open={loeschModalOpen}
        rechnungNr={lieferung?.rechnungNr ?? ""}
        loading={loeschLoading}
        error={loeschError}
        onClose={() => { if (!loeschLoading) setLoeschModalOpen(false); }}
        onConfirm={handleLoeschen}
      />

      {lieferung && (
        <EmailVersandModal
          open={mailModalOffen}
          onClose={() => setMailModalOffen(false)}
          title={`Rechnung ${lieferung.rechnungNr ?? ""} versenden`}
          kundenname={lieferung.kunde.firma ?? lieferung.kunde.name}
          emailKontakte={(lieferung.kunde.kontakte ?? []).filter((k) => k.typ === "email") as EmailKontakt[]}
          docType="rechnung"
          loading={mailSending}
          fehler={mailFehler || undefined}
          onSend={handleMailSenden}
        />
      )}

      {/* Rechnung document – als <table> aufgebaut, damit thead/tfoot beim Druck auf
          JEDER Seite wiederholt werden (Kopf + Fuß bei mehrseitigen Rechnungen). */}
      <div
        data-print-area
        style={{
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: "11pt",
          color: "#000",
          maxWidth: "210mm",
          margin: "0 auto",
          // 20 mm rundum = DIN-Rand; identisch auf Bildschirm, im PDF (html2canvas)
          // und im Druck (dort via @page-Margin statt Padding), damit das Anschriftfeld
          // immer bei 45 mm/20 mm sitzt.
          padding: "20mm",
          background: "#fff",
          position: "relative",
        }}
      >
      {/* table-layout: fixed + explizite <colgroup>-Breiten: verhindert, dass nicht
          umbrechbarer Inhalt in den einspaltigen Kopf-/Fußzeilen (Adressblock,
          DokumentFooter) die Tabelle über die 8 schmalen Positions-Spalten hinaus
          aufbläht und dadurch rechts aus dem Seitenrand herausläuft. Ohne fixed
          layout bestimmt der Browser die Spaltenbreiten aus dem breitesten Inhalt
          über ALLE Zeilen hinweg (inkl. der colSpan-Zeilen). */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <colgroup>
        <col style={{ width: `${SPALTE_POS}%` }} />
        <col style={{ width: `${spalteArtikel}%` }} />
        {hatCharge && <col style={{ width: `${SPALTE_CHARGE}%` }} />}
        <col style={{ width: `${SPALTE_MENGE}%` }} />
        <col style={{ width: `${SPALTE_EINHEIT}%` }} />
        <col style={{ width: `${SPALTE_EINZELPREIS}%` }} />
        {hatRabatt && <col style={{ width: `${SPALTE_RABATT}%` }} />}
        <col style={{ width: `${SPALTE_GESAMT}%` }} />
      </colgroup>
      <thead>
      <tr>
      <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
        {/* Storno-Hinweis */}
        {lieferung.rechnungStorniert && (
          <div
            style={{
              border: "2px solid #dc2626",
              color: "#dc2626",
              fontWeight: "bold",
              textAlign: "center",
              padding: "8px",
              marginBottom: "16px",
              letterSpacing: "0.1em",
              textTransform: "uppercase",
            }}
          >
            Storniert – {formatDatum(lieferung.rechnungStorniert)}
          </div>
        )}

        {/* Briefkopf – feste Höhe (25 mm), damit das Anschriftfeld immer bei 45 mm
            beginnt (Padding 20 mm + 25 mm). */}
        <div style={{ position: "relative", height: "25mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            {logo && (
              <img
                src={logo}
                alt="Logo"
                style={{ height: "56px", marginBottom: "4px", display: "block" }}
              />
            )}
            {firmenname && (
              <div style={{ fontWeight: "bold", fontSize: "12pt" }}>
                {firmenname}
              </div>
            )}
          </div>

          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16pt", fontWeight: "bold", marginBottom: "2px" }}>
              Rechnung
            </div>
            <table style={{ fontSize: "9pt", borderCollapse: "collapse", marginLeft: "auto", lineHeight: 1.15 }}>
              <tbody>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Rechnungsnummer:</td>
                  <td style={{ fontWeight: "bold", fontFamily: "monospace" }}>
                    {reNrEdit ? (
                      <span className="print-hidden" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <input
                          value={reNrInput}
                          onChange={(e) => setReNrInput(e.target.value)}
                          style={{ width: "140px", fontSize: "10pt", padding: "1px 4px", border: "1px solid #bbb", borderRadius: "3px", fontFamily: "monospace" }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleReNrSpeichern(); else if (e.key === "Escape") setReNrEdit(false); }}
                        />
                        <button onClick={handleReNrSpeichern} disabled={reNrSaving} title="Speichern" style={{ color: "#15803d", fontWeight: "bold", cursor: "pointer" }}>✓</button>
                        <button onClick={() => setReNrEdit(false)} disabled={reNrSaving} title="Abbrechen" style={{ color: "#999", cursor: "pointer" }}>✕</button>
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>{rechnungNr}</span>
                        <button
                          className="print-hidden"
                          onClick={() => { setReNrInput(lieferung.rechnungNr ?? ""); setReNrEdit(true); }}
                          title="Rechnungsnummer anpassen"
                          style={{ color: "#2563eb", fontSize: "9pt", cursor: "pointer", fontFamily: "sans-serif", fontWeight: "normal" }}
                        >✎</button>
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Rechnungsdatum:</td>
                  <td>
                    {rdEdit ? (
                      <span className="print-hidden" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <input
                          type="date"
                          value={rdInput}
                          onChange={(e) => setRdInput(e.target.value)}
                          style={{ fontSize: "10pt", padding: "1px 4px", border: "1px solid #bbb", borderRadius: "3px" }}
                          autoFocus
                          onKeyDown={(e) => { if (e.key === "Enter") handleRdSpeichern(); else if (e.key === "Escape") setRdEdit(false); }}
                        />
                        <button onClick={handleRdSpeichern} disabled={rdSaving} title="Speichern" style={{ color: "#15803d", fontWeight: "bold", cursor: "pointer" }}>✓</button>
                        <button onClick={() => setRdEdit(false)} disabled={rdSaving} title="Abbrechen" style={{ color: "#999", cursor: "pointer" }}>✕</button>
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>{rechnungsDatumStr}</span>
                        <button
                          className="print-hidden"
                          onClick={() => {
                            setRdInput(
                              (lieferung.rechnungDatum ?? lieferung.datum)
                                ? new Date(lieferung.rechnungDatum ?? lieferung.datum).toISOString().slice(0, 10)
                                : "",
                            );
                            setRdEdit(true);
                          }}
                          title="Rechnungsdatum anpassen"
                          style={{ color: "#2563eb", fontSize: "9pt", cursor: "pointer", fontFamily: "sans-serif", fontWeight: "normal" }}
                        >✎</button>
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555", verticalAlign: "top" }}>Lieferschein-Nr.:</td>
                  <td>
                    {lsNrEdit ? (
                      <span className="print-hidden" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                        <input
                          value={lsNrInput}
                          onChange={(e) => setLsNrInput(e.target.value)}
                          placeholder={String(lieferung.id)}
                          style={{ width: "100px", fontSize: "10pt", padding: "1px 4px", border: "1px solid #bbb", borderRadius: "3px", textAlign: "right" }}
                          autoFocus
                        />
                        <button onClick={handleLsNrSpeichern} disabled={lsNrSaving} title="Speichern" style={{ color: "#15803d", fontWeight: "bold", cursor: "pointer" }}>✓</button>
                        <button onClick={() => setLsNrEdit(false)} disabled={lsNrSaving} title="Abbrechen" style={{ color: "#999", cursor: "pointer" }}>✕</button>
                      </span>
                    ) : (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <span>{lieferscheinNrAnzeige}</span>
                        <button
                          className="print-hidden"
                          onClick={() => { setLsNrInput(lieferung.lieferscheinNr ?? ""); setLsNrEdit(true); }}
                          title="Lieferschein-Nr. anpassen"
                          style={{ color: "#2563eb", fontSize: "9pt", cursor: "pointer" }}
                        >✎</button>
                      </span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Lieferdatum:</td>
                  <td>{lieferDatumStr}</td>
                </tr>
                <tr>
                  <td style={{ paddingRight: "8px", color: "#555" }}>Fällig am:</td>
                  <td style={{ fontWeight: "bold" }}>{formatDatum(faelligkeitsDatum)}</td>
                </tr>
              </tbody>
            </table>
          </div>
          </div>
        </div>

        {/* Anschriftfeld nach DIN 5008 / Binect: feste Höhe 45 mm (ab 45 mm bis 90 mm),
            Breite 85 mm, linker Rand = Padding (20 mm). Absenderzeile in der Zusatzzone
            (45–55 mm), Empfängeranschrift ab 55 mm. Im Fenster darf nichts anderes stehen. */}
        <div style={{ height: "45mm", width: "85mm", overflow: "hidden" }}>
          {/* Absenderzeile – Zusatzzone 45–55 mm */}
          <div style={{ height: "10mm" }}>
            {(firmenname || firmaAdresse || firmaPlz || firmaOrt) && (
              <div
                style={{
                  fontSize: "7pt",
                  color: "#555",
                  paddingBottom: "2px",
                  borderBottom: "0.5pt solid #aaa",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {[
                  firmenname,
                  firmaAdresse,
                  [firmaPlz, firmaOrt].filter(Boolean).join(" "),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
            )}
          </div>
          {/* Empfängeranschrift – Anschriftzone ab 55 mm */}
          <div style={{ fontWeight: "bold", fontSize: "12pt" }}>
            {lieferung.kunde.firma
              ? lieferung.kunde.firma
              : lieferung.kunde.name}
          </div>
          {lieferung.kunde.firma && (
            <div style={{ fontSize: "10pt" }}>{lieferung.kunde.name}</div>
          )}
          {lieferung.kunde.strasse && (
            <div style={{ fontSize: "10pt" }}>{lieferung.kunde.strasse}</div>
          )}
          {(lieferung.kunde.plz || lieferung.kunde.ort) && (
            <div style={{ fontSize: "10pt" }}>
              {[lieferung.kunde.plz, lieferung.kunde.ort].filter(Boolean).join(" ")}
            </div>
          )}
        </div>

        {/* Betreff – beginnt unterhalb des Anschriftfelds (≈ 92 mm) */}
        <div style={{ marginTop: "8px", marginBottom: "20px", fontSize: "11pt" }}>
          <strong>Betreff: Rechnung {rechnungNr}</strong>
        </div>
      </td>
      </tr>
      </thead>
      <tbody>
      {/* Spaltenkopf der Positionstabelle — bewusst eine normale Zeile DIESER (äußeren)
          Tabelle statt einer verschachtelten <table><thead>: eine Rechnung mit vielen
          Positionen ist länger als eine Seite, und ein <tr> darf beim Druck nur dann
          sauber pro Zeile umbrechen, wenn es eine direkte Zeile der Tabelle ist, deren
          Paginierung gerade läuft. Eine verschachtelte Tabelle innerhalb einer einzigen
          äußeren Zeile wird als ein Block behandelt — der Browser bricht dann mitten in
          einer Positionszeile um, statt ganze Zeilen auf die nächste Seite zu schieben. */}
      <tr className="no-break" style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Pos.</th>
        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Artikel</th>
        {hatCharge && <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Charge</th>}
        <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Menge</th>
        <th style={{ textAlign: "left", padding: "6px 8px", fontWeight: "600" }}>Einheit</th>
        <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Einzelpreis</th>
        {hatRabatt && <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Rabatt %</th>}
        <th style={{ textAlign: "right", padding: "6px 8px", fontWeight: "600" }}>Gesamt</th>
      </tr>
      {positionenMitNetto.map((p, idx) => (
        <tr
          key={p.id}
          style={{
            borderBottom: "1px solid #ddd",
            backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
          }}
        >
          <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{idx + 1}</td>
          <td style={{ padding: "6px 8px", verticalAlign: "top" }}>
            {(p.artikel.kategorie || p.artikel.unterkategorie) && (
              <div style={{ fontSize: "8pt", color: "#888", marginBottom: "2px" }}>
                {[p.artikel.kategorie === "Duenger" ? "Dünger" : p.artikel.kategorie, p.artikel.unterkategorie].filter(Boolean).join(" / ")}
              </div>
            )}
            <div>
              <Link href={`/artikel/${p.artikel.id}`} style={{ color: "inherit", textDecoration: "underline" }}>
                {p.artikel.name}
              </Link>
            </div>
            {p.notiz && p.notiz.trim().length > 0 && (
              <div style={{ fontSize: "9pt", color: "#555" }}>{p.notiz}</div>
            )}
            <div style={{ fontSize: "9pt", color: "#666" }}>
              MwSt {p.artikel.mwstSatz ?? 19} %
            </div>
          </td>
          {hatCharge && (
            <td style={{ padding: "6px 8px", verticalAlign: "top", fontFamily: "monospace", fontSize: "9pt", color: "#555" }}>
              {p.chargeNr ?? "—"}
            </td>
          )}
          <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
            {formatMenge(p.menge)}
          </td>
          <td style={{ padding: "6px 8px", verticalAlign: "top" }}>{p.artikel.einheit}</td>
          <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
            {formatEuro(p.verkaufspreis)}
          </td>
          {hatRabatt && (
            <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right" }}>
              {(p.rabattProzent ?? 0) > 0 ? `${p.rabattProzent} %` : ""}
            </td>
          )}
          <td style={{ padding: "6px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
            {formatEuro(p.netto)}
          </td>
        </tr>
      ))}

      {/* Betragsblock — eigene Zeile (colSpan über alle Spalten), damit sie beim Druck
          als Ganzes auf die nächste Seite wandert statt mitten drin abzureißen. */}
      <tr className="no-break-before no-break">
        <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "16px", marginBottom: "32px" }}>
            <table style={{ fontSize: "10pt", borderCollapse: "collapse", minWidth: "260px" }}>
              <tbody>
                <tr>
                  <td style={{ padding: "4px 10px", color: "#444" }}>Nettobetrag:</td>
                  <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                    {formatEuro(nettobetrag)}
                  </td>
                </tr>
                {Object.entries(mwstGruppen)
                  .sort(([a], [b]) => Number(a) - Number(b))
                  .map(([satz, betrag]) => (
                    <tr key={satz}>
                      <td style={{ padding: "4px 10px", color: "#444" }}>
                        MwSt {satz} %:
                      </td>
                      <td style={{ padding: "4px 10px", textAlign: "right", fontFamily: "monospace" }}>
                        {formatEuro(betrag)}
                      </td>
                    </tr>
                  ))}
                <tr style={{ borderTop: "2px solid #333" }}>
                  <td style={{ padding: "6px 10px", fontWeight: "bold", fontSize: "12pt" }}>
                    Bruttobetrag:
                  </td>
                  <td style={{ padding: "6px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: "bold", fontSize: "12pt" }}>
                    {formatEuro(bruttobetrag)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </td>
      </tr>

      {/* Notiz zur Lieferung – über der Zahlungsbox, damit auch bei langen Rechnungen sichtbar */}
      {lieferung.notiz && lieferung.notiz.trim().length > 0 && (
        <tr className="no-break">
          <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
            <div
              style={{
                marginBottom: "16px",
                fontSize: "9pt",
                color: "#555",
                fontStyle: "italic",
                whiteSpace: "pre-line",
              }}
            >
              Hinweis: {lieferung.notiz}
            </div>
          </td>
        </tr>
      )}

      {/* Zahlungsinfo — eigene Zeile, wandert beim Druck als Ganzes auf die nächste Seite */}
      <tr className="no-break">
        <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
          <div
            style={{
              backgroundColor: "#f9f9f9",
              border: "1px solid #ddd",
              borderRadius: "4px",
              padding: "12px 16px",
              marginBottom: "32px",
              fontSize: "10pt",
              display: "flex",
              gap: "16px",
              alignItems: "flex-start",
              justifyContent: "space-between",
            }}
          >
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: "bold", marginBottom: "6px" }}>Zahlungsinformationen</div>
              <div style={{ marginBottom: "4px" }}>
                Bitte überweisen Sie den Betrag von{" "}
                <strong>{formatEuro(bruttobetrag)}</strong> bis zum{" "}
                <strong>{formatDatum(faelligkeitsDatum)}</strong> unter Angabe der
                Rechnungsnummer <strong>{rechnungNr}</strong>.
              </div>
              {(firmaIban || firmaBic || firmaBankname) && (
                <div style={{ marginTop: "8px", color: "#333" }}>
                  {firmaBankname && <div>Bank: {firmaBankname}</div>}
                  <div style={{ marginTop: "4px" }}>
                    {firmaIban && <span>IBAN: {firmaIban}</span>}
                    {firmaBic && <span style={{ marginLeft: "16px" }}>BIC: {firmaBic}</span>}
                  </div>
                </div>
              )}
            </div>
            {giroCode && (
              <div style={{ textAlign: "center", flexShrink: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={giroCode}
                  alt="GiroCode – per Banking-App scannen"
                  style={{ width: "110px", height: "110px", display: "block" }}
                />
                <div style={{ fontSize: "8pt", color: "#666", marginTop: "2px" }}>
                  Scan &amp; Pay
                </div>
              </div>
            )}
          </div>
        </td>
      </tr>
      </tbody>
      <tfoot>
      <tr>
      <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
        {/* Eigentumsvorbehalt / rechtlicher Hinweis – klein gedruckt */}
        <div
          style={{
            paddingTop: "12px",
            fontSize: "7.5pt",
            color: "#666",
            fontStyle: "italic",
            whiteSpace: "pre-line",
          }}
        >
          {eigentumsvorbehaltText}
        </div>

        {/* Footer – 3 Spalten */}
        <DokumentFooter firmaData={firmaData} footerConfig={footerData} marginTop="8px" />
      </td>
      </tr>
      </tfoot>
      </table>
      </div>
    </>
  );
}
