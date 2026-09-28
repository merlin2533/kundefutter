import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { berechneEierMhd } from "@/lib/eier-mhd";
export const dynamic = "force-dynamic";

// GET /api/artikel/[id]/chargen
// Liefert alle bekannten Chargennummern für diesen Artikel — sowohl aus Wareneingängen als
// auch (Eierhandel) aus EierSortierungPosition (die eigene Erzeugung/Sortierung klassifizierter
// Chargen, ohne dass dafür ein Wareneingang existiert). Ohne die zweite Quelle erschien jede
// Ei-Sortierungs-Charge im Lieferungs-Formular (ChargeInput) fälschlich als "⚠ Neue Charge
// (kein Wareneingang)" mit einem Link, der einen zweiten, doppelten Wareneingang angelegt
// hätte. Wird im Lieferungs-Formular als Dropdown (datalist) angeboten.
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const artikelId = parseInt(id, 10);
  if (isNaN(artikelId)) {
    return NextResponse.json({ error: "Ungültige Artikel-ID" }, { status: 400 });
  }

  try {
    const [weRows, esRows] = await Promise.all([
      prisma.wareineingangPosition.findMany({
        where: { artikelId, chargeNr: { not: null } },
        select: {
          chargeNr: true,
          menge: true,
          mhd: true,
          wareneingang: { select: { datum: true, lieferant: { select: { name: true } } } },
        },
        take: 2000,
        orderBy: { id: "desc" },
      }),
      prisma.eierSortierungPosition.findMany({
        where: { artikelId, chargeNr: { not: null } },
        select: {
          chargeNr: true,
          menge: true,
          legedatum: true,
          erzeugercode: true,
          gueteklasse: true,
          gewichtsklasse: true,
          sortierung: { select: { datum: true } },
        },
        take: 2000,
        orderBy: { id: "desc" },
      }),
    ]);

    const map = new Map<
      string,
      {
        chargeNr: string;
        quelle: "wareneingang" | "eiersortierung";
        datum: Date;
        anzahlBuchungen: number;
        summeMenge: number;
        mhd: Date | null;
        lieferant: string | null;
        legedatum: Date | null;
        erzeugercode: string | null;
        gueteklasse: string | null;
        gewichtsklasse: string | null;
      }
    >();

    for (const r of weRows) {
      if (!r.chargeNr) continue;
      const datum = r.wareneingang.datum;
      const lieferantName = r.wareneingang.lieferant?.name ?? null;
      const existing = map.get(r.chargeNr);
      if (existing) {
        existing.anzahlBuchungen += 1;
        existing.summeMenge += r.menge;
        if (datum > existing.datum) {
          existing.datum = datum;
          existing.lieferant = lieferantName;
          existing.mhd = r.mhd;
        }
      } else {
        map.set(r.chargeNr, {
          chargeNr: r.chargeNr,
          quelle: "wareneingang",
          datum,
          anzahlBuchungen: 1,
          summeMenge: r.menge,
          mhd: r.mhd,
          lieferant: lieferantName,
          legedatum: null,
          erzeugercode: null,
          gueteklasse: null,
          gewichtsklasse: null,
        });
      }
    }

    // Eine Charge kann in der Praxis nur aus GENAU einer der beiden Quellen stammen (extern
    // zugekauft vs. selbst sortiert) — ein Zusammentreffen derselben chargeNr in beiden Maps
    // wäre ein Datenfehler; im unwahrscheinlichen Fall gewinnt hier bewusst die zweite Quelle
    // (EierSortierung), da deren Legedatum/Erzeugercode für die Vorbefüllung wichtiger sind.
    for (const r of esRows) {
      if (!r.chargeNr) continue;
      const datum = r.sortierung.datum;
      const existing = map.get(r.chargeNr);
      if (existing) {
        existing.quelle = "eiersortierung";
        existing.anzahlBuchungen += 1;
        existing.summeMenge += r.menge;
        existing.legedatum = r.legedatum;
        existing.erzeugercode = r.erzeugercode;
        existing.gueteklasse = r.gueteklasse;
        existing.gewichtsklasse = r.gewichtsklasse;
        if (r.legedatum) existing.mhd = berechneEierMhd(r.legedatum);
        if (datum > existing.datum) existing.datum = datum;
      } else {
        map.set(r.chargeNr, {
          chargeNr: r.chargeNr,
          quelle: "eiersortierung",
          datum,
          anzahlBuchungen: 1,
          summeMenge: r.menge,
          mhd: r.legedatum ? berechneEierMhd(r.legedatum) : null,
          lieferant: null,
          legedatum: r.legedatum,
          erzeugercode: r.erzeugercode,
          gueteklasse: r.gueteklasse,
          gewichtsklasse: r.gewichtsklasse,
        });
      }
    }

    const chargen = Array.from(map.values()).sort((a, b) => b.datum.getTime() - a.datum.getTime());

    return NextResponse.json({ chargen });
  } catch (e) {
    Sentry.captureException(e);
    const isDev = process.env.NODE_ENV === "development";
    console.error("Artikel-Chargen GET error:", e);
    const msg = isDev && e instanceof Error ? e.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
