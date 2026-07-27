// Gemeinsame Datenquelle für die "Kategorie-Verlauf je Kunde"-Ansicht (JSON-API +
// Excel-/PDF-Export) — an einer Stelle, damit alle drei Routen exakt dieselben gefilterten
// Daten liefern.

import { prisma } from "@/lib/prisma";

const MAX_JAHRE_SPANNE = 10;

export interface KategorieVerlaufEintrag {
  jahr: number;
  artikelId: number;
  artikelName: string;
  unterkategorie: string | null;
  menge: number;
  einheit: string | null;
}

export interface KategorieVerlaufKunde {
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  eintraege: KategorieVerlaufEintrag[];
}

export interface KategorieVerlaufParams {
  kategorie?: string | null;
  unterkategorie?: string | null;
  jahrVon?: number | null;
  jahrBis?: number | null;
  kundeSuche?: string | null;
}

export interface KategorieVerlaufResult {
  kunden: KategorieVerlaufKunde[];
  jahre: number[];
  kategorie: string;
  unterkategorie: string;
}

export async function ladeKategorieVerlauf(params: KategorieVerlaufParams): Promise<KategorieVerlaufResult> {
  const kategorie = params.kategorie && params.kategorie.trim() ? params.kategorie : "alle";
  const unterkategorie = params.unterkategorie && params.unterkategorie.trim() ? params.unterkategorie : "alle";

  const now = new Date();
  const jahrBis = params.jahrBis && !isNaN(params.jahrBis) ? params.jahrBis : now.getFullYear();
  let jahrVon = params.jahrVon && !isNaN(params.jahrVon) ? params.jahrVon : jahrBis - 2;
  if (jahrVon > jahrBis) jahrVon = jahrBis;
  if (jahrBis - jahrVon > MAX_JAHRE_SPANNE) jahrVon = jahrBis - MAX_JAHRE_SPANNE;

  const vonDate = new Date(Date.UTC(jahrVon, 0, 1));
  const bisDateExklusiv = new Date(Date.UTC(jahrBis + 1, 0, 1));

  const positionen = await prisma.lieferposition.findMany({
    where: {
      artikel: {
        ...(kategorie !== "alle" ? { kategorie } : {}),
        ...(unterkategorie !== "alle" ? { unterkategorie } : {}),
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
    { kundeId: number; kundeName: string; kundeOrt: string | null; eintraege: Map<string, KategorieVerlaufEintrag> }
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

  const suche = params.kundeSuche?.trim().toLowerCase() ?? "";

  const kunden = Array.from(kundenMap.values())
    .filter((kg) => !suche || kg.kundeName.toLowerCase().includes(suche) || (kg.kundeOrt ?? "").toLowerCase().includes(suche))
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

  return { kunden, jahre, kategorie, unterkategorie };
}
