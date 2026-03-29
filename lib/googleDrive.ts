/**
 * Google Drive Integration via Service Account
 *
 * Setup:
 * 1. Google Cloud Console → Projekt → Drive API aktivieren
 * 2. IAM → Dienstkonto erstellen → JSON-Key herunterladen
 * 3. In /einstellungen/google-drive den JSON-Key hochladen
 * 4. Optional: Root-Ordner mit eigenem Google-Account teilen
 */

import { google, drive_v3 } from "googleapis";
import { prisma } from "./prisma";

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function getServiceAccountKey(): Promise<object | null> {
  const einstellung = await prisma.einstellung.findUnique({
    where: { key: "system.google.serviceAccountKey" },
  });
  if (!einstellung?.value) return null;
  try {
    return JSON.parse(einstellung.value);
  } catch {
    return null;
  }
}

async function getDriveClient(): Promise<drive_v3.Drive> {
  const key = await getServiceAccountKey();
  if (!key) throw new Error("Google Drive nicht konfiguriert. Bitte Service Account Key in den Einstellungen hinterlegen.");

  const auth = new google.auth.GoogleAuth({
    credentials: key as object,
    scopes: ["https://www.googleapis.com/auth/drive"],
  });

  return google.drive({ version: "v3", auth });
}

// ─── Einstellungen-Hilfsfunktionen ────────────────────────────────────────────

async function getEinstellung(key: string): Promise<string | null> {
  const e = await prisma.einstellung.findUnique({ where: { key } });
  return e?.value ?? null;
}

async function setEinstellung(key: string, value: string): Promise<void> {
  await prisma.einstellung.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

// ─── Ordner-Verwaltung ────────────────────────────────────────────────────────

/**
 * Erstellt einen Ordner in Google Drive oder gibt die ID zurück falls er existiert.
 */
export async function erstelleOrdner(
  drive: drive_v3.Drive,
  name: string,
  parentId: string
): Promise<string> {
  // Prüfe ob Ordner mit dem Namen bereits unter parent existiert
  const existing = await drive.files.list({
    q: `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and '${parentId}' in parents and trashed=false`,
    fields: "files(id,name)",
    spaces: "drive",
  });

  if (existing.data.files && existing.data.files.length > 0) {
    return existing.data.files[0].id!;
  }

  const folder = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
  });

  return folder.data.id!;
}

/**
 * Gibt die Root-Ordner-ID zurück (erstellt Root-Struktur beim ersten Aufruf).
 */
export async function getRootOrdnerId(drive: drive_v3.Drive): Promise<string> {
  const saved = await getEinstellung("system.google.rootOrdnerId");
  if (saved) return saved;

  // Root-Ordner "AgrarOffice" in "My Drive" erstellen
  const root = await drive.files.create({
    requestBody: {
      name: "AgrarOffice",
      mimeType: "application/vnd.google-apps.folder",
    },
    fields: "id",
  });
  const rootId = root.data.id!;
  await setEinstellung("system.google.rootOrdnerId", rootId);

  // Unterordner anlegen
  const kundenId = await erstelleOrdner(drive, "Kunden", rootId);
  await setEinstellung("system.google.kundenOrdnerId", kundenId);

  const artikelId = await erstelleOrdner(drive, "Artikel", rootId);
  await setEinstellung("system.google.artikelOrdnerId", artikelId);

  await erstelleOrdner(drive, "Zentral", rootId);

  return rootId;
}

/**
 * Gibt den Drive-Ordner eines Kunden zurück (legt ihn an falls nötig).
 * Speichert die Ordner-ID in der Datenbank.
 */
export async function getKundenOrdnerId(kundeId: number, kundeName: string): Promise<string> {
  const kunde = await prisma.kunde.findUnique({ where: { id: kundeId }, select: { driveOrdnerId: true } });
  if (kunde?.driveOrdnerId) return kunde.driveOrdnerId;

  const drive = await getDriveClient();
  await getRootOrdnerId(drive);

  const kundenParentId = await getEinstellung("system.google.kundenOrdnerId");
  if (!kundenParentId) throw new Error("Kunden-Ordner nicht gefunden");

  const name = `${kundeName} (ID:${kundeId})`;
  const folderId = await erstelleOrdner(drive, name, kundenParentId);

  await prisma.kunde.update({ where: { id: kundeId }, data: { driveOrdnerId: folderId } });
  return folderId;
}

/**
 * Gibt den Drive-Ordner eines Artikels zurück (legt ihn an falls nötig).
 */
export async function getArtikelOrdnerId(artikelId: number, artikelName: string): Promise<string> {
  const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { driveOrdnerId: true } });
  if (artikel?.driveOrdnerId) return artikel.driveOrdnerId;

  const drive = await getDriveClient();
  await getRootOrdnerId(drive);

  const artikelParentId = await getEinstellung("system.google.artikelOrdnerId");
  if (!artikelParentId) throw new Error("Artikel-Ordner nicht gefunden");

  const name = `${artikelName} (ID:${artikelId})`;
  const folderId = await erstelleOrdner(drive, name, artikelParentId);

  await prisma.artikel.update({ where: { id: artikelId }, data: { driveOrdnerId: folderId } });
  return folderId;
}

// ─── Dateiliste ───────────────────────────────────────────────────────────────

export interface DriveDatei {
  id: string;
  name: string;
  mimeType: string;
  groesse?: string;
  geaendertAm?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
}

export async function listeDateien(folderId: string): Promise<DriveDatei[]> {
  const drive = await getDriveClient();
  const res = await drive.files.list({
    q: `'${folderId}' in parents and trashed=false`,
    fields: "files(id,name,mimeType,size,modifiedTime,webViewLink,webContentLink,iconLink)",
    orderBy: "modifiedTime desc",
    spaces: "drive",
    pageSize: 100,
  });

  return (res.data.files ?? []).map((f) => ({
    id: f.id!,
    name: f.name!,
    mimeType: f.mimeType!,
    groesse: f.size ? formatDateigroesse(parseInt(f.size)) : undefined,
    geaendertAm: f.modifiedTime ?? undefined,
    webViewLink: f.webViewLink ?? undefined,
    webContentLink: f.webContentLink ?? undefined,
    iconLink: f.iconLink ?? undefined,
  }));
}

function formatDateigroesse(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Upload ───────────────────────────────────────────────────────────────────

export async function uploadDatei(
  folderId: string,
  dateiname: string,
  mimeType: string,
  buffer: Buffer
): Promise<DriveDatei> {
  const drive = await getDriveClient();
  const { Readable } = await import("stream");

  const res = await drive.files.create({
    requestBody: {
      name: dateiname,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: "id,name,mimeType,size,modifiedTime,webViewLink,webContentLink",
  });

  return {
    id: res.data.id!,
    name: res.data.name!,
    mimeType: res.data.mimeType!,
    groesse: res.data.size ? formatDateigroesse(parseInt(res.data.size)) : undefined,
    geaendertAm: res.data.modifiedTime ?? undefined,
    webViewLink: res.data.webViewLink ?? undefined,
    webContentLink: res.data.webContentLink ?? undefined,
  };
}

// ─── Verbindungstest ──────────────────────────────────────────────────────────

export async function testVerbindung(): Promise<{ ok: boolean; email?: string; fehler?: string }> {
  try {
    const drive = await getDriveClient();
    const about = await google.oauth2("v2").userinfo.get({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      auth: (drive as any)._options?.auth,
    });
    return { ok: true, email: about.data.email ?? undefined };
  } catch (e) {
    // Fallback: einfacher Drive-Aufruf
    try {
      const drive = await getDriveClient();
      await drive.files.list({ pageSize: 1, fields: "files(id)" });
      return { ok: true };
    } catch (e2) {
      return { ok: false, fehler: e2 instanceof Error ? e2.message : String(e2) };
    }
  }
}

export { getDriveClient };
