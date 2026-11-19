import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";

export const dynamic = "force-dynamic";

// Kundenbedarf zählt aus denselben drei Quellen wie der Einkaufszettel (GET /api/einkaufszettel,
// Ansicht "Alle"): offene Vorbestellungen, geplante Lieferungen (als normaler Auftrag erfasster,
// noch nicht ausgelieferter Bedarf) und angenommene Angebote. Dieser Abgleich deckte zunächst NUR
// Vorbestellungen ab — ein Kunde meldete daraufhin, dass als gewöhnlicher Auftrag (Lieferung
// status "geplant") erfasster Bedarf fälschlich nicht gegen die Lieferantenbestellung gerechnet
// wurde, weil die meisten Aufträge in der Praxis so erfasst werden, nicht als Vorbestellung.
const VORBESTELLUNG_OFFEN_STATUS = ["OFFEN", "BESTAETIGT"];
const ANGEBOT_ANGENOMMEN_STATUS = "ANGENOMMEN";
// Nur noch laufende Lieferantenbestellungen zählen als "schon bestellt" — eine bereits
// ABGESCHLOSSENE (komplett abgewickelte) Bestellung fällt bewusst aus dieser Ansicht heraus,
// genau wie eine STORNIERTE.
const BESTELLUNG_AKTIV_STATUS = ["OFFEN", "BESTAETIGT", "TEILGELIEFERT"];

interface KundenPosition {
  quelle: "vorbestellung" | "lieferung" | "angebot";
  belegId: number;
  belegNummer: string;
  belegTyp: string;
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
  kundenbedarfMenge: number;
  bestelltMenge: number;
  kundenPositionen: KundenPosition[];
  bestellungen: BestellungZeile[];
}

// GET /api/einkaufsabgleich
// Stellt je Artikel den gesamten offenen Kundenbedarf (Vorbestellung + Auftrag + Angebot, siehe
// oben) der Menge gegenüber, die für diesen Artikel bereits bei Lieferanten bestellt wurde
// (laufende Bestellung, siehe BESTELLUNG_AKTIV_STATUS) — die Brücke, die der bestehende
// Einkaufszettel bewusst NICHT schlägt: dessen "bestellt"-Markierung ist nur ein manuelles
// EinkaufStatus-Häkchen ("schon besorgt"), ohne Bezug zu einer tatsächlich ausgelösten Bestellung.
export async function GET() {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "fruehbezug");
  if (denyModul) return denyModul;

  try {
    const [vorbestellungen, lieferungen, angebote, bestellungen] = await Promise.all([
      prisma.vorbestellung.findMany({
        where: { status: { in: VORBESTELLUNG_OFFEN_STATUS } },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
        take: 5000,
      }),
      prisma.lieferung.findMany({
        where: { status: "geplant" },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: { include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } } },
        },
        take: 5000,
      }),
      prisma.angebot.findMany({
        where: { status: ANGEBOT_ANGENOMMEN_STATUS },
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
          kundenbedarfMenge: 0,
          bestelltMenge: 0,
          kundenPositionen: [],
          bestellungen: [],
        };
        zeilenMap.set(artikel.id, z);
      }
      return z;
    }

    for (const vb of vorbestellungen) {
      for (const p of vb.positionen) {
        const z = zeileFuer(p.artikel);
        z.kundenbedarfMenge += p.menge;
        z.kundenPositionen.push({
          quelle: "vorbestellung",
          belegId: vb.id,
          belegNummer: vb.nummer,
          belegTyp: "Vorbestellung",
          kunde: vb.kunde,
          menge: p.menge,
          einheit: p.einheit,
          status: vb.status,
        });
      }
    }
    for (const lf of lieferungen) {
      for (const p of lf.positionen) {
        const z = zeileFuer(p.artikel);
        z.kundenbedarfMenge += p.menge;
        z.kundenPositionen.push({
          quelle: "lieferung",
          belegId: lf.id,
          belegNummer: lf.lieferscheinNr ?? String(lf.id),
          belegTyp: "Auftrag",
          kunde: lf.kunde,
          menge: p.menge,
          einheit: p.artikel.einheit ?? "kg",
          status: lf.status,
        });
      }
    }
    for (const an of angebote) {
      for (const p of an.positionen) {
        const z = zeileFuer(p.artikel);
        z.kundenbedarfMenge += p.menge;
        z.kundenPositionen.push({
          quelle: "angebot",
          belegId: an.id,
          belegNummer: an.nummer,
          belegTyp: "Angebot",
          kunde: an.kunde,
          menge: p.menge,
          einheit: p.einheit,
          status: an.status,
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
      .map((z) => ({ ...z, restMenge: z.kundenbedarfMenge - z.bestelltMenge }))
      .sort((a, b) => a.artikelName.localeCompare(b.artikelName, "de"));

    return NextResponse.json(ergebnis);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
