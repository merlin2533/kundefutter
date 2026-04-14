import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { Readable } from "stream";

export const dynamic = "force-dynamic";

const BACKUP_DIR = "/data/backups";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const filename = searchParams.get("filename");

  if (!filename) {
    return NextResponse.json({ error: "filename fehlt" }, { status: 400 });
  }

  // Dateinamen müssen ein striktes Format haben: Buchstaben/Ziffern, Unter-/
  // Bindestriche, Punkt. Keine URL-Encodings, Slashes, relativen Pfade.
  if (!/^[A-Za-z0-9._-]+$/.test(filename)) {
    return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
  }

  const filePath = path.resolve(BACKUP_DIR, filename);
  // Zusätzliche Absicherung: resolved Pfad muss innerhalb BACKUP_DIR liegen.
  if (!filePath.startsWith(path.resolve(BACKUP_DIR) + path.sep)) {
    return NextResponse.json({ error: "Ungültiger Dateiname" }, { status: 400 });
  }

  let stat: fs.Stats;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return NextResponse.json({ error: "Datei nicht gefunden" }, { status: 404 });
  }

  const nodeStream = fs.createReadStream(filePath);
  const webStream = Readable.toWeb(nodeStream) as ReadableStream;

  return new NextResponse(webStream, {
    headers: {
      "Content-Type": "application/octet-stream",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(stat.size),
    },
  });
}
