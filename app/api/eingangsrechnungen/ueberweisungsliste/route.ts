import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// GET /api/eingangsrechnungen/ueberweisungsliste
// Liefert alle OFFEN-Rechnungen mit Lieferant-Bankdaten für die Überweisung
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const nurFaellig = searchParams.get("nurFaellig") === "1";

  try {
    const where: Record<string, unknown> = { status: "OFFEN" };
    if (nurFaellig) {
      where.faelligAm = { lte: new Date() };
    }

    const rechnungen = await prisma.eingangsRechnung.findMany({
      where,
      include: {
        lieferant: {
          select: {
            id: true,
            name: true,
            firma: true,
            iban: true,
            bic: true,
            kontoinhaber: true,
          },
        },
      },
      orderBy: [{ faelligAm: "asc" }, { datum: "asc" }],
      take: 500,
    });

    const result = rechnungen.map((r) => ({
      id: r.id,
      nummer: r.nummer,
      datum: r.datum,
      faelligAm: r.faelligAm,
      betrag: r.betrag,
      mwst: r.mwst,
      brutto: Math.round(r.betrag * (1 + r.mwst / 100) * 100) / 100,
      notiz: r.notiz,
      lieferantId: r.lieferantId,
      lieferantName: r.lieferant?.firma ?? r.lieferant?.name ?? "—",
      iban: r.lieferant?.iban ?? null,
      bic: r.lieferant?.bic ?? null,
      kontoinhaber: r.lieferant?.kontoinhaber ?? r.lieferant?.firma ?? r.lieferant?.name ?? null,
      ibanFehlt: !r.lieferant?.iban,
      ueberfaellig: r.faelligAm ? new Date(r.faelligAm) < new Date() : false,
    }));

    return NextResponse.json(result);
  } catch (err) {
    console.error("Überweisungsliste GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
