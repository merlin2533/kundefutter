/**
 * Nextcloud-Dokumentenabgleich via WebDAV
 *
 * Einmaliger Sync: App → Nextcloud (kein Rücklesen, kein Konfliktmanagement).
 * Auth: Nextcloud-App-Passwort + HTTP Basic Auth über
 * `{serverUrl}/remote.php/dav/files/{username}/...`.
 *
 * Setup: Nextcloud → Einstellungen → Sicherheit → neues App-Passwort erzeugen,
 * dann Server-URL/Benutzername/App-Passwort unter /einstellungen/nextcloud hinterlegen.
 */

import { XMLParser } from "fast-xml-parser";
import { prisma } from "./prisma";

// ─── Einstellungen ────────────────────────────────────────────────────────────

interface NextcloudConfig {
  serverUrl: string;
  username: string;
  appPassword: string;
  rootPfad: string;
}

async function getEinstellung(key: string): Promise<string | null> {
  const e = await prisma.einstellung.findUnique({ where: { key } });
  return e?.value ?? null;
}

async function getConfig(): Promise<NextcloudConfig | null> {
  const [serverUrl, username, appPassword, rootPfad] = await Promise.all([
    getEinstellung("system.nextcloud.serverUrl"),
    getEinstellung("system.nextcloud.username"),
    getEinstellung("system.nextcloud.appPassword"),
    getEinstellung("system.nextcloud.rootPfad"),
  ]);
  if (!serverUrl || !username || !appPassword) return null;
  return {
    serverUrl: serverUrl.replace(/\/+$/, ""),
    username,
    appPassword,
    rootPfad: rootPfad?.trim() || "/AGRI-Office",
  };
}

export async function isNextcloudKonfiguriert(): Promise<boolean> {
  return (await getConfig()) !== null;
}

async function requireConfig(): Promise<NextcloudConfig> {
  const cfg = await getConfig();
  if (!cfg) {
    throw new Error(
      "Nextcloud nicht konfiguriert. Bitte Server-URL, Benutzername und App-Passwort in den Einstellungen hinterlegen."
    );
  }
  return cfg;
}

// ─── WebDAV-Grundlagen ────────────────────────────────────────────────────────

function authHeader(cfg: NextcloudConfig): string {
  return "Basic " + Buffer.from(`${cfg.username}:${cfg.appPassword}`).toString("base64");
}

function joinPfad(...parts: string[]): string {
  return parts
    .map((p) => p.replace(/^\/+|\/+$/g, ""))
    .filter(Boolean)
    .join("/");
}

function absPfad(cfg: NextcloudConfig, relPfad: string): string {
  return joinPfad(cfg.rootPfad, relPfad);
}

function urlFuerAbsolutenPfad(cfg: NextcloudConfig, absolutePfad: string): string {
  const encoded = absolutePfad
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
  return `${cfg.serverUrl}/remote.php/dav/files/${encodeURIComponent(cfg.username)}${
    encoded ? "/" + encoded : ""
  }`;
}

function buildWebViewLink(cfg: NextcloudConfig, relOrdnerPfad: string): string {
  const dir = "/" + absPfad(cfg, relOrdnerPfad);
  return `${cfg.serverUrl}/apps/files/?dir=${encodeURIComponent(dir)}`;
}

async function mkcol(cfg: NextcloudConfig, absolutePfadSegment: string): Promise<void> {
  const url = urlFuerAbsolutenPfad(cfg, absolutePfadSegment);
  const res = await fetch(url, { method: "MKCOL", headers: { Authorization: authHeader(cfg) } });
  // 201 = angelegt, 405 = existiert bereits (Method Not Allowed auf vorhandener Collection)
  if (res.status === 201 || res.status === 405) return;
  throw new Error(`Nextcloud: Ordner konnte nicht angelegt werden (${res.status}): ${absolutePfadSegment}`);
}

/**
 * Legt einen Ordnerpfad (relativ zum konfigurierten Root) an, inkl. aller
 * Zwischenordner. Idempotent — existierende Ordner werden übersprungen.
 */
export async function ensureOrdner(relPfad: string): Promise<void> {
  const cfg = await requireConfig();
  const segmente = absPfad(cfg, relPfad).split("/").filter(Boolean);
  let current = "";
  for (const segment of segmente) {
    current = current ? `${current}/${segment}` : segment;
    await mkcol(cfg, current);
  }
}

// ─── Datei-Modell ─────────────────────────────────────────────────────────────

export interface NextcloudDatei {
  name: string;
  pfad: string; // relativ zum Root, inkl. Dateiname
  groesse?: string;
  geaendertAm?: string;
  mimeType?: string;
  webViewLink: string;
}

function formatDateigroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadDatei(
  relPfad: string,
  dateiname: string,
  buffer: Buffer,
  mimeType: string = "application/octet-stream"
): Promise<NextcloudDatei> {
  const cfg = await requireConfig();
  await ensureOrdner(relPfad);

  const safeName = dateiname.replace(/[/\\]/g, "_");
  const zielAbsPfad = joinPfad(absPfad(cfg, relPfad), safeName);
  const url = urlFuerAbsolutenPfad(cfg, zielAbsPfad);

  const res = await fetch(url, {
    method: "PUT",
    headers: { Authorization: authHeader(cfg), "Content-Type": mimeType },
    body: buffer,
  });
  if (res.status !== 201 && res.status !== 204) {
    throw new Error(`Nextcloud-Upload fehlgeschlagen (${res.status}): ${safeName}`);
  }

  return {
    name: safeName,
    pfad: joinPfad(relPfad, safeName),
    groesse: formatDateigroesse(buffer.byteLength),
    geaendertAm: new Date().toISOString(),
    mimeType,
    webViewLink: buildWebViewLink(cfg, relPfad),
  };
}

/**
 * Prüft, ob unter dem angegebenen (Root-relativen) Pfad bereits eine Datei liegt.
 * Zentral für die Idempotenz des Backfill-Jobs (keine doppelten Uploads bei Retry).
 */
export async function dateiExistiert(relPfadMitDatei: string): Promise<boolean> {
  const cfg = await requireConfig();
  const url = urlFuerAbsolutenPfad(cfg, absPfad(cfg, relPfadMitDatei));
  const res = await fetch(url, { method: "HEAD", headers: { Authorization: authHeader(cfg) } });
  if (res.status === 200 || res.status === 204) return true;
  if (res.status === 404) return false;
  throw new Error(`Nextcloud: Existenzprüfung fehlgeschlagen (${res.status}): ${relPfadMitDatei}`);
}

/**
 * Verschiebt einen Ordner (z.B. bei Kunden-/Artikel-Umbenennung). No-op, falls
 * der Quellordner noch nicht existiert (z.B. neu angelegter Kunde ohne Dateien).
 */
export async function verschiebeOrdner(altRelPfad: string, neuRelPfad: string): Promise<void> {
  const cfg = await requireConfig();
  const altUrl = urlFuerAbsolutenPfad(cfg, absPfad(cfg, altRelPfad));
  const neuUrl = urlFuerAbsolutenPfad(cfg, absPfad(cfg, neuRelPfad));
  const res = await fetch(altUrl, {
    method: "MOVE",
    headers: { Authorization: authHeader(cfg), Destination: neuUrl, Overwrite: "F" },
  });
  if (res.status === 404) return;
  if (res.status !== 201 && res.status !== 204) {
    throw new Error(`Nextcloud: Ordner konnte nicht verschoben werden (${res.status})`);
  }
}

// ─── Dateiliste (PROPFIND) ────────────────────────────────────────────────────

const xmlParser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: false });

const PROPFIND_BODY = `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:oc="http://owncloud.org/ns">
  <d:prop>
    <d:getcontentlength/>
    <d:getlastmodified/>
    <d:getcontenttype/>
    <d:resourcetype/>
    <oc:fileid/>
  </d:prop>
</d:propfind>`;

function toArray<T>(v: T | T[] | undefined): T[] {
  if (v === undefined) return [];
  return Array.isArray(v) ? v : [v];
}

interface PropfindEintrag {
  href: string;
  contentlength?: string;
  lastmodified?: string;
  contenttype?: string;
  fileid?: string;
  isCollection: boolean;
}

function parsePropfindListe(xml: string): PropfindEintrag[] {
  const parsed = xmlParser.parse(xml);
  const responses = toArray(parsed?.multistatus?.response);
  return responses.map((r) => {
    const propstats = toArray(r.propstat);
    const ok = propstats.find((p) => String(p?.status ?? "").includes("200")) ?? propstats[0];
    const prop = ok?.prop ?? {};
    const resourcetype = prop.resourcetype;
    const isCollection =
      resourcetype != null && typeof resourcetype === "object" && "collection" in resourcetype;
    return {
      href: String(r.href ?? ""),
      contentlength: prop.getcontentlength != null ? String(prop.getcontentlength) : undefined,
      lastmodified: prop.getlastmodified != null ? String(prop.getlastmodified) : undefined,
      contenttype: prop.getcontenttype != null ? String(prop.getcontenttype) : undefined,
      fileid: prop.fileid != null ? String(prop.fileid) : undefined,
      isCollection,
    };
  });
}

/**
 * Listet Dateien (keine Unterordner) in einem Root-relativen Pfad.
 * Gibt ein leeres Array zurück, wenn der Ordner noch nicht existiert.
 */
export async function listeDateien(relPfad: string): Promise<NextcloudDatei[]> {
  const cfg = await requireConfig();
  const url = urlFuerAbsolutenPfad(cfg, absPfad(cfg, relPfad));
  const res = await fetch(url, {
    method: "PROPFIND",
    headers: { Authorization: authHeader(cfg), Depth: "1", "Content-Type": "application/xml" },
    body: PROPFIND_BODY,
  });
  if (res.status === 404) return [];
  if (res.status !== 207) {
    throw new Error(`Nextcloud: Ordner konnte nicht gelistet werden (${res.status}): ${relPfad}`);
  }
  const xml = await res.text();
  const webViewLink = buildWebViewLink(cfg, relPfad);

  return parsePropfindListe(xml)
    .filter((e) => !e.isCollection) // schließt den Ordner selbst (immer eine Collection) automatisch aus
    .map((e) => {
      const decoded = decodeURIComponent(e.href).replace(/\/+$/, "");
      const name = decoded.split("/").pop() ?? decoded;
      return {
        name,
        pfad: joinPfad(relPfad, name),
        groesse: e.contentlength ? formatDateigroesse(parseInt(e.contentlength, 10)) : undefined,
        geaendertAm: e.lastmodified ? new Date(e.lastmodified).toISOString() : undefined,
        mimeType: e.contenttype,
        webViewLink: e.fileid ? `${cfg.serverUrl}/f/${e.fileid}` : webViewLink,
      } satisfies NextcloudDatei;
    })
    .sort((a, b) => (b.geaendertAm ?? "").localeCompare(a.geaendertAm ?? ""));
}

// ─── Verbindungstest ──────────────────────────────────────────────────────────

export async function testVerbindung(): Promise<{ ok: boolean; fehler?: string }> {
  try {
    const cfg = await requireConfig();
    await ensureOrdner(""); // legt den Root-Ordner an, falls er noch nicht existiert
    const url = urlFuerAbsolutenPfad(cfg, absPfad(cfg, ""));
    const res = await fetch(url, {
      method: "PROPFIND",
      headers: { Authorization: authHeader(cfg), Depth: "0", "Content-Type": "application/xml" },
      body: PROPFIND_BODY,
    });
    if (res.status === 401 || res.status === 403) return { ok: false, fehler: "Zugangsdaten ungültig" };
    if (res.status !== 207) return { ok: false, fehler: `Unerwartete Antwort vom Server (${res.status})` };
    return { ok: true };
  } catch (e) {
    return { ok: false, fehler: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Pfad-Helfer (rein, unit-testbar ohne Netzwerk) ───────────────────────────

export function sanitizeOrdnerName(name: string): string {
  const bereinigt = name
    .replace(/[/\\:*?"<>|]/g, "_")
    .replace(/\s+/g, " ")
    .trim();
  return bereinigt.slice(0, 150) || "Unbenannt";
}

export function kundenOrdnerPfad(kundeId: number, kundeName: string): string {
  return `Kunden/${sanitizeOrdnerName(kundeName)} (ID-${kundeId})`;
}

export function artikelOrdnerPfad(artikelId: number, artikelName: string): string {
  return `Artikel/${sanitizeOrdnerName(artikelName)} (ID-${artikelId})`;
}

/**
 * Alte Ordner-Pfade mit ":" statt "-" vor dem ID-Trennzeichen (bis 2026-07-24).
 * ":" wird von manchen Nextcloud-Speicher-Backends (z.B. externe Windows-/exFAT-
 * Dateisysteme) nicht unterstützt und führte zu Warnungen im Nextcloud-Client.
 * Nur für die einmalige Umbenennungs-Migration im Backfill-Job (`lib/nextcloud-backfill.ts`)
 * benötigt — neue Uploads verwenden ausschließlich `kundenOrdnerPfad`/`artikelOrdnerPfad`.
 */
export function kundenOrdnerPfadLegacy(kundeId: number, kundeName: string): string {
  return `Kunden/${sanitizeOrdnerName(kundeName)} (ID:${kundeId})`;
}

export function artikelOrdnerPfadLegacy(artikelId: number, artikelName: string): string {
  return `Artikel/${sanitizeOrdnerName(artikelName)} (ID:${artikelId})`;
}

export type BuchhaltungsTyp =
  | "Ausgangsrechnungen"
  | "Eingangsrechnungen"
  | "Ausgaben"
  | "Gutschriften"
  | "DATEV-Exporte";

export function buchhaltungsPfad(jahr: number, monat: number, unterordner: BuchhaltungsTyp): string {
  return `Buchhaltung/${jahr}/${String(monat).padStart(2, "0")}/${unterordner}`;
}

// ─── Hochwertige Wrapper (analog Kunden-/Artikel-Unterordner-Muster) ─────────

export type KundeDokumentTyp = "Rechnungen" | "Lieferscheine" | "Angebote" | "Gutschriften" | "Nachweise";
export type ArtikelDokumentTyp = "Dokumente" | "Chargenzertifikate";

export async function uploadPdfToKundeOrdner(
  kundeId: number,
  kundeName: string,
  unterordner: KundeDokumentTyp,
  fileName: string,
  pdfBuffer: Buffer
): Promise<NextcloudDatei> {
  return uploadDatei(joinPfad(kundenOrdnerPfad(kundeId, kundeName), unterordner), fileName, pdfBuffer, "application/pdf");
}

export async function uploadZuKundeOrdner(
  kundeId: number,
  kundeName: string,
  unterordner: KundeDokumentTyp,
  fileName: string,
  buffer: Buffer,
  mimeType?: string
): Promise<NextcloudDatei> {
  return uploadDatei(joinPfad(kundenOrdnerPfad(kundeId, kundeName), unterordner), fileName, buffer, mimeType);
}

export async function uploadZuArtikelOrdner(
  artikelId: number,
  artikelName: string,
  unterordner: ArtikelDokumentTyp,
  fileName: string,
  buffer: Buffer,
  mimeType?: string
): Promise<NextcloudDatei> {
  return uploadDatei(joinPfad(artikelOrdnerPfad(artikelId, artikelName), unterordner), fileName, buffer, mimeType);
}

export async function uploadZuBuchhaltung(
  jahr: number,
  monat: number,
  unterordner: BuchhaltungsTyp,
  fileName: string,
  buffer: Buffer,
  mimeType?: string
): Promise<NextcloudDatei> {
  return uploadDatei(buchhaltungsPfad(jahr, monat, unterordner), fileName, buffer, mimeType);
}

/**
 * Listet Dateien in einem Kunden-Unterordner. Gibt ein leeres Array zurück,
 * wenn Nextcloud nicht konfiguriert ist oder der Ordner noch nicht existiert.
 */
export async function listeDateienImKundenUnterordner(
  kundeId: number,
  kundeName: string,
  unterordner: KundeDokumentTyp
): Promise<NextcloudDatei[]> {
  try {
    return await listeDateien(joinPfad(kundenOrdnerPfad(kundeId, kundeName), unterordner));
  } catch {
    return [];
  }
}
