import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const vonStr = searchParams.get("von");
  const bisStr = searchParams.get("bis");

  try {
    const today = new Date();
    const von = vonStr ? new Date(vonStr) : new Date(today.getFullYear(), today.getMonth(), 1);
    von.setHours(0, 0, 0, 0);
    const bis = bisStr ? new Date(bisStr) : today;
    bis.setHours(23, 59, 59, 999);

    // Load invoiced deliveries in range
    const lieferungen = await prisma.lieferung.findMany({
      where: {
        status: "geliefert",
        rechnungNr: { not: null },
        rechnungDatum: { gte: von, lte: bis },
      },
      select: {
        positionen: {
          select: { menge: true, verkaufspreis: true, rabattProzent: true, artikel: { select: { mwstSatz: true } } },
        },
      },
    });

    // Load Sammelrechnungen in range
    const sammelrechnungen = await prisma.sammelrechnung.findMany({
      where: {
        rechnungNr: { not: null },
        rechnungDatum: { gte: von, lte: bis },
      },
      select: {
        lieferungen: {
          select: {
            positionen: {
              select: { menge: true, verkaufspreis: true, rabattProzent: true, artikel: { select: { mwstSatz: true } } },
            },
          },
        },
      },
    });

    // Load Gutschriften in range (as revenue reduction)
    const gutschriften = await prisma.gutschrift.findMany({
      where: {
        status: { not: "STORNIERT" },
        datum: { gte: von, lte: bis },
      },
      select: {
        positionen: {
          select: { menge: true, preis: true, artikel: { select: { mwstSatz: true } } },
        },
      },
    });

    // Load Ausgaben in range for Vorsteuer
    const ausgaben = await prisma.ausgabe.findMany({
      where: { datum: { gte: von, lte: bis } },
      select: { betragNetto: true, mwstSatz: true },
    });

    // Aggregate revenue by MwSt rate
    let netto19 = 0;
    let netto7 = 0;
    let nettoFrei = 0;

    function addRevenue(positionen: { menge: number; verkaufspreis: number; rabattProzent?: number | null; artikel: { mwstSatz: number } }[]) {
      for (const pos of positionen) {
        const rabatt = pos.rabattProzent ?? 0;
        const lineNetto = pos.menge * pos.verkaufspreis * (1 - rabatt / 100);
        const satz = pos.artikel.mwstSatz ?? 19;
        if (satz === 19) netto19 += lineNetto;
        else if (satz === 7) netto7 += lineNetto;
        else nettoFrei += lineNetto;
      }
    }

    for (const lief of lieferungen) {
      addRevenue(lief.positionen);
    }
    for (const sr of sammelrechnungen) {
      for (const lief of sr.lieferungen) {
        addRevenue(lief.positionen);
      }
    }

    // Deduct gutschriften from revenue
    for (const gs of gutschriften) {
      for (const pos of gs.positionen) {
        const lineNetto = pos.menge * pos.preis;
        const satz = pos.artikel?.mwstSatz ?? 19;
        if (satz === 19) netto19 -= lineNetto;
        else if (satz === 7) netto7 -= lineNetto;
        else nettoFrei -= lineNetto;
      }
    }

    // Round revenue figures
    netto19 = Math.round(netto19 * 100) / 100;
    netto7 = Math.round(netto7 * 100) / 100;
    nettoFrei = Math.round(nettoFrei * 100) / 100;

    const steuer19 = Math.round(netto19 * 0.19 * 100) / 100;
    const steuer7 = Math.round(netto7 * 0.07 * 100) / 100;

    // Vorsteuer aus Ausgaben
    let vorsteuer19 = 0;
    let vorsteuer7 = 0;
    for (const ausg of ausgaben) {
      const vorsteuer = ausg.betragNetto * (ausg.mwstSatz / 100);
      if (ausg.mwstSatz === 19) vorsteuer19 += vorsteuer;
      else if (ausg.mwstSatz === 7) vorsteuer7 += vorsteuer;
    }
    vorsteuer19 = Math.round(vorsteuer19 * 100) / 100;
    vorsteuer7 = Math.round(vorsteuer7 * 100) / 100;
    const vorsteuerGesamt = Math.round((vorsteuer19 + vorsteuer7) * 100) / 100;

    const steuerGesamt = Math.round((steuer19 + steuer7) * 100) / 100;
    const zahllast = Math.round((steuerGesamt - vorsteuerGesamt) * 100) / 100;

    return NextResponse.json({
      zeitraum: {
        von: von.toISOString().slice(0, 10),
        bis: bis.toISOString().slice(0, 10),
      },
      einnahmen: {
        steuerpflichtig19: netto19,
        steuer19,
        steuerpflichtig7: netto7,
        steuer7,
        steuerfrei: nettoFrei,
      },
      vorsteuer: {
        satz19: vorsteuer19,
        satz7: vorsteuer7,
      },
      zahllast,
      kennzahlen: {
        KZ81: netto19,
        KZ86: netto7,
        KZ66: steuer19,
        KZ97: steuer7,
        KZ66_gesamt: steuerGesamt,
        KZ26_vorsteuer: vorsteuerGesamt,
        KZ83_zahllast: zahllast,
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
