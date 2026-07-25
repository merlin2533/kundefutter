/**
 * Einmaliger Backfill-Job: überträgt alle bestehenden lokalen Dokumente und
 * bereits erzeugten Rechnungen/Lieferscheine/Gutschriften nach Nextcloud.
 *
 * Läuft als "fire-and-forget" im Hintergrund (kein Request-Timeout-Risiko bei
 * tausenden Dateien) — Fortschritt wird in der Einstellung
 * `system.nextcloud.backfillStatus` als JSON gespeichert und per Polling
 * (`GET /api/nextcloud/backfill/status`) abgefragt.
 *
 * Idempotent: vor jedem Upload prüft `dateiExistiert()`, ob die Datei am
 * Zielpfad bereits liegt — ein erneuter Lauf überspringt bereits übertragene
 * Dateien, statt sie doppelt hochzuladen.
 */

import path from "path";
import { readFile } from "fs/promises";
import { prisma } from "./prisma";
import { Sentry } from "./sentry";
import { resolveUploadPath } from "./upload";
import {
  dateiExistiert,
  uploadZuKundeOrdner,
  uploadZuArtikelOrdner,
  uploadZuBuchhaltung,
  uploadPdfToKundeOrdner,
  kundenOrdnerPfad,
  artikelOrdnerPfad,
  kundenOrdnerPfadLegacy,
  artikelOrdnerPfadLegacy,
  verschiebeOrdner,
  buchhaltungsPfad,
} from "./nextcloud";
import { generiereRechnungPdf, generiereLieferscheinPdf, generiereGutschriftPdf } from "./pdfGenerator";

const STATUS_KEY = "system.nextcloud.backfillStatus";
const BATCH_SIZE = 200;
const MAX_FEHLER = 100;
// Ohne Fortschritt seit mehr als 15 Minuten gilt ein "laufend"-Status als verwaist
// (z.B. weil der Container während des Laufs neu deployed/neu gestartet wurde —
// Watchtower zieht bei jedem Merge nach main ein neues Image). Ein fire-and-forget-Job
// stirbt dabei lautlos mit dem Prozess, der Status bliebe sonst für immer auf "laufend".
const VERWAIST_MS = 15 * 60 * 1000;

export interface BackfillFehler {
  entitaet: string;
  id: number;
  fehler: string;
}

export interface BackfillStatus {
  laufend: boolean;
  gestartet: string;
  beendet?: string;
  zuletztAktualisiert: string;
  aktuellerSchritt: string;
  gesamt: { verarbeitet: number; hochgeladen: number; uebersprungen: number; fehler: number };
  fehlerListe: BackfillFehler[];
}

async function getEinstellung(key: string): Promise<string | null> {
  const e = await prisma.einstellung.findUnique({ where: { key } });
  return e?.value ?? null;
}

async function setEinstellung(key: string, value: string): Promise<void> {
  await prisma.einstellung.upsert({ where: { key }, create: { key, value }, update: { value } });
}

export async function getBackfillStatus(): Promise<BackfillStatus | null> {
  const raw = await getEinstellung(STATUS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as BackfillStatus;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

async function speichereStatus(status: BackfillStatus): Promise<void> {
  status.zuletztAktualisiert = new Date().toISOString();
  await setEinstellung(STATUS_KEY, JSON.stringify(status));
}

/** Ein "laufend"-Status ohne Fortschritt seit VERWAIST_MS gehört zu einem toten Prozess. */
export function istVerwaist(status: BackfillStatus): boolean {
  if (!status.laufend) return false;
  const letzte = status.zuletztAktualisiert ?? status.gestartet;
  return Date.now() - new Date(letzte).getTime() > VERWAIST_MS;
}

/** Startet den Backfill-Job, falls nicht bereits einer läuft. Gibt false zurück, wenn bereits ein Job aktiv ist. */
export async function starteBackfillFallsMoeglich(): Promise<boolean> {
  const bestehend = await getBackfillStatus();
  if (bestehend?.laufend && !istVerwaist(bestehend)) return false;

  const status: BackfillStatus = {
    laufend: true,
    gestartet: new Date().toISOString(),
    zuletztAktualisiert: new Date().toISOString(),
    aktuellerSchritt: "Wird gestartet…",
    gesamt: { verarbeitet: 0, hochgeladen: 0, uebersprungen: 0, fehler: 0 },
    fehlerListe: [],
  };
  await speichereStatus(status);

  // Fire-and-forget: der eigentliche Lauf blockiert die POST-Antwort nicht.
  runBackfill(status).catch((e) => {
    Sentry.captureException(e);
    console.error("[nextcloud-backfill] Unerwarteter Abbruch:", e);
  });

  return true;
}

/**
 * Setzt den Backfill-Status vollständig zurück (Reset-Button, oder beim Trennen/
 * Neuverbinden der Nextcloud-Zugangsdaten). Ein tatsächlich noch aktiv laufender,
 * nicht verwaister Job wird dabei nicht abgebrochen — der nächste Start bleibt bis
 * dahin über `starteBackfillFallsMoeglich()` blockiert. Der eigentliche Datentransfer
 * ist idempotent (`dateiExistiert()`-Prüfung vor jedem Upload): ein neuer Lauf nach dem
 * Reset überspringt automatisch alles, was am Zielort bereits vorhanden ist, und
 * überträgt nur, was dort noch fehlt.
 */
export async function resetBackfillStatus(): Promise<{ ok: boolean; laeuftNoch?: boolean }> {
  const bestehend = await getBackfillStatus();
  if (bestehend?.laufend && !istVerwaist(bestehend)) {
    return { ok: false, laeuftNoch: true };
  }
  await prisma.einstellung.deleteMany({ where: { key: STATUS_KEY } });
  return { ok: true };
}

function melde(status: BackfillStatus, entitaet: string, id: number, fehler: unknown) {
  status.gesamt.fehler++;
  if (status.fehlerListe.length < MAX_FEHLER) {
    status.fehlerListe.push({ entitaet, id, fehler: fehler instanceof Error ? fehler.message : String(fehler) });
  }
}

async function ladeDatei(relPfad: string): Promise<Buffer | null> {
  try {
    return await readFile(resolveUploadPath(relPfad));
  } catch (err) {
    Sentry.captureException(err);
    return null; // Datei existiert lokal nicht mehr — überspringen statt abzubrechen
  }
}

async function uploadFallsFehlend(
  zielRelPfadMitDatei: string,
  upload: () => Promise<unknown>,
  status: BackfillStatus,
  entitaet: string,
  id: number
): Promise<void> {
  status.gesamt.verarbeitet++;
  try {
    if (await dateiExistiert(zielRelPfadMitDatei)) {
      status.gesamt.uebersprungen++;
      return;
    }
    await upload();
    status.gesamt.hochgeladen++;
  } catch (e) {
    Sentry.captureException(e);
    melde(status, entitaet, id, e);
  }
}

async function runBackfill(status: BackfillStatus): Promise<void> {
  // ── 0. Ordner-Migration: ":" → "-" vor der ID (Nextcloud-Dateisystem-Kompatibilität) ──
  // Bestehende Ordner "Name (ID:123)" werden zu "Name (ID-123)" verschoben, bevor
  // irgendetwas hochgeladen wird — sonst würden neue Uploads (die bereits das neue
  // Format verwenden) parallele Ordner statt der bestehenden Kunden-/Artikel-Ordner treffen.
  status.aktuellerSchritt = "Ordner-Migration (Kunden)";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.kunde.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const k of batch) {
      status.gesamt.verarbeitet++;
      try {
        await verschiebeOrdner(kundenOrdnerPfadLegacy(k.id, k.name), kundenOrdnerPfad(k.id, k.name));
      } catch (e) {
        Sentry.captureException(e);
        melde(status, "Kunde(Ordner-Migration)", k.id, e);
      }
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  status.aktuellerSchritt = "Ordner-Migration (Artikel)";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.artikel.findMany({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const a of batch) {
      status.gesamt.verarbeitet++;
      try {
        await verschiebeOrdner(artikelOrdnerPfadLegacy(a.id, a.name), artikelOrdnerPfad(a.id, a.name));
      } catch (e) {
        Sentry.captureException(e);
        melde(status, "Artikel(Ordner-Migration)", a.id, e);
      }
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 1. Sachkundenachweise ────────────────────────────────────────────────
  status.aktuellerSchritt = "Sachkundenachweise";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.sachkundenachweis.findMany({
      where: { belegPfad: { not: null } },
      select: { id: true, typ: true, belegPfad: true, kundeId: true, kunde: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const s of batch) {
      const zielName = `Sachkundenachweis_${s.typ}_${s.id}_${path.basename(s.belegPfad!)}`;
      const zielPfad = `${kundenOrdnerPfad(s.kundeId, s.kunde.name)}/Nachweise/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(s.belegPfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuKundeOrdner(s.kundeId, s.kunde.name, "Nachweise", zielName, buffer);
        },
        status,
        "Sachkundenachweis",
        s.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 2. Zertifizierungen ──────────────────────────────────────────────────
  status.aktuellerSchritt = "Zertifizierungen";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.zertifizierung.findMany({
      where: { belegpfad: { not: null } },
      select: { id: true, typ: true, belegpfad: true, kundeId: true, kunde: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const z of batch) {
      const zielName = `Zertifizierung_${z.typ}_${z.id}_${path.basename(z.belegpfad!)}`;
      const zielPfad = `${kundenOrdnerPfad(z.kundeId, z.kunde.name)}/Nachweise/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(z.belegpfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuKundeOrdner(z.kundeId, z.kunde.name, "Nachweise", zielName, buffer);
        },
        status,
        "Zertifizierung",
        z.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 3. Sprengstofferklärungen ────────────────────────────────────────────
  status.aktuellerSchritt = "Sprengstofferklärungen";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.kundeSprengstoffErklaerung.findMany({
      where: { dokumentPfad: { not: null } },
      select: { id: true, jahr: true, dokumentPfad: true, kundeId: true, kunde: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const e of batch) {
      const zielName = `Sprengstofferklaerung_${e.jahr}_${path.basename(e.dokumentPfad!)}`;
      const zielPfad = `${kundenOrdnerPfad(e.kundeId, e.kunde.name)}/Nachweise/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(e.dokumentPfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuKundeOrdner(e.kundeId, e.kunde.name, "Nachweise", zielName, buffer);
        },
        status,
        "KundeSprengstoffErklaerung",
        e.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 4. Bodenproben ────────────────────────────────────────────────────────
  status.aktuellerSchritt = "Bodenproben";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.bodenprobe.findMany({
      where: { belegPfad: { not: null } },
      select: { id: true, datum: true, belegPfad: true, schlag: { select: { kundeId: true, kunde: { select: { name: true } } } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const b of batch) {
      const datumStr = b.datum.toISOString().slice(0, 10);
      const zielName = `Bodenprobe_${datumStr}_${path.basename(b.belegPfad!)}`;
      const zielPfad = `${kundenOrdnerPfad(b.schlag.kundeId, b.schlag.kunde.name)}/Nachweise/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(b.belegPfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuKundeOrdner(b.schlag.kundeId, b.schlag.kunde.name, "Nachweise", zielName, buffer);
        },
        status,
        "Bodenprobe",
        b.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 5. Albrecht-Bodenanalysen ─────────────────────────────────────────────
  status.aktuellerSchritt = "Albrecht-Bodenanalysen";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.bodenanalyseAlbrecht.findMany({
      where: { belegPfad: { not: null } },
      select: { id: true, datum: true, belegPfad: true, schlag: { select: { kundeId: true, kunde: { select: { name: true } } } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const b of batch) {
      const datumStr = b.datum.toISOString().slice(0, 10);
      const zielName = `BodenanalyseAlbrecht_${datumStr}_${path.basename(b.belegPfad!)}`;
      const zielPfad = `${kundenOrdnerPfad(b.schlag.kundeId, b.schlag.kunde.name)}/Nachweise/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(b.belegPfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuKundeOrdner(b.schlag.kundeId, b.schlag.kunde.name, "Nachweise", zielName, buffer);
        },
        status,
        "BodenanalyseAlbrecht",
        b.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 6. Artikel-Dokumente ──────────────────────────────────────────────────
  status.aktuellerSchritt = "Artikel-Dokumente";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.artikelDokument.findMany({
      select: { id: true, pfad: true, artikelId: true, artikel: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const d of batch) {
      const zielName = path.basename(d.pfad);
      const zielPfad = `${artikelOrdnerPfad(d.artikelId, d.artikel.name)}/Dokumente/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(d.pfad);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuArtikelOrdner(d.artikelId, d.artikel.name, "Dokumente", zielName, buffer);
        },
        status,
        "ArtikelDokument",
        d.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 7. Chargenzertifikate ─────────────────────────────────────────────────
  status.aktuellerSchritt = "Chargenzertifikate";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.chargenZertifikat.findMany({
      select: { id: true, chargeNr: true, pfad: true, artikelId: true, artikel: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const z of batch) {
      const zielName = `${z.chargeNr}_${path.basename(z.pfad)}`;
      const zielPfad = `${artikelOrdnerPfad(z.artikelId, z.artikel.name)}/Chargenzertifikate/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(z.pfad);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuArtikelOrdner(z.artikelId, z.artikel.name, "Chargenzertifikate", zielName, buffer);
        },
        status,
        "ChargenZertifikat",
        z.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 8. Ausgaben-Belege ────────────────────────────────────────────────────
  status.aktuellerSchritt = "Ausgaben-Belege";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.ausgabe.findMany({
      where: { belegPfad: { not: null } },
      select: { id: true, datum: true, belegPfad: true },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const a of batch) {
      const zielName = path.basename(a.belegPfad!);
      const zielPfad = `${buchhaltungsPfad(a.datum.getFullYear(), a.datum.getMonth() + 1, "Ausgaben")}/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(a.belegPfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuBuchhaltung(a.datum.getFullYear(), a.datum.getMonth() + 1, "Ausgaben", zielName, buffer);
        },
        status,
        "Ausgabe",
        a.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 9. Eingangsrechnungen ─────────────────────────────────────────────────
  status.aktuellerSchritt = "Eingangsrechnungen";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.eingangsRechnung.findMany({
      where: { belegpfad: { not: null } },
      select: { id: true, nummer: true, datum: true, belegpfad: true },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const r of batch) {
      const zielName = `Eingangsrechnung_${r.nummer ?? r.id}_${path.basename(r.belegpfad!)}`;
      const zielPfad = `${buchhaltungsPfad(r.datum.getFullYear(), r.datum.getMonth() + 1, "Eingangsrechnungen")}/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const buffer = await ladeDatei(r.belegpfad!);
          if (!buffer) throw new Error("Lokale Datei nicht gefunden");
          return uploadZuBuchhaltung(r.datum.getFullYear(), r.datum.getMonth() + 1, "Eingangsrechnungen", zielName, buffer);
        },
        status,
        "EingangsRechnung",
        r.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 10. Bereits fakturierte Lieferungen (Rechnung-PDF) ───────────────────
  status.aktuellerSchritt = "Rechnungen (Lieferungen)";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.lieferung.findMany({
      where: { rechnungNr: { not: null } },
      select: { id: true, rechnungNr: true, kundeId: true, kunde: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const l of batch) {
      const zielName = `Rechnung-${l.rechnungNr!.replace(/\//g, "-")}.pdf`;
      const zielPfad = `${kundenOrdnerPfad(l.kundeId, l.kunde.name)}/Rechnungen/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const pdfBuffer = await generiereRechnungPdf(l.id);
          return uploadPdfToKundeOrdner(l.kundeId, l.kunde.name, "Rechnungen", zielName, pdfBuffer);
        },
        status,
        "Lieferung(Rechnung)",
        l.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 11. Gelieferte Lieferungen (Lieferschein-PDF) ────────────────────────
  status.aktuellerSchritt = "Lieferscheine (Lieferungen)";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.lieferung.findMany({
      where: { status: "geliefert" },
      select: { id: true, datum: true, kundeId: true, kunde: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const l of batch) {
      const datumStr = l.datum.toISOString().slice(0, 10);
      const zielName = `Lieferschein-${l.id}-${datumStr}.pdf`;
      const zielPfad = `${kundenOrdnerPfad(l.kundeId, l.kunde.name)}/Lieferscheine/${zielName}`;
      await uploadFallsFehlend(
        zielPfad,
        async () => {
          const pdfBuffer = await generiereLieferscheinPdf(l.id);
          return uploadPdfToKundeOrdner(l.kundeId, l.kunde.name, "Lieferscheine", zielName, pdfBuffer);
        },
        status,
        "Lieferung(Lieferschein)",
        l.id
      );
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  // ── 12. Sammelrechnungen ─────────────────────────────────────────────────
  // Kein eigenständiger PDF-Generator vorhanden (Erzeugung passiert inline beim
  // Export) — wird bewusst NICHT rückwirkend regeneriert, um den Job klein und
  // risikoarm zu halten. Künftige Sammelrechnungen werden über den Auto-Push-Hook
  // in app/api/exporte/sammelrechnung/route.ts erfasst.
  status.aktuellerSchritt = "Sammelrechnungen (übersprungen — kein PDF-Regenerator)";
  await speichereStatus(status);

  // ── 13. Gutschriften ──────────────────────────────────────────────────────
  status.aktuellerSchritt = "Gutschriften";
  await speichereStatus(status);
  for (let skip = 0; ; skip += BATCH_SIZE) {
    const batch = await prisma.gutschrift.findMany({
      where: { status: { not: "STORNIERT" } },
      select: { id: true, nummer: true, datum: true, kundeId: true, kunde: { select: { name: true } } },
      orderBy: { id: "asc" },
      skip,
      take: BATCH_SIZE,
    });
    if (batch.length === 0) break;
    for (const g of batch) {
      const zielName = `Gutschrift_${g.nummer.replace(/[^A-Za-z0-9\-_]/g, "_")}.pdf`;
      const zielPfadKunde = `${kundenOrdnerPfad(g.kundeId, g.kunde.name)}/Gutschriften/${zielName}`;
      status.gesamt.verarbeitet++;
      try {
        let pdfBuffer: Buffer | null = null;
        if (!(await dateiExistiert(zielPfadKunde))) {
          pdfBuffer = await generiereGutschriftPdf(g.id);
          await uploadPdfToKundeOrdner(g.kundeId, g.kunde.name, "Gutschriften", zielName, pdfBuffer);
          status.gesamt.hochgeladen++;
        } else {
          status.gesamt.uebersprungen++;
        }

        const zielPfadBuchhaltung = `${buchhaltungsPfad(g.datum.getFullYear(), g.datum.getMonth() + 1, "Gutschriften")}/${zielName}`;
        if (!(await dateiExistiert(zielPfadBuchhaltung))) {
          if (!pdfBuffer) pdfBuffer = await generiereGutschriftPdf(g.id);
          await uploadZuBuchhaltung(g.datum.getFullYear(), g.datum.getMonth() + 1, "Gutschriften", zielName, pdfBuffer, "application/pdf");
        }
      } catch (e) {
        Sentry.captureException(e);
        melde(status, "Gutschrift", g.id, e);
      }
    }
    await speichereStatus(status);
    if (batch.length < BATCH_SIZE) break;
  }

  status.laufend = false;
  status.beendet = new Date().toISOString();
  status.aktuellerSchritt = "Abgeschlossen";
  await speichereStatus(status);
}
