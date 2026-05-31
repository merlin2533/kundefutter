import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { generateZugferdXmlSimple } from "@/lib/zugferd-xml";
import { ladeFirmaDaten } from "@/lib/firma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  try {
    const rechnung = await prisma.eingangsRechnung.findUnique({
      where: { id: Number(id) },
      include: {
        lieferant: { select: { name: true, strasse: true, plz: true, ort: true } },
      },
    });

    if (!rechnung) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    const firma = await ladeFirmaDaten();

    const xml = generateZugferdXmlSimple({
      rechnungNr: rechnung.nummer,
      datum: new Date(rechnung.datum),
      faelligAm: rechnung.faelligAm ? new Date(rechnung.faelligAm) : undefined,
      seller: {
        name: rechnung.lieferant?.name ?? "Unbekannter Lieferant",
        strasse: rechnung.lieferant?.strasse ?? undefined,
        plz: rechnung.lieferant?.plz ?? undefined,
        ort: rechnung.lieferant?.ort ?? undefined,
      },
      buyer: {
        name: firma.name ?? "Eigene Firma",
        strasse: firma.strasse || undefined,
        ort: firma.plzOrt || undefined,
        ustIdNr: firma.ustIdNr || undefined,
        steuernummer: firma.steuernummer || undefined,
      },
      betragNetto: rechnung.betrag,
      mwstSatz: rechnung.mwst,
    });

    const filename = `eingangsrechnung-${rechnung.nummer.replace(/[^a-zA-Z0-9-]/g, "_")}-zugferd.xml`;

    return new NextResponse(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "ZUGFeRD-Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
