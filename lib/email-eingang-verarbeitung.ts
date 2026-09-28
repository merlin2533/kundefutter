// Orchestrator des automatischen E-Mail-Rechnungseingangs — vom Cron-Job (app/api/cron/route.ts)
// und vom manuellen "Jetzt abrufen"-Button (app/api/einstellungen/email-eingang/abrufen/route.ts)
// aufgerufen.
//
// Bewusste Grundsatzentscheidung (siehe Review-Historie dieser PR): eine automatisch erkannte
// Eingangsrechnung landet NICHT direkt als `EingangsRechnung`, sondern im bereits vorhandenen
// `KiEingangsrechnungBatch`/`KiEingangsrechnungBatchItem`-Mechanismus (wie beim manuellen Foto-
// Upload unter /eingangsrechnungen/neu) — "verbuchen" bleibt der bestehende
// `PUT /api/ki/eingangsrechnung/batch/[id] {aktion:"abschliessen"}`-Aufruf. Eine ungeprüfte,
// von der KI erzeugte Rechnung darf nie unbemerkt als "OFFEN" im Bankabgleich, der
// Überweisungsliste oder der Liquiditätsvorschau auftauchen, bevor ein Mensch sie bestätigt hat —
// genau das würde eine direkt angelegte `EingangsRechnung` aber tun (siehe lib/bankabgleich-
// kandidaten.ts, app/api/eingangsrechnungen/ueberweisungsliste, app/api/statistik/liquiditaet).
// Ein zweiter Grund: `EingangsRechnung.lieferantId` ist ein Pflichtfeld — ohne sicheren Lieferanten-
// Treffer ließe sich ohnehin kein vollständiger Datensatz anlegen, ohne einen Lieferanten zu
// erfinden (Projekt-Konvention: nie raten, immer explizit zur Prüfung vorlegen).

import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { log } from "@/lib/logger";
import { getUploadBase } from "@/lib/upload";
import { analyzeDocument, getAiConfig, logError, istMistralRateLimitFehler, PROMPTS } from "@/lib/ai";
import { matchKunde, normalisiereSuchtext, type Konfidenz } from "@/lib/kiMatching";
import { berechneFehlendeFelderEingangsrechnung, parseBelegKiErgebnis, type BelegKiErgebnis } from "@/lib/eingangsrechnung-matching";
import { extractXmlFromPdf, parseZugferdXml } from "@/lib/zugferd-parse";
import { ladeEmailEingangConfig, istEmailEingangVollstaendigKonfiguriert } from "@/lib/email-eingang-config";
import { holeImapMails, holeM365Mails, MAX_MAILS_PRO_LAUF, type EingehendeMail, type EingehendeMailAnhang } from "@/lib/email-eingang-abruf";

const MAX_VERSUCHE = 3;

export interface EmailRechnungseingangErgebnis {
  uebersprungen?: string;
  mailsAbgerufen: number;
  rechnungenErkannt: number;
  keineRechnung: number;
  fehler: number;
  /** true, wenn der Deckel (MAX_MAILS_PRO_LAUF) erreicht wurde — es könnten weitere Mails im
   * Postfach warten, die erst der nächste Lauf abarbeitet. Kein Fehler, nur ein Hinweis. */
  rueckstand: boolean;
}

// ─── Dateityp per Magic Bytes (nicht per gemeldetem Content-Type/Dateiname) ─────────────────────

export type ErkannterDateityp = "pdf" | "jpg" | "png" | "webp" | "xml";

export function erkenneDateityp(buffer: Buffer, dateiname: string): ErkannterDateityp | null {
  if (buffer.length >= 4 && buffer[0] === 0x25 && buffer[1] === 0x50 && buffer[2] === 0x44 && buffer[3] === 0x46) return "pdf"; // %PDF
  if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return "png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpg";
  if (buffer.length >= 12 && buffer.toString("ascii", 0, 4) === "RIFF" && buffer.toString("ascii", 8, 12) === "WEBP") return "webp";
  // XML hat keine feste Magic-Byte-Signatur — nur akzeptieren, wenn sowohl der Dateiname darauf
  // hindeutet ALS AUCH der Inhalt tatsächlich mit einem XML-Prolog/Tag beginnt (E-Rechnung/
  // XRechnung als eigenständiger XML-Anhang, nicht in ein PDF eingebettet).
  if (dateiname.toLowerCase().endsWith(".xml")) {
    const start = buffer.subarray(0, 200).toString("utf8").trimStart();
    if (start.startsWith("<?xml") || start.startsWith("<")) return "xml";
  }
  return null;
}

function extFuer(typ: ErkannterDateityp): string {
  return typ === "jpg" ? ".jpg" : `.${typ}`;
}

function hashBuffer(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

// ─── Lieferanten-Zuordnung ───────────────────────────────────────────────────

interface LieferantFuerMatch {
  id: number;
  name: string;
  iban: string | null;
}

async function ladeLieferantenUndGelernt() {
  const [lieferanten, gelerntRows] = await Promise.all([
    prisma.lieferant.findMany({ where: { aktiv: true }, select: { id: true, name: true, iban: true } }),
    prisma.kiLernZuordnung.findMany({ where: { typ: "lieferant" } }),
  ]);
  const gelernt = new Map<string, number>(gelerntRows.map((g) => [normalisiereSuchtext(g.suchtext), g.zielId]));
  return { lieferanten, gelernt };
}

function normalisiereIban(iban: string): string {
  return iban.replace(/\s/g, "").toUpperCase();
}

/** IBAN-Treffer zuerst (deterministisch, fälschungsresistenter als ein Namensabgleich), erst
 * danach der bestehende Fuzzy-Namens-Matcher aus lib/kiMatching.ts. */
export function matchLieferant(
  ergebnis: Pick<BelegKiErgebnis, "lieferant" | "iban">,
  lieferanten: LieferantFuerMatch[],
  gelernt: Map<string, number>
): { lieferantId: number | null; konfidenz: Konfidenz } {
  if (ergebnis.iban) {
    const gesucht = normalisiereIban(ergebnis.iban);
    const treffer = lieferanten.find((l) => l.iban && normalisiereIban(l.iban) === gesucht);
    if (treffer) return { lieferantId: treffer.id, konfidenz: "hoch" };
  }
  const { kunde, konfidenz } = matchKunde({ name: ergebnis.lieferant ?? "" }, lieferanten, gelernt);
  return { lieferantId: kunde ? kunde.id : null, konfidenz: kunde ? konfidenz : "keine" };
}

// ─── Ein Anhang → ein Batch-Item (oder gar keins, wenn keine Rechnung erkannt) ──────────────────

interface AnhangVerarbeitungErgebnis {
  erkanntAlsRechnung: boolean;
}

async function verarbeiteAnhang(
  anhang: EingehendeMailAnhang,
  index: number,
  batchIdRef: { id: number | null },
  mailImportId: number,
  mail: EingehendeMail,
  lieferantenState: { lieferanten: LieferantFuerMatch[]; gelernt: Map<string, number> }
): Promise<AnhangVerarbeitungErgebnis> {
  const typ = erkenneDateityp(anhang.buffer, anhang.dateiname);
  if (!typ) return { erkanntAlsRechnung: false };

  // ZUGFeRD/Factur-X zuerst versuchen (deterministisch, kostenlos, keine Halluzination) — nur bei
  // Fehlschlag/Nicht-Vorhandensein auf die KI ausweichen. Ein eigenständiger XML-Anhang
  // (XRechnung) läuft direkt hier hinein, ein PDF mit eingebettetem ZUGFeRD-XML ebenso.
  let ergebnis: BelegKiErgebnis | null = null;
  let kiRohtext: string | null = null;
  let unbekanntesFormat = false;

  if (typ === "xml" || typ === "pdf") {
    const xml = typ === "xml" ? anhang.buffer.toString("utf8") : extractXmlFromPdf(anhang.buffer);
    if (xml) {
      const geparst = parseZugferdXml(xml);
      if (geparst.rechnungNummer || geparst.betragNetto != null || geparst.lieferantName) {
        ergebnis = {
          datum: geparst.datum,
          belegNr: geparst.rechnungNummer,
          faelligAm: geparst.faelligAm,
          beschreibung: null,
          betragNetto: geparst.betragNetto,
          betragBrutto: geparst.betragBrutto,
          mwstSatz: geparst.mwstSatz ?? 19,
          lieferant: geparst.lieferantName,
          iban: geparst.iban,
          bic: geparst.bic,
        };
      } else if (typ === "xml") {
        unbekanntesFormat = true; // XML-Datei, aber kein auswertbares ZUGFeRD/CII-Format (z.B. UBL)
      }
    } else if (typ === "xml") {
      unbekanntesFormat = true;
    }
  }

  if (!ergebnis && !unbekanntesFormat && typ !== "xml") {
    // Kein ZUGFeRD gefunden → KI-Weg: erst günstige Typ-Klassifikation, nur bei "rechnung"
    // die teurere strukturierte Extraktion. Verhindert, dass ein zufälliges PDF (AGB,
    // Lieferschein, Datenblatt) im Mail-Anhang fälschlich als Eingangsrechnung angelegt wird.
    const cfg = await getAiConfig("ocr");
    if (!cfg.mistralKey) throw new Error("Mistral API-Key nicht konfiguriert");
    const base64 = anhang.buffer.toString("base64");

    const typErkennung = await analyzeDocument(base64, PROMPTS.belegtyp, "belegtyp", cfg);
    const typResult = typErkennung.parsed as { typ?: string; confidence?: number };
    if (typResult.typ !== "rechnung") {
      return { erkanntAlsRechnung: false };
    }

    const beleg = await analyzeDocument(base64, PROMPTS.beleg, "beleg", cfg);
    kiRohtext = beleg.raw;
    ergebnis = parseBelegKiErgebnis(beleg.parsed as Record<string, unknown>);
  }

  if (!ergebnis && !unbekanntesFormat) return { erkanntAlsRechnung: false };

  // Ab hier: entweder ein per ZUGFeRD/KI ausgewertetes Ergebnis ODER ein XML, das erkennbar eine
  // Rechnung sein soll (E-Rechnungs-Anhang), aber mit dem vorhandenen Parser nicht lesbar ist
  // (z.B. UBL statt CII) — beides landet als Item im Eingang, damit nichts stillschweigend
  // verloren geht; im zweiten Fall ohne Datenvorschlag, rein zur manuellen Erfassung.
  if (!batchIdRef.id) {
    const batch = await prisma.kiEingangsrechnungBatch.create({
      data: { quelle: "email", notiz: `Aus E-Mail-Eingang: ${mail.von}${mail.betreff ? ` – ${mail.betreff}` : ""}` },
    });
    batchIdRef.id = batch.id;
  }
  const batchId = batchIdRef.id;

  const dateiHash = hashBuffer(anhang.buffer);
  const dublette = await prisma.kiEingangsrechnungBatchItem.findFirst({
    where: { dateiHash, batchId: { not: batchId } },
    select: { id: true, batchId: true },
  });

  const uploadDir = path.join(getUploadBase(), "ki-eingangsrechnung-batch", String(batchId));
  await mkdir(uploadDir, { recursive: true });
  const filename = `${index + 1}${extFuer(typ)}`;
  await writeFile(path.join(uploadDir, filename), anhang.buffer);

  if (unbekanntesFormat) {
    await prisma.kiEingangsrechnungBatchItem.create({
      data: {
        batchId,
        reihenfolge: index,
        dateiPfad: `ki-eingangsrechnung-batch/${batchId}/${filename}`,
        dateiName: anhang.dateiname,
        status: "analysiert",
        mailImportId,
        dateiHash,
        fehlendeFelder: JSON.stringify(["E-Rechnungs-Format (XML) konnte nicht automatisch ausgelesen werden — bitte Felder manuell erfassen"]),
      },
    });
    return { erkanntAlsRechnung: true };
  }

  const e = ergebnis!;
  const { lieferantId, konfidenz } = matchLieferant(e, lieferantenState.lieferanten, lieferantenState.gelernt);
  const felder = { lieferantKonfidenz: lieferantId ? konfidenz : ("keine" as Konfidenz), nummer: e.belegNr, datum: e.datum, betragNetto: e.betragNetto };
  const fehlendeFelder = berechneFehlendeFelderEingangsrechnung(felder);
  if (dublette) {
    fehlendeFelder.push(`Möglicherweise Dublette eines bereits importierten Anhangs (Item #${dublette.id})`);
  }
  const entscheidung = fehlendeFelder.length === 0 ? "passt" : null;

  await prisma.kiEingangsrechnungBatchItem.create({
    data: {
      batchId,
      reihenfolge: index,
      dateiPfad: `ki-eingangsrechnung-batch/${batchId}/${filename}`,
      dateiName: anhang.dateiname,
      status: "analysiert",
      kiRohtext,
      kiErgebnisJson: JSON.stringify(e),
      lieferantId,
      lieferantKonfidenz: felder.lieferantKonfidenz,
      nummer: e.belegNr,
      datum: e.datum,
      faelligAm: e.faelligAm,
      betragNetto: e.betragNetto,
      mwstSatz: e.mwstSatz,
      notiz: e.beschreibung,
      fehlendeFelder: JSON.stringify(fehlendeFelder),
      entscheidung,
      analysiertAm: new Date(),
      mailImportId,
      dateiHash,
    },
  });

  return { erkanntAlsRechnung: true };
}

// ─── Eine Mail → 0..n Batch-Items ────────────────────────────────────────────

async function verarbeiteMail(
  mail: EingehendeMail,
  mailImportId: number,
  lieferantenState: { lieferanten: LieferantFuerMatch[]; gelernt: Map<string, number> }
): Promise<number> {
  const batchIdRef: { id: number | null } = { id: null };
  let erkannt = 0;
  for (let i = 0; i < mail.anhaenge.length; i++) {
    const { erkanntAlsRechnung } = await verarbeiteAnhang(mail.anhaenge[i], i, batchIdRef, mailImportId, mail, lieferantenState);
    if (erkanntAlsRechnung) erkannt++;
  }
  if (batchIdRef.id) {
    await prisma.eingangsRechnungMailImport.update({ where: { id: mailImportId }, data: { batchId: batchIdRef.id } });
  }
  return erkannt;
}

// ─── Orchestrator ────────────────────────────────────────────────────────────

export async function verarbeiteEingehendeMails(): Promise<EmailRechnungseingangErgebnis> {
  const leer = (uebersprungen: string): EmailRechnungseingangErgebnis => ({
    uebersprungen,
    mailsAbgerufen: 0,
    rechnungenErkannt: 0,
    keineRechnung: 0,
    fehler: 0,
    rueckstand: false,
  });

  const cfg = await ladeEmailEingangConfig();
  if (!cfg.aktiv) return leer("E-Mail-Rechnungseingang ist deaktiviert");
  if (!istEmailEingangVollstaendigKonfiguriert(cfg)) return leer("Zugangsdaten unvollständig");

  const postfach = cfg.provider === "imap" ? cfg.imap.user : cfg.m365.mailbox;

  let mails: EingehendeMail[];
  try {
    mails = cfg.provider === "imap" ? await holeImapMails(cfg.imap, cfg.aktivSeit) : await holeM365Mails(cfg.m365, cfg.aktivSeit);
  } catch (err) {
    log.error("E-Mail-Rechnungseingang: Postfach-Abruf fehlgeschlagen", err, { provider: cfg.provider, postfach });
    return { mailsAbgerufen: 0, rechnungenErkannt: 0, keineRechnung: 0, fehler: 1, rueckstand: false };
  }

  if (mails.length === 0) return { mailsAbgerufen: 0, rechnungenErkannt: 0, keineRechnung: 0, fehler: 0, rueckstand: false };

  const lieferantenState = await ladeLieferantenUndGelernt();

  let rechnungenErkannt = 0;
  let keineRechnung = 0;
  let fehler = 0;

  for (const mail of mails) {
    const bestehend = await prisma.eingangsRechnungMailImport.findUnique({
      where: { provider_postfach_messageId: { provider: cfg.provider, postfach, messageId: mail.messageId } },
    });
    // Bereits final verarbeitet (oder als endgültig fehlgeschlagen markiert) — nur den Fortschritt
    // bestätigen und weiter, kein erneuter (teurer) Verarbeitungsversuch.
    if (bestehend && (bestehend.status !== "fehler" || bestehend.versuche >= MAX_VERSUCHE)) {
      await mail.bestaetige();
      continue;
    }

    const importZeile = bestehend
      ? await prisma.eingangsRechnungMailImport.update({
          where: { id: bestehend.id },
          data: { versuche: { increment: 1 } },
        })
      : await prisma.eingangsRechnungMailImport.create({
          data: {
            provider: cfg.provider,
            postfach,
            messageId: mail.messageId,
            von: mail.von,
            betreff: mail.betreff,
            empfangenAm: mail.empfangenAm,
            anhaengeAnzahl: mail.anhaenge.length,
            status: "neu",
          },
        });

    try {
      const anzahlErkannt = await verarbeiteMail(mail, importZeile.id, lieferantenState);
      if (anzahlErkannt > 0) {
        rechnungenErkannt++;
        await prisma.eingangsRechnungMailImport.update({
          where: { id: importZeile.id },
          data: { status: "rechnung_erkannt", fehlerText: null },
        });
      } else {
        keineRechnung++;
        await prisma.eingangsRechnungMailImport.update({
          where: { id: importZeile.id },
          data: { status: "keine_rechnung", fehlerText: null },
        });
      }
      await mail.bestaetige();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      await logError("beleg", message).catch(() => undefined);
      await prisma.eingangsRechnungMailImport.update({
        where: { id: importZeile.id },
        data: { status: "fehler", fehlerText: message.slice(0, 500) },
      });
      fehler++;
      log.error("E-Mail-Rechnungseingang: Verarbeitung einer Mail fehlgeschlagen", err, {
        mailImportId: importZeile.id,
        provider: cfg.provider,
      });

      if (istMistralRateLimitFehler(err)) {
        // Echte, transiente Überlastung — Lauf sofort abbrechen (Cursor NICHT bestätigen), statt
        // jede weitere Mail dieses Laufs ebenfalls als "fehler" zu verbrennen. Der nächste
        // Cron-Tick beginnt wieder bei genau dieser Mail.
        break;
      }
      // Andere Fehler (z.B. eine defekte Einzeldatei) sollen nicht den ganzen Postfach-Abruf
      // blockieren — Fortschritt trotzdem bestätigen, die Mail bleibt für die Auswertung als
      // "fehler" im Protokoll sichtbar.
      await mail.bestaetige();
    }
  }

  return {
    mailsAbgerufen: mails.length,
    rechnungenErkannt,
    keineRechnung,
    fehler,
    rueckstand: mails.length >= MAX_MAILS_PRO_LAUF,
  };
}
