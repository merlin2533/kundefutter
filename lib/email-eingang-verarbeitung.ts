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

import { mkdir, writeFile, rm } from "fs/promises";
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
// Eine Mail, deren MailImport-Zeile seit mehr als dieser Zeitspanne auf "neu" hängen geblieben
// ist (Prozess-/Container-Neustart mitten in der Verarbeitung), wird wie "fehler" behandelt und
// erneut versucht — sonst bliebe sie für immer als "wird gerade verarbeitet" liegen, ohne dass
// sie je fertig wird oder erneut angefasst wird (siehe Dedupe-Prüfung in verarbeiteEingehendeMails()).
const HAENGENGEBLIEBEN_NACH_MS = 15 * 60 * 1000;
const GUELTIGE_MWST = [0, 7, 19];

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
 * danach der bestehende Fuzzy-Namens-Matcher aus lib/kiMatching.ts.
 *
 * E-Mail ist ein nicht vertrauenswürdiger Eingangskanal — das klassische Betrugsmuster ist eine
 * gefälschte "unsere Bankverbindung hat sich geändert"-Rechnung. Deshalb zwei Sicherungen:
 * (1) Teilen sich mehrere aktive Lieferanten dieselbe IBAN (z.B. Factoring), gewinnt NICHT
 *     einfach der erste Treffer mit Konfidenz "hoch" — stattdessen auf den Namensabgleich
 *     ausweichen, damit ein mehrdeutiger IBAN-Treffer nicht blind übernommen wird.
 * (2) Wird der Lieferant über den Namen gefunden, aber die auf dem Beleg genannte IBAN weicht von
 *     der beim Lieferanten hinterlegten ab, wird das über `ibanAbweichung` zurückgemeldet, statt
 *     es stillschweigend zu ignorieren — der Aufrufer hängt daraus einen Prüfhinweis an
 *     `fehlendeFelder`, der ein automatisches "passt" verhindert (siehe verarbeiteAnhang()). */
export function matchLieferant(
  ergebnis: Pick<BelegKiErgebnis, "lieferant" | "iban">,
  lieferanten: LieferantFuerMatch[],
  gelernt: Map<string, number>
): { lieferantId: number | null; konfidenz: Konfidenz; ibanAbweichung: boolean } {
  if (ergebnis.iban) {
    const gesucht = normalisiereIban(ergebnis.iban);
    const treffer = lieferanten.filter((l) => l.iban && normalisiereIban(l.iban) === gesucht);
    if (treffer.length === 1) return { lieferantId: treffer[0].id, konfidenz: "hoch", ibanAbweichung: false };
  }
  const { kunde, konfidenz } = matchKunde({ name: ergebnis.lieferant ?? "" }, lieferanten, gelernt);
  if (!kunde) return { lieferantId: null, konfidenz: "keine", ibanAbweichung: false };
  const ibanAbweichung = !!(ergebnis.iban && kunde.iban && normalisiereIban(ergebnis.iban) !== normalisiereIban(kunde.iban));
  return { lieferantId: kunde.id, konfidenz, ibanAbweichung };
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
  // Gesetzt, wenn der Anhang zwar erkennbar eine Rechnung sein soll, aber nicht automatisch
  // ausgewertet werden konnte (unbekanntes XML-Format ODER ein per-Anhang isolierter KI-Fehler,
  // siehe unten) — landet dann trotzdem als Item im Eingang, ohne Datenvorschlag, rein zur
  // manuellen Erfassung, statt den Anhang stillschweigend zu verwerfen.
  let hinweisOhneAuswertung: string | null = null;

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
          mwstSatz: GUELTIGE_MWST.includes(geparst.mwstSatz ?? -1) ? geparst.mwstSatz! : 19,
          lieferant: geparst.lieferantName,
          iban: geparst.iban,
          bic: geparst.bic,
        };
      } else if (typ === "xml") {
        hinweisOhneAuswertung = "E-Rechnungs-Format (XML) konnte nicht automatisch ausgelesen werden — bitte Felder manuell erfassen"; // z.B. UBL statt CII
      }
    } else if (typ === "xml") {
      hinweisOhneAuswertung = "E-Rechnungs-Format (XML) konnte nicht automatisch ausgelesen werden — bitte Felder manuell erfassen";
    }
  }

  if (!ergebnis && !hinweisOhneAuswertung && typ !== "xml") {
    // Kein ZUGFeRD gefunden → KI-Weg: erst günstige Typ-Klassifikation, nur bei "rechnung"
    // die teurere strukturierte Extraktion. Verhindert, dass ein zufälliges PDF (AGB,
    // Lieferschein, Datenblatt) im Mail-Anhang fälschlich als Eingangsrechnung angelegt wird.
    //
    // Fehler HIER (Mistral-Key fehlt, OCR liefert keinen Text, Netzwerkfehler…) betreffen NUR
    // diesen einen Anhang — ein per-Mail-`try/catch` würde sonst bei einem defekten Anhang JEDEN
    // weiteren Anhang derselben Mail (z.B. das eigentliche Rechnungs-PDF an Index 2) ungeprüft
    // verwerfen und den ganzen Mail-Fortschritt als "fehler" markieren, obwohl nur eine einzelne
    // Datei betroffen war. Eine echte Mistral-429-Überlastung ist die einzige Ausnahme: die wird
    // bewusst NICHT abgefangen, sondern bis zum Mail-Loop im Orchestrator durchgereicht, der dann
    // den GANZEN Lauf abbricht (siehe verarbeiteEingehendeMails()).
    try {
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
    } catch (err) {
      if (istMistralRateLimitFehler(err)) throw err;
      log.warn("E-Mail-Rechnungseingang: KI-Auswertung eines Anhangs fehlgeschlagen", {
        dateiname: anhang.dateiname,
        fehler: err instanceof Error ? err.message : String(err),
      });
      hinweisOhneAuswertung = "Automatische Auswertung fehlgeschlagen — bitte manuell erfassen";
    }
  }

  if (!ergebnis && !hinweisOhneAuswertung) return { erkanntAlsRechnung: false };

  // Ab hier: entweder ein per ZUGFeRD/KI ausgewertetes Ergebnis ODER ein Anhang, der erkennbar
  // eine Rechnung sein soll, aber nicht automatisch ausgewertet werden konnte — beides landet als
  // Item im Eingang, damit nichts stillschweigend verloren geht; im zweiten Fall ohne
  // Datenvorschlag, rein zur manuellen Erfassung.
  if (!batchIdRef.id) {
    const batch = await prisma.kiEingangsrechnungBatch.create({
      data: { quelle: "email", notiz: `Aus E-Mail-Eingang: ${mail.von}${mail.betreff ? ` – ${mail.betreff}` : ""}` },
    });
    batchIdRef.id = batch.id;
    // Sofort auf der MailImport-Zeile vermerken (nicht erst am Ende von verarbeiteMail) — bricht
    // ein SPÄTERER Anhang derselben Mail mit einer echten Rate-Limit-Überlastung ab (throw statt
    // Rückgabe), bleibt der Batch sonst unverknüpft und als Waise im Eingang stehen, ohne dass der
    // nächste Wiederholversuch ihn findet und aufräumen kann (siehe raeumeUnvollstaendigenBatchAuf()).
    await prisma.eingangsRechnungMailImport.update({ where: { id: mailImportId }, data: { batchId: batch.id } });
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

  if (hinweisOhneAuswertung) {
    const felderStub = [hinweisOhneAuswertung];
    if (dublette) felderStub.push(`Möglicherweise Dublette eines bereits importierten Anhangs (Item #${dublette.id})`);
    await prisma.kiEingangsrechnungBatchItem.create({
      data: {
        batchId,
        reihenfolge: index,
        dateiPfad: `ki-eingangsrechnung-batch/${batchId}/${filename}`,
        dateiName: anhang.dateiname,
        status: "analysiert",
        mailImportId,
        dateiHash,
        fehlendeFelder: JSON.stringify(felderStub),
      },
    });
    return { erkanntAlsRechnung: true };
  }

  const e = ergebnis!;
  const { lieferantId, konfidenz, ibanAbweichung } = matchLieferant(e, lieferantenState.lieferanten, lieferantenState.gelernt);
  const felder = { lieferantKonfidenz: lieferantId ? konfidenz : ("keine" as Konfidenz), nummer: e.belegNr, datum: e.datum, betragNetto: e.betragNetto };
  const fehlendeFelder = berechneFehlendeFelderEingangsrechnung(felder);
  if (dublette) {
    fehlendeFelder.push(`Möglicherweise Dublette eines bereits importierten Anhangs (Item #${dublette.id})`);
  }
  if (ibanAbweichung) {
    // Nie automatisch "passt" bei abweichender Bankverbindung — klassisches Betrugsmuster bei
    // per Mail eingehenden Rechnungen ("unsere IBAN hat sich geändert").
    fehlendeFelder.push("Bankverbindung auf dem Beleg weicht von der hinterlegten IBAN ab — vor Übernahme telefonisch beim Lieferanten verifizieren");
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
  return erkannt;
}

/** Löscht einen unvollständigen Batch (samt Items per @relation onDelete:Cascade) und sein
 * Upload-Verzeichnis — genutzt, bevor ein vorheriger, abgebrochener Verarbeitungsversuch derselben
 * Mail wiederholt wird, damit der Retry nicht Dubletten-Items neben den schon vorhandenen anlegt. */
async function raeumeUnvollstaendigenBatchAuf(batchId: number): Promise<void> {
  try {
    await prisma.kiEingangsrechnungBatch.delete({ where: { id: batchId } });
  } catch (err) {
    // Batch existiert ggf. schon nicht mehr (z.B. inzwischen manuell verworfen) — kein Problem.
    log.warn("E-Mail-Rechnungseingang: Aufräumen eines unvollständigen Batches fehlgeschlagen", { batchId, fehler: String(err) });
  }
  const dir = path.join(getUploadBase(), "ki-eingangsrechnung-batch", String(batchId));
  await rm(dir, { recursive: true, force: true }).catch((err) => {
    log.warn("E-Mail-Rechnungseingang: Upload-Verzeichnis eines unvollständigen Batches konnte nicht gelöscht werden", { batchId, fehler: String(err) });
  });
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

  // Vorab prüfen statt erst beim ersten PDF-Anhang zu scheitern: ohne Mistral-Key würde sonst
  // JEDE Mail mit einem nicht-ZUGFeRD-Anhang einen (KI-Anteil-)Fehlschlag produzieren, bevor der
  // Nutzer überhaupt eine Chance hatte, den Key unter Einstellungen → KI nachzutragen. Rein
  // ZUGFeRD-Anhänge kämen zwar auch ohne Key durch — dieser Kompromiss (lieber einmal klar
  // "nicht konfiguriert" melden als potenziell viele Mails als "fehler" verbrennen) ist bewusst.
  const aiCfg = await getAiConfig("ocr");
  if (!aiCfg.mistralKey) return leer("Mistral API-Key nicht konfiguriert (Einstellungen → KI)");

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

    if (bestehend) {
      const istFinal = bestehend.status === "rechnung_erkannt" || bestehend.status === "keine_rechnung";
      const istEndgueltigAufgegeben = bestehend.status === "fehler" && bestehend.versuche >= MAX_VERSUCHE;
      if (istFinal || istEndgueltigAufgegeben) {
        // Bereits final verarbeitet (oder endgültig aufgegeben) — nur den Fortschritt bestätigen
        // und weiter, kein erneuter (teurer) Verarbeitungsversuch.
        await mail.bestaetige();
        continue;
      }

      const istHaengengeblieben =
        bestehend.status === "neu" && Date.now() - bestehend.createdAt.getTime() > HAENGENGEBLIEBEN_NACH_MS;
      if (bestehend.status === "neu" && !istHaengengeblieben) {
        // Noch nicht lange genug auf "neu" — vermutlich verarbeitet ein anderer, gerade
        // laufender Aufruf (Cron + manuelles "Jetzt abrufen" überschneiden sich) diese Mail
        // bereits. Weder bestätigen (Cursor bleibt stehen, der andere Lauf bestätigt ihn) noch
        // hier ein zweites Mal anstoßen.
        continue;
      }

      // Retry (fehler mit verbleibenden Versuchen ODER hängengebliebenes "neu") — einen aus dem
      // letzten, abgebrochenen Versuch evtl. stehen gebliebenen Teil-Batch zuerst aufräumen,
      // sonst entstehen bei jedem Wiederholversuch zusätzliche Dubletten-Items im selben Eingang.
      if (bestehend.batchId) {
        await raeumeUnvollstaendigenBatchAuf(bestehend.batchId);
      }
    }

    const importZeile = bestehend
      ? await prisma.eingangsRechnungMailImport.update({
          where: { id: bestehend.id },
          data: { versuche: { increment: 1 }, status: "neu", batchId: null, fehlerText: null },
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
      // Cursor NUR bestätigen, wenn die Wiederholversuche jetzt aufgebraucht sind (endgültig
      // aufgegeben) — sonst würde ein vorübergehender Fehler (Netzwerk, Mistral-5xx, ein zwischen-
      // zeitlich fehlender Key) die Mail beim nächsten Lauf gar nicht mehr sehen, obwohl
      // `versuche`/MAX_VERSUCHE eigentlich noch einen weiteren Versuch vorsehen. Bleibt die Mail
      // unbestätigt, holt sie der nächste Lauf erneut ab (siehe Dedupe-Prüfung oben).
      if (importZeile.versuche >= MAX_VERSUCHE) {
        await mail.bestaetige();
      }
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
