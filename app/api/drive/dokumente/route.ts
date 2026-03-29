import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadPdfToKundeOrdner, isDriveKonfiguriert, DokumentTyp } from "@/lib/googleDrive";

const TYP_ORDNER: Record<string, DokumentTyp> = {
  rechnung: "Rechnungen",
  lieferschein: "Lieferscheine",
  angebot: "Angebote",
};

/**
 * POST /api/drive/dokumente
 * Body: { kundeId, typ: "rechnung"|"lieferschein"|"angebot", dokumentId, dateiName, inhalt (base64 PDF) }
 * Response: { success: true, driveFileId, driveLink }
 */
export async function POST(req: NextRequest) {
  try {
    // Drive konfiguriert?
    const konfiguriert = await isDriveKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json(
        { error: "Google Drive nicht konfiguriert", nichtKonfiguriert: true },
        { status: 503 }
      );
    }

    const body = await req.json();
    const { kundeId, typ, dateiName, inhalt } = body as {
      kundeId?: number;
      typ?: string;
      dateiName?: string;
      inhalt?: string;
    };

    // Validierung
    if (!kundeId || isNaN(Number(kundeId))) {
      return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    }
    if (!typ || !TYP_ORDNER[typ]) {
      return NextResponse.json(
        { error: "Ungültiger Typ. Erlaubt: rechnung, lieferschein, angebot" },
        { status: 400 }
      );
    }
    if (!dateiName || typeof dateiName !== "string") {
      return NextResponse.json({ error: "dateiName fehlt" }, { status: 400 });
    }
    if (!inhalt || typeof inhalt !== "string") {
      return NextResponse.json({ error: "inhalt (base64 PDF) fehlt" }, { status: 400 });
    }

    const kundeIdNum = Number(kundeId);
    const kunde = await prisma.kunde.findUnique({
      where: { id: kundeIdNum },
      select: { id: true, name: true },
    });
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    // Base64 → Buffer
    const pdfBuffer = Buffer.from(inhalt, "base64");
    const unterordner = TYP_ORDNER[typ];

    const datei = await uploadPdfToKundeOrdner(
      kundeIdNum,
      kunde.name,
      unterordner,
      dateiName,
      pdfBuffer
    );

    return NextResponse.json({
      success: true,
      driveFileId: datei.id,
      driveLink: datei.webViewLink ?? `https://drive.google.com/file/d/${datei.id}/view`,
    });
  } catch (err) {
    console.error("[drive/dokumente POST]", err);
    const msg = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/drive/dokumente?kundeId=X
 * Gibt Anzahl und Links der Unterordner (Rechnungen, Lieferscheine, Angebote) zurück.
 */
export async function GET(req: NextRequest) {
  try {
    const konfiguriert = await isDriveKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json(
        { error: "Google Drive nicht konfiguriert", nichtKonfiguriert: true },
        { status: 503 }
      );
    }

    const { searchParams } = new URL(req.url);
    const kundeIdStr = searchParams.get("kundeId");
    if (!kundeIdStr) {
      return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });
    }
    const kundeId = parseInt(kundeIdStr, 10);
    if (isNaN(kundeId)) {
      return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    }

    const kunde = await prisma.kunde.findUnique({
      where: { id: kundeId },
      select: { id: true, name: true },
    });
    if (!kunde) {
      return NextResponse.json({ error: "Kunde nicht gefunden" }, { status: 404 });
    }

    const { listeDateienInUnterordner } = await import("@/lib/googleDrive");

    const [rechnungen, lieferscheine, angebote] = await Promise.all([
      listeDateienInUnterordner(kundeId, kunde.name, "Rechnungen"),
      listeDateienInUnterordner(kundeId, kunde.name, "Lieferscheine"),
      listeDateienInUnterordner(kundeId, kunde.name, "Angebote"),
    ]);

    return NextResponse.json({
      rechnungen: {
        anzahl: rechnungen.dateien.length,
        folderId: rechnungen.folderId,
        driveLink: rechnungen.folderId
          ? `https://drive.google.com/drive/folders/${rechnungen.folderId}`
          : null,
      },
      lieferscheine: {
        anzahl: lieferscheine.dateien.length,
        folderId: lieferscheine.folderId,
        driveLink: lieferscheine.folderId
          ? `https://drive.google.com/drive/folders/${lieferscheine.folderId}`
          : null,
      },
      angebote: {
        anzahl: angebote.dateien.length,
        folderId: angebote.folderId,
        driveLink: angebote.folderId
          ? `https://drive.google.com/drive/folders/${angebote.folderId}`
          : null,
      },
    });
  } catch (err) {
    console.error("[drive/dokumente GET]", err);
    const msg = err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
