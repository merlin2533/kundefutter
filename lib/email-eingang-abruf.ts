// Roh-Abruf eingehender E-Mails für den automatischen Eingangsrechnungs-Import — zwei Provider,
// eine gemeinsame Ausgabeform (EingehendeMail), damit lib/email-eingang-verarbeitung.ts beide
// identisch weiterverarbeiten kann.
//
// IMAP: liest ein bestehendes Postfach direkt aus (der Nutzer trägt Host/User/Passwort eines
// vorhandenen Mailservers ein — SMTP allein kann keine Mails ABHOLEN, deshalb IMAP statt des
// Namens "SMTP" aus der ursprünglichen Anfrage). Microsoft 365: Graph-API mit Client-Credentials-
// Flow (Application-Permission Mail.Read auf ein Postfach) — bewusst OHNE @azure/msal-*- oder
// @microsoft/microsoft-graph-client-Abhängigkeit, nur `fetch()` gegen zwei feste, nicht vom Nutzer
// konfigurierbare Hosts (login.microsoftonline.com, graph.microsoft.com) — das schließt SSRF über
// eine frei wählbare Basis-URL aus (der IMAP-Host ist zwangsläufig frei wählbar, das Feld liegt
// aber hinter P.EINSTELLUNGEN_BEARBEITEN).
//
// Cursor-Strategie (bewusst NICHT "ungelesen"/isRead-basiert — würde durch bloßes Öffnen der
// Mailbox in einem beliebigen Mail-Client kaputtgehen bzw. das Postfach des Nutzers verändern):
// IMAP führt einen UID-Cursor (email.eingang.imap.{uidvalidity,letzteUid}), Microsoft 365 einen
// Zeitstempel-Cursor (email.eingang.m365.letzterAbruf). Beide werden erst vom AUFRUFER (siehe
// lib/email-eingang-verarbeitung.ts) über `bestaetige()` je Mail fortgeschrieben, NACHDEM diese
// Mail final verarbeitet wurde — eine Mail, die mit einem wiederholbaren Fehler endet, lässt den
// Cursor bewusst dort stehen, damit der nächste Lauf sie erneut liefert.

import { createHash } from "crypto";
import { ImapFlow } from "imapflow";
import { simpleParser } from "mailparser";
import type { EmailEingangConfig } from "./email-eingang-config";
import { speichereImapCursor, speichereM365Cursor } from "./email-eingang-config";
import { log } from "./logger";

export interface EingehendeMailAnhang {
  dateiname: string;
  /** Vom Mailserver/-client gemeldeter Content-Type — NICHT vertrauenswürdig (siehe
   * erkenneDateityp() in lib/email-eingang-verarbeitung.ts, das den Inhalt selbst per Magic Bytes
   * prüft, statt diesem Feld zu glauben). */
  contentTypeGemeldet: string;
  buffer: Buffer;
}

export interface EingehendeMail {
  messageId: string;
  von: string;
  betreff: string | null;
  empfangenAm: Date;
  anhaenge: EingehendeMailAnhang[];
  /** Persistiert den Abruf-Fortschritt bis einschließlich dieser Mail. Vom Aufrufer NUR aufrufen,
   * nachdem die Mail final verarbeitet wurde (nicht bei einem Fehler, der wiederholt werden soll). */
  bestaetige: () => Promise<void>;
}

// Deckel pro Lauf — ein Cron-Tick läuft sequenziell in einem einzigen HTTP-Request ohne eigenes
// Timeout (siehe docker-entrypoint.sh), jeder Anhang kostet einen OCR+LLM-Mistral-Aufruf im
// Sekundenbereich. Ohne Deckel würde die erste Aktivierung an einem Postfach mit vielen
// ungefilterten Mails den kompletten Cron-Lauf (und damit auch die nachfolgenden Jobs) blockieren.
export const MAX_MAILS_PRO_LAUF = 10;
export const MAX_ANHAENGE_PRO_MAIL = 10;
// Gesamtgröße einer Mail (alle Anhänge zusammen) bzw. eines einzelnen Anhangs — Obergrenze VOR dem
// Laden des vollen Inhalts geprüft, wo das der jeweilige Provider zulässt (IMAP: BODYSTRUCTURE-
// Größe vor dem eigentlichen Source-Fetch; Graph: das size-Feld der Anhangs-Metadaten).
const MAX_ANHANG_GROESSE = 20 * 1024 * 1024; // wie beim bestehenden Beleg-Upload (POST .../beleg)
const MAX_MAIL_GESAMTGROESSE = 40 * 1024 * 1024;

/** Ersatz-Schlüssel für Mails ohne (oder mit leerem) Message-ID-Header — seltene, aber reale Fälle
 * (z.B. manche Massenversand-Systeme). Fingerprint aus Absender+Betreff+Datum+Anfang des ersten
 * Anhangs, damit ein und dieselbe zweimal zugestellte Mail trotzdem als Duplikat erkannt wird. */
function ersatzMessageId(von: string, betreff: string | null, empfangenAm: Date, ersterAnhang: Buffer | null): string {
  const hash = createHash("sha256");
  hash.update(von);
  hash.update("\u0000");
  hash.update(betreff ?? "");
  hash.update("\u0000");
  hash.update(empfangenAm.toISOString());
  if (ersterAnhang) {
    hash.update("\u0000");
    hash.update(ersterAnhang.subarray(0, 4096));
  }
  return `ersatz:${hash.digest("hex")}`;
}

// ─── IMAP ────────────────────────────────────────────────────────────────────

export async function holeImapMails(
  cfg: EmailEingangConfig["imap"],
  aktivSeit: Date | null
): Promise<EingehendeMail[]> {
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true, // unverschlüsseltes IMAP wird bewusst nicht angeboten (siehe Datei-Kopfkommentar)
    auth: { user: cfg.user, pass: cfg.passwort },
    logger: false,
  });

  await client.connect();
  try {
    const mailbox = await client.mailboxOpen(cfg.ordner, { readOnly: true });
    const uidValidity = mailbox.uidValidity.toString();
    const uidValidityUnveraendert = !!cfg.uidvalidity && cfg.uidvalidity === uidValidity;

    let uids: number[];
    if (uidValidityUnveraendert && cfg.letzteUid > 0) {
      const gefunden = await client.search({ uid: `${cfg.letzteUid + 1}:*` }, { uid: true });
      uids = Array.isArray(gefunden) ? gefunden.filter((u) => u > cfg.letzteUid) : [];
    } else {
      // Erster Lauf ODER die Mailbox wurde serverseitig neu angelegt (UIDVALIDITY-Wechsel, alte
      // UIDs bedeutungslos) — dann über das Empfangsdatum eingrenzen statt die volle Historie zu
      // laden. `aktivSeit` ist beim Einschalten der Funktion immer gesetzt (siehe
      // app/api/einstellungen/email-eingang/route.ts); ohne es sicherheitshalber gar nichts holen.
      if (!aktivSeit) return [];
      const gefunden = await client.search({ since: aktivSeit }, { uid: true });
      uids = Array.isArray(gefunden) ? gefunden : [];
    }

    uids.sort((a, b) => a - b);
    const zuVerarbeiten = uids.slice(0, MAX_MAILS_PRO_LAUF);
    if (zuVerarbeiten.length === 0) return [];

    // Größe zuerst OHNE Inhalt prüfen, damit eine riesige Mail nicht komplett in den Speicher
    // geladen wird, bevor sie ohnehin verworfen würde.
    const metaByUid = new Map<number, { size?: number }>();
    for await (const msg of client.fetch(zuVerarbeiten, { uid: true, size: true }, { uid: true })) {
      metaByUid.set(msg.uid, { size: msg.size });
    }

    const ergebnis: EingehendeMail[] = [];
    let hoechsteVerarbeiteteUid = cfg.letzteUid;

    for (const uid of zuVerarbeiten) {
      const meta = metaByUid.get(uid);
      const bestaetige = async () => {
        hoechsteVerarbeiteteUid = Math.max(hoechsteVerarbeiteteUid, uid);
        await speichereImapCursor(uidValidity, hoechsteVerarbeiteteUid);
      };

      if (meta?.size != null && meta.size > MAX_MAIL_GESAMTGROESSE) {
        // Wird trotzdem als "verarbeitet" bestätigt (Cursor rückt vor) — eine zu große Mail bleibt
        // dauerhaft zu groß, ein Wiederholversuch würde nichts ändern.
        log.warn("E-Mail-Rechnungseingang: Mail übersprungen (zu groß)", { uid, size: meta.size });
        await bestaetige();
        continue;
      }

      const full = await client.fetchOne(String(uid), { uid: true, source: true, envelope: true, internalDate: true }, { uid: true });
      if (!full || !full.source) {
        await bestaetige();
        continue;
      }

      const parsed = await simpleParser(full.source);
      const von = parsed.from?.text ?? full.envelope?.from?.[0]?.address ?? "unbekannt";
      const betreff = parsed.subject ?? full.envelope?.subject ?? null;
      const empfangenAm = parsed.date ?? (full.internalDate instanceof Date ? full.internalDate : new Date());

      const anhaenge: EingehendeMailAnhang[] = [];
      let gesamtgroesse = 0;
      for (const att of parsed.attachments) {
        if (anhaenge.length >= MAX_ANHAENGE_PRO_MAIL) break;
        // Inline-Bilder (Signatur-Logos, cid:-Referenzen) sind praktisch nie Rechnungen — deren
        // Analyse wäre nur unnötig teure/falsche Mistral-Aufrufe.
        if (att.contentDisposition === "inline") continue;
        if (att.size > MAX_ANHANG_GROESSE) continue;
        gesamtgroesse += att.size;
        if (gesamtgroesse > MAX_MAIL_GESAMTGROESSE) break;
        anhaenge.push({
          dateiname: att.filename ?? `anhang-${anhaenge.length + 1}`,
          contentTypeGemeldet: att.contentType,
          buffer: att.content,
        });
      }

      const messageId =
        parsed.messageId?.trim() ||
        full.envelope?.messageId?.trim() ||
        ersatzMessageId(von, betreff, empfangenAm, anhaenge[0]?.buffer ?? null);

      ergebnis.push({ messageId, von, betreff, empfangenAm, anhaenge, bestaetige });
    }

    return ergebnis;
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

export async function testeImapVerbindung(cfg: EmailEingangConfig["imap"]): Promise<void> {
  const client = new ImapFlow({
    host: cfg.host,
    port: cfg.port,
    secure: true,
    auth: { user: cfg.user, pass: cfg.passwort },
    logger: false,
  });
  await client.connect();
  try {
    await client.mailboxOpen(cfg.ordner, { readOnly: true });
  } finally {
    try {
      await client.logout();
    } catch {
      client.close();
    }
  }
}

// ─── Microsoft 365 / Graph ───────────────────────────────────────────────────

// Nur diese zwei festen Hosts werden angesprochen — nie eine vom Nutzer konfigurierte Basis-URL
// (siehe Datei-Kopfkommentar zu SSRF).
const GRAPH_TOKEN_HOST = "https://login.microsoftonline.com";
const GRAPH_API_HOST = "https://graph.microsoft.com/v1.0";

// Tenant-ID ist entweder eine GUID oder eine "contoso.onmicrosoft.com"-Domain — beides wird direkt
// in den Token-URL-Pfad eingesetzt, daher vor der Verwendung strikt validiert.
const TENANT_ID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$|^[a-zA-Z0-9.-]+\.onmicrosoft\.com$|^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
// Mailbox ist eine E-Mail-Adresse (UPN eines Postfachs bzw. eines Shared Mailbox) — wird ebenfalls
// direkt in den URL-Pfad eingesetzt.
const MAILBOX_PATTERN = /^[^@\s/?#]+@[^@\s/?#]+\.[^@\s/?#]+$/;

async function holeGraphToken(cfg: EmailEingangConfig["m365"]): Promise<string> {
  if (!TENANT_ID_PATTERN.test(cfg.tenantId)) {
    throw new Error("Ungültige Tenant-ID/-Domain");
  }
  const res = await fetch(`${GRAPH_TOKEN_HOST}/${encodeURIComponent(cfg.tenantId)}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      scope: "https://graph.microsoft.com/.default",
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Microsoft-365-Anmeldung fehlgeschlagen (${res.status}): ${body.slice(0, 300)}`);
  }
  const json = (await res.json()) as { access_token?: string };
  if (!json.access_token) throw new Error("Microsoft-365-Anmeldung lieferte keinen Access-Token");
  return json.access_token;
}

function pruefeMailbox(mailbox: string): string {
  if (!MAILBOX_PATTERN.test(mailbox)) throw new Error("Ungültige Postfach-Adresse");
  return encodeURIComponent(mailbox);
}

interface GraphMessage {
  id: string;
  subject?: string;
  from?: { emailAddress?: { address?: string; name?: string } };
  receivedDateTime: string;
  internetMessageId?: string;
  hasAttachments: boolean;
}

interface GraphAttachmentMeta {
  id: string;
  name: string;
  contentType: string;
  size: number;
  isInline: boolean;
  "@odata.type": string;
}

export async function holeM365Mails(cfg: EmailEingangConfig["m365"], aktivSeit: Date | null): Promise<EingehendeMail[]> {
  const token = await holeGraphToken(cfg);
  const mailboxPath = pruefeMailbox(cfg.mailbox);
  const authHeader = { Authorization: `Bearer ${token}` };

  const seit = cfg.letzterAbruf ?? aktivSeit;
  if (!seit) return [];

  const filter = `receivedDateTime gt ${seit.toISOString()}`;
  const listUrl =
    `${GRAPH_API_HOST}/users/${mailboxPath}/mailFolders/inbox/messages` +
    `?$filter=${encodeURIComponent(filter)}&$orderby=receivedDateTime asc&$top=${MAX_MAILS_PRO_LAUF}` +
    `&$select=id,subject,from,receivedDateTime,internetMessageId,hasAttachments`;

  const listRes = await fetch(listUrl, { headers: authHeader });
  if (!listRes.ok) {
    const body = await listRes.text().catch(() => "");
    throw new Error(`Microsoft-365-Abruf fehlgeschlagen (${listRes.status}): ${body.slice(0, 300)}`);
  }
  const listJson = (await listRes.json()) as { value?: GraphMessage[] };
  const messages = listJson.value ?? [];

  const ergebnis: EingehendeMail[] = [];
  let neuesterZeitpunkt = seit;

  for (const msg of messages) {
    const empfangenAm = new Date(msg.receivedDateTime);
    const bestaetige = async () => {
      if (empfangenAm > neuesterZeitpunkt) neuesterZeitpunkt = empfangenAm;
      await speichereM365Cursor(neuesterZeitpunkt);
    };

    const von = msg.from?.emailAddress?.address ?? "unbekannt";
    const betreff = msg.subject ?? null;
    const anhaenge: EingehendeMailAnhang[] = [];

    if (msg.hasAttachments) {
      const metaRes = await fetch(
        `${GRAPH_API_HOST}/users/${mailboxPath}/messages/${msg.id}/attachments?$select=id,name,contentType,size,isInline`,
        { headers: authHeader }
      );
      if (metaRes.ok) {
        const metaJson = (await metaRes.json()) as { value?: GraphAttachmentMeta[] };
        let gesamtgroesse = 0;
        for (const att of metaJson.value ?? []) {
          if (anhaenge.length >= MAX_ANHAENGE_PRO_MAIL) break;
          if (att.isInline) continue;
          if (att["@odata.type"] !== "#microsoft.graph.fileAttachment") continue; // z.B. keine Termin-/Kontakt-Anhänge
          if (att.size > MAX_ANHANG_GROESSE) continue;
          gesamtgroesse += att.size;
          if (gesamtgroesse > MAX_MAIL_GESAMTGROESSE) break;

          const contentRes = await fetch(`${GRAPH_API_HOST}/users/${mailboxPath}/messages/${msg.id}/attachments/${att.id}`, {
            headers: authHeader,
          });
          if (!contentRes.ok) continue;
          const contentJson = (await contentRes.json()) as { contentBytes?: string };
          if (!contentJson.contentBytes) continue;
          anhaenge.push({
            dateiname: att.name,
            contentTypeGemeldet: att.contentType,
            buffer: Buffer.from(contentJson.contentBytes, "base64"),
          });
        }
      } else {
        log.warn("E-Mail-Rechnungseingang: Anhänge einer M365-Mail konnten nicht geladen werden", {
          messageId: msg.id,
          status: metaRes.status,
        });
      }
    }

    const messageId =
      msg.internetMessageId?.trim() || ersatzMessageId(von, betreff, empfangenAm, anhaenge[0]?.buffer ?? null);

    ergebnis.push({ messageId, von, betreff, empfangenAm, anhaenge, bestaetige });
  }

  return ergebnis;
}

export async function testeM365Verbindung(cfg: EmailEingangConfig["m365"]): Promise<void> {
  const token = await holeGraphToken(cfg);
  const mailboxPath = pruefeMailbox(cfg.mailbox);
  const res = await fetch(`${GRAPH_API_HOST}/users/${mailboxPath}/mailFolders/inbox?$select=id`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Postfach nicht erreichbar (${res.status}): ${body.slice(0, 300)}`);
  }
}
