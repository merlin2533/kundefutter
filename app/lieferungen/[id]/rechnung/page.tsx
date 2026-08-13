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
      const footerEl = document.querySelector<HTMLElement>("[data-doc-footer]");
      if (!element) return;

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      // Entspricht dem 20mm-Padding von [data-print-area] – die Fußzeile sitzt im
      // Dokument innerhalb dieses Rands, also stempeln wir sie hier an derselben Stelle.
      const RAND_MM = 20;
      const inhaltBreiteMM = pageW - 2 * RAND_MM;

      // Fußzeile getrennt vom Hauptinhalt erfassen, BEVOR der Hauptinhalt gescreenshottet
      // wird: html2canvas macht dabei nur ein einziges durchgehendes Bild (keine echten
      // "Seiten"), das anschließend blind in pageH-Schritten zerschnitten wird. Ein
      // <tfoot>/thead-Wiederholungsmechanismus wie beim echten Browserdruck greift hier
      // nicht. Damit die Fußzeile trotzdem auf JEDER erzeugten PDF-Seite erscheint (nicht
      // nur zufällig auf der, in die sie im langen Screenshot hineinfällt), wird sie hier
      // 1x separat als Bild erfasst, aus dem Hauptbild ausgeblendet (damit ihre Höhe nicht
      // doppelt eingerechnet wird) und danach auf jede Seite einzeln aufgestempelt.
      let footerImgData: string | null = null;
      let footerHoeheMM = 0;
      const vorherigesDisplay = footerEl?.style.display ?? "";
      if (footerEl) {
        const footerCanvas = await html2canvas(footerEl, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
        footerImgData = footerCanvas.toDataURL("image/png");
        footerHoeheMM = (footerCanvas.height * inhaltBreiteMM) / footerCanvas.width;
        footerEl.style.display = "none";
      }

      // Zeilen-Grenzen VOR dem Screenshot ermitteln (während footerEl noch ausgeblendet
      // ist, damit die Koordinaten zum gleich danach erfassten canvas passen): so kann
      // die Schnittstelle jeder Seite so weit nach vorne verschoben werden, dass keine
      // <tr> (Positionszeile, Betragsblock, Notiz, Zahlungsinfo) mittendrin durchtrennt
      // wird — sonst reißt html2canvas' reine Pixel-Rasterung Inhalte wie die
      // Zahlungsinfo-Box unabhängig von jeder page-break-CSS-Regel einfach durch, weil
      // diese nur in @media print gilt, hier aber im normalen Bildschirm-Layout
      // geschossen wird.
      const elementRectVorher = element.getBoundingClientRect();
      const zeilenBereiche = Array.from(element.querySelectorAll("tr")).map((tr) => {
        const r = tr.getBoundingClientRect();
        return { top: r.top - elementRectVorher.top, bottom: r.bottom - elementRectVorher.top };
      });

      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
      if (footerEl) footerEl.style.display = vorherigesDisplay;

      // WICHTIG: canvas.width/elementRectVorher.width (Canvas-Pixel je CSS-Pixel, hier
      // ≈ 2 wegen scale:2) ist ein ANDERER Faktor als canvas.width/pageW (Canvas-Pixel
      // je Millimeter, s.u. für die Seitenaufteilung) — getBoundingClientRect() liefert
      // CSS-Pixel, keine Millimeter. Beide Faktoren zu verwechseln war der Grund, warum
      // eine erste Version dieses Fixes die Zeilengrenzen nie richtig traf.
      const canvasPxProCssPx = canvas.width / elementRectVorher.width;
      const zeilenBereichePx = zeilenBereiche.map((z) => ({ top: z.top * canvasPxProCssPx, bottom: z.bottom * canvasPxProCssPx }));
      const pxProMM = canvas.width / pageW;

      const zeichneFooter = () => {
        if (!footerImgData) return;
        pdf.addImage(footerImgData, "PNG", RAND_MM, pageH - RAND_MM - footerHoeheMM, inhaltBreiteMM, footerHoeheMM);
      };

      // Echtes Zuschneiden statt bloßes Verschieben des Gesamtbilds: pxProMM ist der
      // Skalierungsfaktor des html2canvas-Bilds (Breite canvas.width entspricht exakt
      // pageW mm). Jede Seite bekommt einen eigenen, nicht überlappenden Bildausschnitt –
      // vorher wurde stattdessen dasselbe Gesamtbild nur verschoben und jedes Mal komplett
      // auf eine volle pageH-Seite gezeichnet, wodurch sich aufeinanderfolgende Seiten
      // überlappten (derselbe Inhalt erschien doppelt).
      //
      // WICHTIG: zeichneFooter() setzt die Fußzeile bei pageH - RAND_MM - footerHoeheMM
      // (sie sitzt innerhalb des unteren 20mm-Rands). Die reservierte Höhe muss deshalb
      // RAND_MM MIT einschließen, nicht nur footerHoeheMM — sonst darf der Hauptinhalt
      // bis knapp vor den unteren Papierrand reichen, während die Fußzeile schon 20mm
      // weiter oben beginnt, und beide überlappen sich (sah aus wie eine mittendrin
      // abgeschnittene Positionszeile).
      const footerReserveMM = footerImgData ? RAND_MM + footerHoeheMM + 2 : RAND_MM;

      // Echtes Inhaltsende statt canvas.height: [data-print-area] hat unten 20mm eigenes
      // Padding, das nach dem Ausblenden der Fußzeile als reine Weißfläche am Ende des
      // Screenshots übrig bleibt. Passte dieser Rest nicht mehr auf die letzte Seite
      // (Rundungsfälle, knapper Umbruch), erzeugte die Schleife dafür eine komplett leere
      // Extra-Seite. Die eigene Fußzeilen-Reserve (footerReserveMM) sorgt ohnehin schon
      // für genug Abstand vor der gestempelten Fußzeile — das Padding selbst wird für die
      // Seitenaufteilung ignoriert.
      const inhaltEndeY = zeilenBereichePx.length
        ? Math.min(canvas.height, Math.max(...zeilenBereichePx.map((z) => z.bottom)))
        : canvas.height;

      // Verschiebt eine gewünschte Schnittstelle nach vorne (auf den Anfang der
      // betroffenen Zeile), falls sie eine Zeile mittendrin durchtrennen würde.
      function schnittOhneZeilenbruch(startY: number, wunschEndY: number): number {
        if (wunschEndY >= inhaltEndeY) return wunschEndY;
        let minTop = wunschEndY;
        for (const z of zeilenBereichePx) {
          if (z.top < wunschEndY && z.bottom > wunschEndY && z.top < minTop) {
            minTop = z.top;
          }
        }
        // Sicherheitsnetz: keine Endlosschleife/leere Seite, falls eine einzelne Zeile
        // höher als eine ganze Seite ist – dann lieber durchschneiden als hängen bleiben.
        return minTop > startY ? minTop : wunschEndY;
      }

      let quellY = 0;
      let seitenIndex = 0;
      while (quellY < inhaltEndeY) {
        const istErsteSeite = seitenIndex === 0;
        // Seite 1 hat das 20mm-Padding von [data-print-area] bereits als echte, im
        // Screenshot enthaltene Weißfläche am Anfang – dort braucht es keinen weiteren
        // Rand. Auf Folgeseiten beginnt der zugeschnittene Bildausschnitt dagegen exakt an
        // einer Zeilengrenze, ohne jeden Rand — Inhalt säße sonst direkt an der
        // Papierkante. Deshalb wird dort ein synthetischer oberer Rand (RAND_MM)
        // freigehalten und das Bild entsprechend tiefer eingefügt.
        const obenMM = istErsteSeite ? 0 : RAND_MM;
        const nutzbareHoeheMM = Math.max(50, pageH - footerReserveMM - obenMM);
        const sliceHoehePx = Math.max(1, Math.round(nutzbareHoeheMM * pxProMM));

        const schnittY = schnittOhneZeilenbruch(quellY, Math.min(quellY + sliceHoehePx, inhaltEndeY));
        const aktuelleHoehePx = schnittY - quellY;
        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = canvas.width;
        sliceCanvas.height = aktuelleHoehePx;
        const ctx = sliceCanvas.getContext("2d");
        if (ctx) {
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
          ctx.drawImage(canvas, 0, quellY, canvas.width, aktuelleHoehePx, 0, 0, canvas.width, aktuelleHoehePx);
        }
        const sliceImgData = sliceCanvas.toDataURL("image/png");
        const sliceHoeheMM = aktuelleHoehePx / pxProMM;

        if (!istErsteSeite) pdf.addPage();
        pdf.addImage(sliceImgData, "PNG", 0, obenMM, pageW, sliceHoeheMM);
        zeichneFooter();

        quellY = schnittY;
        seitenIndex++;
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

  // Feste Spaltenbreiten (Summe immer exakt 100%), direkt als width-Hinweis auf den
  // <th>-Zellen der Positionstabelle (nicht via <colgroup> + table-layout: fixed — siehe
  // Kommentar an der Tabelle weiter unten, warum das auf iOS/WebKit unzuverlässig war).
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
          /* Kopf (thead) wiederholt sich auf Folgeseiten in Chrome/Firefox (CSS2.1); in
             WebKit (Safari/iOS) NICHT (bekannte Einschränkung, siehe Kommentar bei der
             Fußzeile weiter unten) – dort erscheinen die Spaltenköpfe nur auf Seite 1. Die
             Fußzeile ist bewusst kein <tfoot> mehr (siehe dort), daher keine
             table-footer-group-Regel nötig. */
          thead { display: table-header-group; }
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
          // Bewusst IMMER zur Lieferung selbst (nicht router.back()): direkt nach dem
          // Anlegen einer Lieferung/Rechnung landet man hier über einen router.push() von
          // /lieferungen/neu bzw. dem Lieferschein — history.back() würde dann auf das
          // (jetzt leere) Neu-Formular zurückspringen statt auf die soeben erfasste
          // Lieferung.
          onClick={() => router.push(`/lieferungen/${id}`)}
          className="p-2 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-300 rounded-lg transition-colors"
          title="Schließen – zur Lieferung"
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

      {/* Rechnung document: Briefkopf einmalig oben (normale <div>s), darunter die
          Positionstabelle mit thead (Spaltenköpfe, wiederholen sich auf Folgeseiten)
          und tfoot (Fußzeile, wiederholt sich auf JEDER Seite). */}
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
      {/* Briefkopf (Storno/Logo/Anschriftfeld/Betreff) bewusst AUSSERHALB der Tabelle als
          normale <div>s: er gehört ohnehin nur auf Seite 1 (analog zum PDF-Export, ein
          DIN-5008-Fensterkuvert braucht die Adresse nur einmal) und entkoppelt diesen
          großen, layout-komplexen Block komplett von der Spaltenbreiten-Berechnung der
          Positionstabelle darunter. */}
      <div>
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
      </div>

      {/* Positionstabelle: eigenständige Tabelle mit echtem <thead> (Spaltenköpfe
          wiederholen sich dadurch nativ auf Folgeseiten) und <tfoot> (Fußzeile
          wiederholt sich auf jeder Seite). table-layout: fixed leitet die Spaltenbreiten
          aus den width-Werten der <th>-Zellen ab (CSS2.1-Standardverhalten, keine
          <colgroup> nötig) — das hält die Tabelle zuverlässig innerhalb des Seitenrands,
          ohne die Kollaps-Probleme, die table-layout: fixed + <colgroup> beim Mischen mit
          colSpan-Zeilen auf iOS/WebKit verursacht hat. Positionszeilen sind direkte Zeilen
          dieser Tabelle (keine verschachtelte <table>), damit der Browser beim Druck jede
          Zeile als Ganzes auf die nächste Seite schiebt statt mittendrin umzubrechen. */}
      <table style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
      <thead>
      <tr style={{ borderBottom: "2px solid #333", backgroundColor: "#f5f5f5" }}>
        <th style={{ width: `${SPALTE_POS}%`, textAlign: "left", padding: "5px 8px", fontWeight: "600" }}>Pos.</th>
        <th style={{ width: `${spalteArtikel}%`, textAlign: "left", padding: "5px 8px", fontWeight: "600" }}>Artikel</th>
        {hatCharge && <th style={{ width: `${SPALTE_CHARGE}%`, textAlign: "left", padding: "5px 8px", fontWeight: "600" }}>Charge</th>}
        <th style={{ width: `${SPALTE_MENGE}%`, textAlign: "right", padding: "5px 8px", fontWeight: "600" }}>Menge</th>
        <th style={{ width: `${SPALTE_EINHEIT}%`, textAlign: "left", padding: "5px 8px", fontWeight: "600" }}>Einheit</th>
        <th style={{ width: `${SPALTE_EINZELPREIS}%`, textAlign: "right", padding: "5px 8px", fontWeight: "600" }}>Einzelpreis</th>
        {hatRabatt && <th style={{ width: `${SPALTE_RABATT}%`, textAlign: "right", padding: "5px 8px", fontWeight: "600" }}>Rabatt %</th>}
        <th style={{ width: `${SPALTE_GESAMT}%`, textAlign: "right", padding: "5px 8px", fontWeight: "600" }}>Gesamt</th>
      </tr>
      </thead>
      <tbody>
      {positionenMitNetto.map((p, idx) => (
        <tr
          key={p.id}
          style={{
            borderBottom: "1px solid #ddd",
            backgroundColor: idx % 2 === 0 ? "#fff" : "#fafafa",
          }}
        >
          <td style={{ padding: "3px 8px", verticalAlign: "top" }}>{idx + 1}</td>
          <td style={{ padding: "3px 8px", verticalAlign: "top" }}>
            {(p.artikel.kategorie || p.artikel.unterkategorie) && (
              <div style={{ fontSize: "7.5pt", color: "#888", lineHeight: 1.3 }}>
                {[p.artikel.kategorie === "Duenger" ? "Dünger" : p.artikel.kategorie, p.artikel.unterkategorie].filter(Boolean).join(" / ")}
              </div>
            )}
            <div>
              <Link href={`/artikel/${p.artikel.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                {p.artikel.name}
              </Link>
            </div>
            {p.notiz && p.notiz.trim().length > 0 && (
              <div style={{ fontSize: "8.5pt", color: "#555", lineHeight: 1.3 }}>{p.notiz}</div>
            )}
            <div style={{ fontSize: "8pt", color: "#666", lineHeight: 1.3 }}>
              MwSt {p.artikel.mwstSatz ?? 19} %
            </div>
          </td>
          {hatCharge && (
            <td style={{ padding: "3px 8px", verticalAlign: "top", fontFamily: "monospace", fontSize: "8.5pt", color: "#555", wordBreak: "break-all" }}>
              {p.chargeNr ?? "—"}
            </td>
          )}
          <td style={{ padding: "3px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
            {formatMenge(p.menge)}
          </td>
          <td style={{ padding: "3px 8px", verticalAlign: "top" }}>{p.artikel.einheit}</td>
          <td style={{ padding: "3px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
            {formatEuro(p.verkaufspreis)}
          </td>
          {hatRabatt && (
            <td style={{ padding: "3px 8px", verticalAlign: "top", textAlign: "right" }}>
              {(p.rabattProzent ?? 0) > 0 ? `${p.rabattProzent} %` : ""}
            </td>
          )}
          <td style={{ padding: "3px 8px", verticalAlign: "top", textAlign: "right", fontFamily: "monospace" }}>
            {formatEuro(p.netto)}
          </td>
        </tr>
      ))}

      {/* Betragsblock/Notiz/Zahlungsinfo bleiben Zeilen DIESER Tabelle (nicht als <div>
          nach </table> verschoben): <tfoot> wird vom Browser immer unten im
          Tabellenbereich der jeweiligen Seite platziert, unabhängig von der
          Dokumentreihenfolge — Inhalte nach </table> würden deshalb UNTER der
          (wiederholten) Fußzeile statt darüber erscheinen. */}
      <tr className="no-break-before no-break">
        <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px", marginBottom: "16px" }}>
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

      {/* Zahlungsinfo — eigene Zeile, wandert beim Druck als Ganzes auf die nächste Seite.
          Bewusst eine <table> statt Flexbox für Text/QR-Code nebeneinander. */}
      <tr className="no-break">
        <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
          <table
            style={{
              width: "100%",
              borderCollapse: "collapse",
              backgroundColor: "#f9f9f9",
              border: "1px solid #ddd",
              borderRadius: "4px",
              marginBottom: "12px",
              fontSize: "10pt",
            }}
          >
            <tbody>
              <tr>
                <td style={{ padding: "10px 14px", verticalAlign: "top" }}>
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
                </td>
                {giroCode && (
                  <td style={{ width: "110px", padding: "10px 14px 10px 0", textAlign: "center", verticalAlign: "top" }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={giroCode}
                      alt="GiroCode – per Banking-App scannen"
                      style={{ width: "95px", height: "95px", display: "block", margin: "0 auto" }}
                    />
                    <div style={{ fontSize: "8pt", color: "#666", marginTop: "2px" }}>
                      Scan &amp; Pay
                    </div>
                  </td>
                )}
              </tr>
            </tbody>
          </table>
        </td>
      </tr>

      {/* Fußzeile (Eigentumsvorbehalt + DokumentFooter) bewusst als GANZ NORMALE letzte
          <tbody>-Zeile, NICHT als <tfoot>: <tfoot>/thead-Wiederholung auf jeder gedruckten
          Seite ist zwar CSS2.1-Standardverhalten, aber in WebKit (Safari/iOS – u.a. das
          "Chrome" auf dem iPhone, das dort per Apple-Vorgabe ebenfalls WebKit nutzt) seit
          Jahren nachweislich nicht implementiert (WebKit-Bugs #34218, #17205) – Safari
          druckt den tfoot-Inhalt dort gar nicht oder nur auf einer beliebigen Seite, nie
          zuverlässig auf allen. Damit die Fußzeile in JEDEM Browser mindestens einmal
          zuverlässig erscheint, steht sie hier als normale Zeile am Ende der Tabelle: sie
          wird exakt einmal gedruckt, direkt nach der Zahlungsinfo, auf welcher Seite auch
          immer das ist – identisches Verhalten in Chrome, Firefox und Safari. Der Nachteil
          (kein Abdruck auf JEDER Seite) ist bewusst in Kauf genommen, da position:fixed als
          Alternative in Safari beim Drucken ebenfalls nicht funktioniert (Apple-Support
          bestätigt das als bekannte Einschränkung) – es gibt also keine Variante, die eine
          echte Wiederholung auf jeder Seite browserübergreifend zuverlässig leistet. */}
      <tr className="no-break">
        <td colSpan={anzahlSpalten} style={{ padding: 0, border: "none" }}>
          {/* data-doc-footer: wird von downloadVorschauPdf() separat erfasst und dort
              auf JEDEM erzeugten PDF-Seitenbild eingefügt (siehe Kommentar dort) – für
              den normalen Bildschirm-/Druckdurchlauf ändert dieser Marker nichts. */}
          <div data-doc-footer>
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
          </div>
        </td>
      </tr>
      </tbody>
      </table>
      </div>
    </>
  );
}
