import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { formatDatum } from "@/lib/utils";
import { generiereRechnungPdfMitZugferd, generiereLieferscheinPdf } from "@/lib/pdfGenerator";
import { getCurrentUser } from "@/lib/auth";
import { requirePermission, P } from "@/lib/permissions";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const JSZip = require("jszip");

// ── Route handler ─────────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  const deny = requirePermission(me, P.EXPORT_BULK);
  if (deny) return deny;

  const { searchParams } = new URL(req.url);
  const typ = searchParams.get("typ"); // "rechnung" | "lieferschein"
  const kundeId = searchParams.get("kundeId");
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const rnrVon = searchParams.get("rnrVon"); // Rechnungsnummer von (string prefix)
  const rnrBis = searchParams.get("rnrBis"); // Rechnungsnummer bis (string prefix)

  if (typ !== "rechnung" && typ !== "lieferschein") {
    return NextResponse.json({ error: "typ muss 'rechnung' oder 'lieferschein' sein" }, { status: 400 });
  }

  const where: Record<string, unknown> = { status: "geliefert" };
  if (kundeId) where.kundeId = Number(kundeId);
  if (von || bis) {
    where.datum = {};
    if (von) (where.datum as Record<string, unknown>).gte = new Date(von);
    if (bis) {
      const bisDate = new Date(bis);
      bisDate.setHours(23, 59, 59, 999);
      (where.datum as Record<string, unknown>).lte = bisDate;
    }
  }
  if (typ === "rechnung") {
    where.rechnungNr = { not: null };
  }

  try {
  const lieferungen = await prisma.lieferung.findMany({
    where,
    select: { id: true, rechnungNr: true, datum: true },
    orderBy: typ === "rechnung" ? { rechnungNr: "asc" } : { datum: "asc" },
  });

  // Apply rechnungNr filter client-side (string comparison)
  const filtered = typ === "rechnung" && (rnrVon || rnrBis)
    ? lieferungen.filter((l) => {
        const nr = l.rechnungNr ?? "";
        if (rnrVon && nr < rnrVon) return false;
        if (rnrBis && nr > rnrBis) return false;
        return true;
      })
    : lieferungen;

  if (filtered.length === 0) {
    return NextResponse.json({ error: "Keine Lieferungen für diese Filter gefunden" }, { status: 404 });
  }

  const zip = new JSZip();
  const folder = zip.folder(typ === "rechnung" ? "rechnungen" : "lieferscheine");

  // Dieselben Generatoren wie beim Einzel-Download (generiereRechnungPdfMitZugferd /
  // generiereLieferscheinPdf, lib/pdfGenerator.ts) — sonst weichen archivierte
  // Massenexport-PDFs von den echten Rechnungen/Lieferscheinen ab (falscher MwSt-Satz,
  // ignorierter Rabatt, fehlendes ZUGFeRD-Embedding).
  for (const lieferung of filtered) {
    let pdfBuf: Buffer;
    let filename: string;
    if (typ === "rechnung") {
      pdfBuf = await generiereRechnungPdfMitZugferd(lieferung.id);
      filename = `rechnung-${lieferung.rechnungNr?.replace(/\//g, "-") ?? lieferung.id}-${formatDatum(lieferung.datum).replace(/\./g, "-")}.pdf`;
    } else {
      pdfBuf = await generiereLieferscheinPdf(lieferung.id);
      filename = `lieferschein-LS-${lieferung.id}-${formatDatum(lieferung.datum).replace(/\./g, "-")}.pdf`;
    }
    folder!.file(filename, pdfBuf);
  }

  const zipBuffer = await zip.generateAsync({ type: "nodebuffer" }) as Buffer;
  const date = new Date().toISOString().slice(0, 10);
  const zipFilename = `${typ === "rechnung" ? "rechnungen" : "lieferscheine"}-massenexport-${date}.zip`;

  return new NextResponse(zipBuffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${zipFilename}"`,
      "X-Export-Count": String(filtered.length),
    },
  });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Massenexport fehlgeschlagen" }, { status: 500 });
  }
}
