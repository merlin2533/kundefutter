import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKontoauszug } from "@/lib/bankimport";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const zugeordnet = searchParams.get("zugeordnet");
  const kontoBezeichnung = searchParams.get("kontoBezeichnung");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500);

  const where: Record<string, unknown> = {};

  if (von || bis) {
    where.buchungsdatum = {
      ...(von ? { gte: new Date(von) } : {}),
      ...(bis ? { lte: new Date(new Date(bis).setHours(23, 59, 59, 999)) } : {}),
    };
  }

  if (zugeordnet === "true") where.zugeordnet = true;
  else if (zugeordnet === "false") where.zugeordnet = false;

  if (kontoBezeichnung) where.kontoBezeichnung = kontoBezeichnung;

  try {
    const [umsaetze, gesamt, offen] = await Promise.all([
      prisma.kontoumsatz.findMany({
        where,
        orderBy: { buchungsdatum: "desc" },
        take: limit,
      }),
      prisma.kontoumsatz.count({ where }),
      prisma.kontoumsatz.count({ where: { ...where, zugeordnet: false } }),
    ]);

    return NextResponse.json({ umsaetze, gesamt, offen });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const datei = formData.get("datei") as File | null;
    const kontoBezeichnung = (formData.get("kontoBezeichnung") as string | null) || null;

    if (!datei) {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }

    const buffer = await datei.arrayBuffer();
    // Try UTF-8 first, fall back to latin1
    let csvText: string;
    try {
      csvText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch {
      csvText = new TextDecoder("latin1").decode(buffer);
    }

    const buchungen = parseKontoauszug(csvText, datei.name);
    if (buchungen.length === 0) {
      return NextResponse.json({ error: "Keine Buchungen erkannt" }, { status: 422 });
    }

    let importiert = 0;
    let duplikate = 0;

    for (const b of buchungen) {
      // Duplikat-Check: gleicher buchungsdatum + betrag + verwendungszweck (ersten 50 Zeichen)
      const vzKurz = b.verwendungszweck.slice(0, 50);
      const existing = await prisma.kontoumsatz.findFirst({
        where: {
          buchungsdatum: b.buchungsdatum,
          betrag: b.betrag,
          verwendungszweck: { startsWith: vzKurz },
        },
        select: { id: true },
      });

      if (existing) {
        duplikate++;
        continue;
      }

      await prisma.kontoumsatz.create({
        data: {
          buchungsdatum: b.buchungsdatum,
          wertstellung: b.wertstellung ?? null,
          betrag: b.betrag,
          waehrung: b.waehrung || "EUR",
          verwendungszweck: b.verwendungszweck,
          gegenkonto: b.gegenkonto ?? null,
          gegenkontoName: b.gegenkontoName ?? null,
          saldo: b.saldo ?? null,
          kontoBezeichnung: kontoBezeichnung,
          importDatei: datei.name,
        },
      });
      importiert++;
    }

    return NextResponse.json({ importiert, duplikate });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Importfehler" }, { status: 500 });
  }
}
