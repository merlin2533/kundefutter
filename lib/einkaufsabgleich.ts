import { prisma } from "@/lib/prisma";

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
// Reine Dienstleistungen (Beratung) werden nie bei einem Vorlieferanten "bestellt" — ein Kunde
// bemängelte, dass sie trotzdem mit vollem Kundenbedarf und dauerhaft "Offen" in der Liste
// auftauchten, obwohl dafür nie eine Lieferantenbestellung entstehen wird. Komplett aus der
// Aggregation ausgeschlossen statt nur ausgeblendet, damit sie auch nicht in "X Artikel mit
// offenem Rest" mitzählen.
const AUSGESCHLOSSENE_KATEGORIEN = ["Beratung"];

export interface KundenPosition {
  quelle: "vorbestellung" | "lieferung" | "angebot";
  belegId: number;
  belegNummer: string;
  belegTyp: string;
  kunde: { id: number; name: string; firma: string | null } | null;
  menge: number;
  einheit: string;
  status: string;
}

export interface BestellungZeile {
  bestellungId: number;
  nummer: string;
  lieferantId: number;
  lieferantName: string;
  menge: number;
  mengeGeliefert: number;
  einheit: string;
  status: string;
}

export interface ArtikelZeile {
  artikelId: number;
  artikelName: string;
  artikelnummer: string;
  einheit: string;
  // Gruppierungs-Label für Filter/Sortierung: Unterkategorie, wenn gesetzt (z.B. "Mais" bei
  // Saatgut), sonst die Kategorie selbst (z.B. "Analysen" für Dienstleistungen ohne
  // Unterkategorie) — genau die Ebene, die ein Nutzer mit "Artikelgruppe" meint.
  gruppe: string;
  kundenbedarfMenge: number;
  bestelltMenge: number;
  restMenge: number;
  kundenPositionen: KundenPosition[];
  bestellungen: BestellungZeile[];
}

function kategorieAnzeige(kategorie: string): string {
  return kategorie === "Duenger" ? "Dünger" : kategorie;
}

function gruppeFuer(artikel: { kategorie: string; unterkategorie: string | null }): string {
  const uk = artikel.unterkategorie?.trim();
  return uk ? uk : kategorieAnzeige(artikel.kategorie);
}

function istAusgeschlossen(artikel: { kategorie: string }): boolean {
  return AUSGESCHLOSSENE_KATEGORIEN.includes(artikel.kategorie);
}

// Stellt je Artikel den gesamten offenen Kundenbedarf (Vorbestellung + Auftrag + Angebot, siehe
// oben) der Menge gegenüber, die für diesen Artikel bereits bei Lieferanten bestellt wurde
// (laufende Bestellung, siehe BESTELLUNG_AKTIV_STATUS) — die Brücke, die der bestehende
// Einkaufszettel bewusst NICHT schlägt: dessen "bestellt"-Markierung ist nur ein manuelles
// EinkaufStatus-Häkchen ("schon besorgt"), ohne Bezug zu einer tatsächlich ausgelösten Bestellung.
// Einzige Quelle der Wahrheit für Bildschirm (GET /api/einkaufsabgleich) UND Excel-Export
// (GET /api/einkaufsabgleich/export) — beide dürfen nie auseinanderlaufen.
export async function ladeEinkaufsabgleich(): Promise<ArtikelZeile[]> {
  const [vorbestellungen, lieferungen, angebote, bestellungen] = await Promise.all([
    prisma.vorbestellung.findMany({
      where: { status: { in: VORBESTELLUNG_OFFEN_STATUS } },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: {
          include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, kategorie: true, unterkategorie: true } } },
        },
      },
      take: 5000,
    }),
    prisma.lieferung.findMany({
      where: { status: "geplant" },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: {
          include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, kategorie: true, unterkategorie: true } } },
        },
      },
      take: 5000,
    }),
    prisma.angebot.findMany({
      where: { status: ANGEBOT_ANGENOMMEN_STATUS },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: {
          include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, kategorie: true, unterkategorie: true } } },
        },
      },
      take: 5000,
    }),
    prisma.bestellung.findMany({
      where: { status: { in: BESTELLUNG_AKTIV_STATUS } },
      include: {
        lieferant: { select: { id: true, name: true } },
        positionen: {
          include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, kategorie: true, unterkategorie: true } } },
        },
      },
      take: 5000,
    }),
  ]);

  const zeilenMap = new Map<number, Omit<ArtikelZeile, "restMenge">>();
  function zeileFuer(artikel: {
    id: number;
    name: string;
    artikelnummer: string;
    einheit: string;
    kategorie: string;
    unterkategorie: string | null;
  }) {
    let z = zeilenMap.get(artikel.id);
    if (!z) {
      z = {
        artikelId: artikel.id,
        artikelName: artikel.name,
        artikelnummer: artikel.artikelnummer,
        einheit: artikel.einheit,
        gruppe: gruppeFuer(artikel),
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
      if (istAusgeschlossen(p.artikel)) continue;
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
      if (istAusgeschlossen(p.artikel)) continue;
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
      if (istAusgeschlossen(p.artikel)) continue;
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
      if (istAusgeschlossen(p.artikel)) continue;
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

  return Array.from(zeilenMap.values())
    .map((z) => ({ ...z, restMenge: z.kundenbedarfMenge - z.bestelltMenge }))
    .sort((a, b) => a.gruppe.localeCompare(b.gruppe, "de") || a.artikelName.localeCompare(b.artikelName, "de"));
}
