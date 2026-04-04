import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

interface Vorschlag {
  typ: "lieferung" | "sammelrechnung";
  id: number;
  rechnungNr: string | null;
  kundeName: string;
  betrag: number;
  konfidenz: "hoch" | "mittel" | "niedrig";
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const umsatzIdStr = searchParams.get("umsatzId");
  const umsatzId = parseInt(umsatzIdStr || "", 10);
  if (isNaN(umsatzId)) {
    return NextResponse.json({ error: "Ungültige umsatzId" }, { status: 400 });
  }

  try {
    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id: umsatzId } });
    if (!umsatz) return NextResponse.json({ error: "Umsatz nicht gefunden" }, { status: 404 });

    const betragAbs = Math.abs(umsatz.betrag);
    const verwendung = umsatz.verwendungszweck || "";
    const gegenName = (umsatz.gegenkontoName || "").toLowerCase();

    const vorschlaege: Vorschlag[] = [];

    // 1. Suche Rechnungsnummer RE-YYYY-NNNN im Verwendungszweck
    const reMatch = verwendung.match(/RE-\d{4}-\d{4}/i);
    if (reMatch) {
      const rechnungNr = reMatch[0].toUpperCase();

      // Suche in Lieferungen
      const lieferungMitRe = await prisma.lieferung.findFirst({
        where: { rechnungNr },
        include: { kunde: { select: { name: true } }, positionen: true },
      });
      if (lieferungMitRe) {
        const brutto = lieferungMitRe.positionen.reduce((sum, p) => {
          // Artikel mwstSatz brauchen wir — nehmen 19% als Schätzung wenn nicht vorhanden
          return sum + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100);
        }, 0);
        vorschlaege.push({
          typ: "lieferung",
          id: lieferungMitRe.id,
          rechnungNr: lieferungMitRe.rechnungNr,
          kundeName: lieferungMitRe.kunde.name,
          betrag: brutto,
          konfidenz: "hoch",
        });
      }

      // Suche in Sammelrechnungen
      const sammelMitRe = await prisma.sammelrechnung.findFirst({
        where: { rechnungNr },
        include: {
          kunde: { select: { name: true } },
          lieferungen: { include: { positionen: true } },
        },
      });
      if (sammelMitRe) {
        const brutto = sammelMitRe.lieferungen.reduce((sumL, l) => {
          return sumL + l.positionen.reduce((sumP, p) => {
            return sumP + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100);
          }, 0);
        }, 0);
        vorschlaege.push({
          typ: "sammelrechnung",
          id: sammelMitRe.id,
          rechnungNr: sammelMitRe.rechnungNr,
          kundeName: sammelMitRe.kunde.name,
          betrag: brutto,
          konfidenz: "hoch",
        });
      }
    }

    // 2. Suche offene Rechnungen mit Bruttobetrag ≈ |betrag| (±0.02€)
    if (vorschlaege.length < 5) {
      // Offene Lieferungen mit Rechnungsnummer
      const offeneLieferungen = await prisma.lieferung.findMany({
        where: {
          bezahltAm: null,
          rechnungNr: { not: null },
        },
        include: {
          kunde: { select: { name: true } },
          positionen: {
            include: {
              artikel: { select: { mwstSatz: true } },
            },
          },
        },
        take: 200,
        orderBy: { rechnungDatum: "desc" },
      });

      for (const lief of offeneLieferungen) {
        if (vorschlaege.length >= 5) break;
        // Bereits als hoch gefunden? Überspringen
        if (vorschlaege.some(v => v.typ === "lieferung" && v.id === lief.id)) continue;

        const brutto = lief.positionen.reduce((sum, p) => {
          const mwst = p.artikel?.mwstSatz ?? 19;
          return sum + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100) * (1 + mwst / 100);
        }, 0);

        if (Math.abs(brutto - betragAbs) <= 0.02) {
          const kundeName = lief.kunde.name.toLowerCase();
          const nameMatch = gegenName && (kundeName.includes(gegenName) || gegenName.includes(kundeName));
          vorschlaege.push({
            typ: "lieferung",
            id: lief.id,
            rechnungNr: lief.rechnungNr,
            kundeName: lief.kunde.name,
            betrag: brutto,
            konfidenz: nameMatch ? "mittel" : "niedrig",
          });
        }
      }
    }

    if (vorschlaege.length < 5) {
      // Offene Sammelrechnungen
      const offeneSammel = await prisma.sammelrechnung.findMany({
        where: {
          bezahltAm: null,
          rechnungNr: { not: null },
        },
        include: {
          kunde: { select: { name: true } },
          lieferungen: {
            include: {
              positionen: {
                include: {
                  artikel: { select: { mwstSatz: true } },
                },
              },
            },
          },
        },
        take: 100,
        orderBy: { rechnungDatum: "desc" },
      });

      for (const sammel of offeneSammel) {
        if (vorschlaege.length >= 5) break;
        if (vorschlaege.some(v => v.typ === "sammelrechnung" && v.id === sammel.id)) continue;

        const brutto = sammel.lieferungen.reduce((sumL, l) => {
          return sumL + l.positionen.reduce((sumP, p) => {
            const mwst = p.artikel?.mwstSatz ?? 19;
            return sumP + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100) * (1 + mwst / 100);
          }, 0);
        }, 0);

        if (Math.abs(brutto - betragAbs) <= 0.02) {
          const kundeName = sammel.kunde.name.toLowerCase();
          const nameMatch = gegenName && (kundeName.includes(gegenName) || gegenName.includes(kundeName));
          vorschlaege.push({
            typ: "sammelrechnung",
            id: sammel.id,
            rechnungNr: sammel.rechnungNr,
            kundeName: sammel.kunde.name,
            betrag: brutto,
            konfidenz: nameMatch ? "mittel" : "niedrig",
          });
        }
      }
    }

    // Sort: hoch first, then mittel, then niedrig
    const konfidenzOrder = { hoch: 0, mittel: 1, niedrig: 2 };
    vorschlaege.sort((a, b) => konfidenzOrder[a.konfidenz] - konfidenzOrder[b.konfidenz]);

    return NextResponse.json(vorschlaege.slice(0, 5));
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
