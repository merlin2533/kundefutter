import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { uploadPdfToKundeOrdner, isNextcloudKonfiguriert, listeDateienImKundenUnterordner, KundeDokumentTyp } from "@/lib/nextcloud";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


const TYP_ORDNER: Record<string, KundeDokumentTyp> = {
  rechnung: "Rechnungen",
  lieferschein: "Lieferscheine",
  angebot: "Angebote",
  gutschrift: "Gutschriften",
};

/**
 * POST /api/nextcloud/dokumente
 * Body: { kundeId, typ: "rechnung"|"lieferschein"|"angebot"|"gutschrift", dateiName, inhalt (base64 PDF) }
 * Response: { success: true, nextcloudLink }
 */
export async function POST(req: NextRequest) {
  try {
    const konfiguriert = await isNextcloudKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json(
        { error: "Nextcloud nicht konfiguriert", nichtKonfiguriert: true },
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

    if (!kundeId || isNaN(Number(kundeId))) {
      return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    }
    if (!typ || !TYP_ORDNER[typ]) {
      return NextResponse.json(
        { error: "Ungültiger Typ. Erlaubt: rechnung, lieferschein, angebot, gutschrift" },
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

    const pdfBuffer = Buffer.from(inhalt, "base64");
    const unterordner = TYP_ORDNER[typ];

    const datei = await uploadPdfToKundeOrdner(kundeIdNum, kunde.name, unterordner, dateiName, pdfBuffer);

    return NextResponse.json({
      success: true,
      nextcloudLink: datei.webViewLink,
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[nextcloud/dokumente POST]", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * GET /api/nextcloud/dokumente?kundeId=X
 * Gibt Anzahl und Links der Unterordner (Rechnungen, Lieferscheine, Angebote, Gutschriften) zurück.
 */
export async function GET(req: NextRequest) {
  try {
    const konfiguriert = await isNextcloudKonfiguriert();
    if (!konfiguriert) {
      return NextResponse.json(
        { error: "Nextcloud nicht konfiguriert", nichtKonfiguriert: true },
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

    const [rechnungen, lieferscheine, angebote, gutschriften] = await Promise.all([
      listeDateienImKundenUnterordner(kundeId, kunde.name, "Rechnungen"),
      listeDateienImKundenUnterordner(kundeId, kunde.name, "Lieferscheine"),
      listeDateienImKundenUnterordner(kundeId, kunde.name, "Angebote"),
      listeDateienImKundenUnterordner(kundeId, kunde.name, "Gutschriften"),
    ]);

    const buildEntry = (dateien: Awaited<ReturnType<typeof listeDateienImKundenUnterordner>>) => ({
      anzahl: dateien.length,
      nextcloudLink: dateien[0]?.webViewLink ?? null,
    });

    return NextResponse.json({
      rechnungen: buildEntry(rechnungen),
      lieferscheine: buildEntry(lieferscheine),
      angebote: buildEntry(angebote),
      gutschriften: buildEntry(gutschriften),
    });
  } catch (err) {
    Sentry.captureException(err);
    console.error("[nextcloud/dokumente GET]", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
