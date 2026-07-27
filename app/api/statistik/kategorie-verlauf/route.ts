import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

const MAX_JAHRE_SPANNE = 10;

interface Eintrag {
  jahr: number;
  artikelId: number;
  artikelName: string;
  unterkategorie: string | null;
  menge: number;
  einheit: string | null;
}

// GET /api/statistik/kategorie-verlauf?kategorie=Saatgut&unterkategorie=Getreide&jahrVon=2023&jahrBis=2026
// Zeigt je Kunde, welche Artikel einer Kategorie/Unterkategorie in welchem Jahr geliefert wurden
// (Fruchtfolge-Nachvollziehbarkeit: welcher Kunde hatte welche Zwischenfrucht/welches Getreide).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kategorie = searchParams.get("kategorie");
    const unterkategorie = searchParams.get("unterkategorie");

    const now = new Date();
    const jahrBisParam = parseInt(searchParams.get("jahrBis") ?? "", 10);
    const jahrVonParam = parseInt(searchParams.get("jahrVon") ?? "", 10);
    const jahrBis = isNaN(jahrBisParam) ? now.getFullYear() : jahrBisParam;
    let jahrVon = isNaN(jahrVonParam) ? jahrBis - 2 : jahrVonParam;
    if (jahrVon > jahrBis) jahrVon = jahrBis;
    if (jahrBis - jahrVon > MAX_JAHRE_SPANNE) jahrVon = jahrBis - MAX_JAHRE_SPANNE;

    const vonDate = new Date(Date.UTC(jahrVon, 0, 1));
    const bisDateExklusiv = new Date(Date.UTC(jahrBis + 1, 0, 1));

    const positionen = await prisma.lieferposition.findMany({
      where: {
        artikel: {
          ...(kategorie && kategorie !== "alle" ? { kategorie } : {}),
          ...(unterkategorie && unterkategorie !== "alle" ? { unterkategorie } : {}),
        },
        lieferung: {
          status: "geliefert",
          datum: { gte: vonDate, lt: bisDateExklusiv },
        },
      },
      select: {
        menge: true,
        artikel: { select: { id: true, name: true, unterkategorie: true, einheit: true } },
        lieferung: {
          select: {
            datum: true,
            kunde: { select: { id: true, name: true, ort: true } },
          },
        },
      },
      take: 10000,
    });

    const kundenMap = new Map<
      number,
      { kundeId: number; kundeName: string; kundeOrt: string | null; eintraege: Map<string, Eintrag> }
    >();

    for (const p of positionen) {
      const jahr = p.lieferung.datum.getUTCFullYear();
      const k = p.lieferung.kunde;
      let kg = kundenMap.get(k.id);
      if (!kg) {
        kg = { kundeId: k.id, kundeName: k.name, kundeOrt: k.ort, eintraege: new Map() };
        kundenMap.set(k.id, kg);
      }
      const key = `${jahr}-${p.artikel.id}`;
      const bestehend = kg.eintraege.get(key);
      if (bestehend) {
        bestehend.menge += p.menge;
      } else {
        kg.eintraege.set(key, {
          jahr,
          artikelId: p.artikel.id,
          artikelName: p.artikel.name,
          unterkategorie: p.artikel.unterkategorie,
          menge: p.menge,
          einheit: p.artikel.einheit,
        });
      }
    }

    const kunden = Array.from(kundenMap.values())
      .map((kg) => ({
        kundeId: kg.kundeId,
        kundeName: kg.kundeName,
        kundeOrt: kg.kundeOrt,
        eintraege: Array.from(kg.eintraege.values()).sort(
          (a, b) => b.jahr - a.jahr || a.artikelName.localeCompare(b.artikelName, "de")
        ),
      }))
      .sort((a, b) => a.kundeName.localeCompare(b.kundeName, "de"));

    const jahre: number[] = [];
    for (let j = jahrBis; j >= jahrVon; j--) jahre.push(j);

    return NextResponse.json({ kunden, jahre });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Statistik/Kategorie-Verlauf API Fehler:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
