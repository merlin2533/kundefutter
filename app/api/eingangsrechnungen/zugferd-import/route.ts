import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { parseZugferdXml, extractXmlFromPdf } from "@/lib/zugferd-parse";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/eingangsrechnungen/zugferd-import
// Akzeptiert: multipart/form-data mit Feld "file" (XML oder PDF)
// Gibt geparste Felder zurück — speichert NICHT selbst
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }

    const buffer = Buffer.from(await (file as File).arrayBuffer());
    const filename = (file as File).name ?? "";
    const mime = (file as File).type ?? "";

    let xml: string | null = null;

    if (
      mime === "text/xml" ||
      mime === "application/xml" ||
      filename.toLowerCase().endsWith(".xml")
    ) {
      xml = buffer.toString("utf-8");
    } else if (
      mime === "application/pdf" ||
      filename.toLowerCase().endsWith(".pdf")
    ) {
      xml = extractXmlFromPdf(buffer);
      if (!xml) {
        return NextResponse.json(
          { error: "Kein ZUGFeRD/Factur-X XML in der PDF-Datei gefunden. Bitte prüfen Sie, ob es sich um eine ZUGFeRD-konforme Rechnung handelt." },
          { status: 422 }
        );
      }
    } else {
      return NextResponse.json(
        { error: "Nur XML- oder PDF-Dateien (ZUGFeRD/Factur-X) werden unterstützt." },
        { status: 415 }
      );
    }

    if (!xml) {
      return NextResponse.json({ error: "XML-Inhalt konnte nicht gelesen werden" }, { status: 422 });
    }
    const xmlContent: string = xml;

    // Basis-Plausibilitätsprüfung
    if (
      !xmlContent.includes("CrossIndustryInvoice") &&
      !xmlContent.includes("CrossIndustryDocument") &&
      !xmlContent.includes("factur-x") &&
      !xmlContent.includes("urn:un:unece:uncefact")
    ) {
      return NextResponse.json(
        { error: "Die Datei enthält kein gültiges ZUGFeRD/Factur-X XML." },
        { status: 422 }
      );
    }

    const parsed = parseZugferdXml(xmlContent);
    return NextResponse.json(parsed);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler beim Parsen der Datei";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
