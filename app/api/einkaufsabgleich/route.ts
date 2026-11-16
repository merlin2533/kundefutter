import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";

export const dynamic = "force-dynamic";

// Nur Vorbestellungen, die noch echten, unabgewickelten Kundenbedarf darstellen — analog
// GET /api/einkaufszettel (UMGEWANDELT/STORNIERT tragen keinen offenen Bedarf mehr).
const VORBESTELLUNG_OFFEN_STATUS = ["OFFEN", "BESTAETIGT"];
// Nur noch laufende Lieferantenbestellungen zählen als "schon bestellt" — eine bereits
// ABGESCHLOSSENE (komplett abgewickelte) Bestellung fällt bewusst aus dieser Ansicht heraus,
// genau wie eine STORNIERTE.
const BESTELLUNG_AKTIV_STATUS = ["OFFEN", "BESTAETIGT", "TEILGELIEFERT"];

interface VorbestellungZeile {
  vorbestellungId: number;
  nummer: string;
  kunde: { id: number; name: string; firma: string | null } | null;
  menge: number;
  einheit: string;
  status: string;
}

interface BestellungZeile {
  bestellungId: number;
  nummer: string;
  lieferantId: number;
  lieferantName: string;
  menge: number;
  mengeGeliefert: number;
  einheit: string;
  status: string;
}

interface ArtikelZeile {
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  vorbestelltMenge: number;
  bestelltMenge: number;
  vorbestellungen: VorbestellungZeile[];
  bestellungen: BestellungZeile[];
}

// GET /api/einkaufsabgleich
// Stellt je Artikel die noch offene Kunden-Vorbestellmenge (Frühbezug) der Menge gegenüber,
// die für diesen Artikel bereits bei Lieferanten bestellt wurde (laufende Bestellung,
// siehe BESTELLUNG_AKTIV_STATUS) — die Brücke, die der bestehende Einkaufszettel bewusst NICHT
// schlägt: dessen "bestellt"-Markierung ist nur ein manuelles EinkaufStatus-Häkchen ("schon
// besorgt"), ohne Bezug zu einer tatsächlich ausgelösten Bestellung.
export async function GET() {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "fruehbezug");
  if (denyModul) return denyModul;

  try {
    const [vorbestellungen, bestellungen] = await Promise.all([
      prisma.vorbestellung.findMany({
        where: { status: { in: VORBESTELLUNG_OFFEN_STATUS } },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
        take: 5000,
      }),
      prisma.bestellung.findMany({
        where: { status: { in: BESTELLUNG_AKTIV_STATUS } },
        include: {
          lieferant: { select: { id: true, name: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
        take: 5000,
      }),
    ]);

    const zeilenMap = new Map<number, ArtikelZeile>();
    function zeileFuer(artikel: { id: number; name: string; artikelnummer: string; einheit: string }): ArtikelZeile {
      let z = zeilenMap.get(artikel.id);
      if (!z) {
        z = {
          artikelId: artikel.id,
          artikelName: artikel.name,
          artikelnummer: artikel.artikelnummer,
          einheit: artikel.einheit,
          vorbestelltMenge: 0,
          bestelltMenge: 0,
          vorbestellungen: [],
          bestellungen: [],
        };
        zeilenMap.set(artikel.id, z);
      }
      return z;
    }

    for (const vb of vorbestellungen) {
      for (const p of vb.positionen) {
        const z = zeileFuer(p.artikel);
        z.vorbestelltMenge += p.menge;
        z.vorbestellungen.push({
          vorbestellungId: vb.id,
          nummer: vb.nummer,
          kunde: vb.kunde,
          menge: p.menge,
          einheit: p.einheit,
          status: vb.status,
        });
      }
    }
    for (const be of bestellungen) {
      for (const p of be.positionen) {
        const z = zeileFuer(p.artikel);
        z.bestelltMenge += p.menge;
        z.bestellungen.push({
          bestellungId: be.id,
          nummer: be.nummer,
          lieferantId: be.lieferantId,
          lieferantName: be.lieferant.name,
          menge: p.menge,
          mengeGeliefert: p.mengeGeliefert,
          einheit: p.einheit,
          status: be.status,
        });
      }
    }

    const ergebnis = Array.from(zeilenMap.values())
      .map((z) => ({ ...z, restMenge: z.vorbestelltMenge - z.bestelltMenge }))
      .sort((a, b) => a.artikelName.localeCompare(b.artikelName, "de"));

    return NextResponse.json(ergebnis);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
