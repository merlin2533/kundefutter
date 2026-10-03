// Gemeinsame Datenquelle für die "Kategorie-Verlauf je Kunde"-Ansicht (JSON-API +
// Excel-/PDF-Export) — an einer Stelle, damit alle drei Routen exakt dieselben gefilterten
// Daten liefern.

import { prisma } from "@/lib/prisma";

const MAX_TAGE_SPANNE = 366 * 10; // ~10 Jahre

const ISO_DATUM = /^\d{4}-\d{2}-\d{2}$/;

export interface KategorieVerlaufEintrag {
  jahr: number;
  artikelId: number;
  artikelName: string;
  unterkategorie: string | null;
  /** Bereits ausgeliefert (Lieferung.status "geliefert"). */
  mengeGeliefert: number;
  /** Bestellt, aber noch nicht ausgeliefert (Lieferung.status "geplant") — zeigt an, welcher
   *  Kunde für die Kategorie bereits einen offenen Auftrag hat. */
  mengeOffen: number;
  einheit: string | null;
}

export interface KategorieVerlaufKunde {
  kundeId: number;
  kundeName: string;
  kundeOrt: string | null;
  eintraege: KategorieVerlaufEintrag[];
}

/** Aggregiert über alle (gefilterten) Kunden hinweg: wie viel wurde von welchem Artikel
 *  insgesamt im Zeitraum geliefert bzw. bestellt — Antwort auf "wie viel Menge habe ich von
 *  dieser Kategorie insgesamt gemacht, und wovon". */
export interface KategorieVerlaufArtikelSumme {
  artikelId: number;
  artikelName: string;
  unterkategorie: string | null;
  einheit: string | null;
  mengeGeliefert: number;
  mengeOffen: number;
  /** Anzahl unterschiedlicher Kunden, die diesen Artikel im Zeitraum erhalten/bestellt haben. */
  anzahlKunden: number;
}

/** Gesamtmenge je Einheit — eine einzelne "Gesamtmenge" über mehrere Artikel hinweg ergibt nur
 *  Sinn, wenn sie dieselbe Einheit teilen (kg vs. Stück lässt sich nicht addieren), deshalb
 *  gruppiert statt einer einzelnen Zahl. */
export interface KategorieVerlaufEinheitSumme {
  einheit: string | null;
  mengeGeliefert: number;
  mengeOffen: number;
}

export interface KategorieVerlaufParams {
  kategorie?: string | null;
  /** Mehrfachauswahl — leer/undefined = alle Unterkategorien (kein Filter). */
  unterkategorien?: string[] | null;
  /** ISO-Datum (YYYY-MM-DD), inklusive. */
  von?: string | null;
  /** ISO-Datum (YYYY-MM-DD), inklusive. */
  bis?: string | null;
  kundeSuche?: string | null;
}

export interface KategorieVerlaufResult {
  kunden: KategorieVerlaufKunde[];
  jahre: number[];
  kategorie: string;
  unterkategorien: string[];
  von: string;
  bis: string;
  artikelUebersicht: KategorieVerlaufArtikelSumme[];
  gesamtProEinheit: KategorieVerlaufEinheitSumme[];
}

export async function ladeKategorieVerlauf(params: KategorieVerlaufParams): Promise<KategorieVerlaufResult> {
  const kategorie = params.kategorie && params.kategorie.trim() ? params.kategorie : "alle";
  const unterkategorien = (params.unterkategorien ?? []).map((u) => u.trim()).filter(Boolean);

  const now = new Date();
  const heuteIso = now.toISOString().slice(0, 10);
  const defaultVonIso = new Date(Date.UTC(now.getUTCFullYear() - 2, 0, 1)).toISOString().slice(0, 10);

  const bisIso = params.bis && ISO_DATUM.test(params.bis) ? params.bis : heuteIso;
  let vonIso = params.von && ISO_DATUM.test(params.von) ? params.von : defaultVonIso;
  if (vonIso > bisIso) vonIso = bisIso;

  const vonDate = new Date(`${vonIso}T00:00:00.000Z`);
  const bisDateExklusiv = new Date(`${bisIso}T00:00:00.000Z`);
  bisDateExklusiv.setUTCDate(bisDateExklusiv.getUTCDate() + 1); // bis-Datum inklusive

  const spanneTage = (bisDateExklusiv.getTime() - vonDate.getTime()) / 86_400_000;
  const vonDateEffektiv = spanneTage > MAX_TAGE_SPANNE
    ? new Date(bisDateExklusiv.getTime() - MAX_TAGE_SPANNE * 86_400_000)
    : vonDate;

  const positionen = await prisma.lieferposition.findMany({
    where: {
      artikel: {
        ...(kategorie !== "alle" ? { kategorie } : {}),
        ...(unterkategorien.length > 0 ? { unterkategorie: { in: unterkategorien } } : {}),
      },
      lieferung: {
        // "geplant" (noch nicht ausgelieferte Aufträge) mit erfassen, damit nachvollziehbar
        // ist, welcher Kunde für diese Kategorie bereits bestellt hat, auch ohne dass schon
        // geliefert wurde. Stornierte Aufträge bewusst ausgeschlossen.
        status: { in: ["geliefert", "geplant"] },
        datum: { gte: vonDateEffektiv, lt: bisDateExklusiv },
      },
    },
    select: {
      menge: true,
      artikel: { select: { id: true, name: true, unterkategorie: true, einheit: true } },
      lieferung: {
        select: {
          datum: true,
          status: true,
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
    const istGeliefert = p.lieferung.status === "geliefert";
    const k = p.lieferung.kunde;
    let kg = kundenMap.get(k.id);
    if (!kg) {
      kg = { kundeId: k.id, kundeName: k.name, kundeOrt: k.ort, eintraege: new Map() };
      kundenMap.set(k.id, kg);
    }
    const key = `${jahr}-${p.artikel.id}`;
    const bestehend = kg.eintraege.get(key);
    if (bestehend) {
      if (istGeliefert) bestehend.mengeGeliefert += p.menge;
      else bestehend.mengeOffen += p.menge;
    } else {
      kg.eintraege.set(key, {
        jahr,
        artikelId: p.artikel.id,
        artikelName: p.artikel.name,
        unterkategorie: p.artikel.unterkategorie,
        mengeGeliefert: istGeliefert ? p.menge : 0,
        mengeOffen: istGeliefert ? 0 : p.menge,
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

  const jahrVonEffektiv = vonDateEffektiv.getUTCFullYear();
  const jahrBisEffektiv = new Date(bisDateExklusiv.getTime() - 1).getUTCFullYear();
  const jahre: number[] = [];
  for (let j = jahrBisEffektiv; j >= jahrVonEffektiv; j--) jahre.push(j);

  // Artikel-Übersicht aus den bereits nach kundeSuche gefilterten `kunden` aufgebaut (nicht aus
  // den rohen `positionen`), damit die Summen immer genau das widerspiegeln, was in der
  // Kunden-Tabelle tatsächlich angezeigt wird.
  const artikelSummeMap = new Map<
    number,
    { artikelId: number; artikelName: string; unterkategorie: string | null; einheit: string | null;
      mengeGeliefert: number; mengeOffen: number; kundenIds: Set<number> }
  >();
  for (const kg of kunden) {
    for (const e of kg.eintraege) {
      let as = artikelSummeMap.get(e.artikelId);
      if (!as) {
        as = {
          artikelId: e.artikelId,
          artikelName: e.artikelName,
          unterkategorie: e.unterkategorie,
          einheit: e.einheit,
          mengeGeliefert: 0,
          mengeOffen: 0,
          kundenIds: new Set(),
        };
        artikelSummeMap.set(e.artikelId, as);
      }
      as.mengeGeliefert += e.mengeGeliefert;
      as.mengeOffen += e.mengeOffen;
      as.kundenIds.add(kg.kundeId);
    }
  }
  const artikelUebersicht: KategorieVerlaufArtikelSumme[] = Array.from(artikelSummeMap.values())
    .map((as) => ({
      artikelId: as.artikelId,
      artikelName: as.artikelName,
      unterkategorie: as.unterkategorie,
      einheit: as.einheit,
      mengeGeliefert: as.mengeGeliefert,
      mengeOffen: as.mengeOffen,
      anzahlKunden: as.kundenIds.size,
    }))
    .sort((a, b) => (b.mengeGeliefert + b.mengeOffen) - (a.mengeGeliefert + a.mengeOffen) || a.artikelName.localeCompare(b.artikelName, "de"));

  const einheitSummeMap = new Map<string, KategorieVerlaufEinheitSumme>();
  for (const as of artikelUebersicht) {
    const key = as.einheit ?? "";
    let es = einheitSummeMap.get(key);
    if (!es) {
      es = { einheit: as.einheit, mengeGeliefert: 0, mengeOffen: 0 };
      einheitSummeMap.set(key, es);
    }
    es.mengeGeliefert += as.mengeGeliefert;
    es.mengeOffen += as.mengeOffen;
  }
  const gesamtProEinheit = Array.from(einheitSummeMap.values())
    .sort((a, b) => (b.mengeGeliefert + b.mengeOffen) - (a.mengeGeliefert + a.mengeOffen));

  return {
    kunden,
    jahre,
    kategorie,
    unterkategorien,
    von: vonDateEffektiv.toISOString().slice(0, 10),
    bis: bisIso,
    artikelUebersicht,
    gesamtProEinheit,
  };
}
