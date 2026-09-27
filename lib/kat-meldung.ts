/**
 * lib/kat-meldung.ts
 * Aggregiert die wöchentliche Warenstrommeldung für die KAT-Datenbank (datenbank.kat.eu) —
 * de-facto Pflicht für Lieferungen in den Lebensmitteleinzelhandel, unabhängig von der
 * einmaligen Behördenregistrierung (Erzeugercode/Packstelle). Struktur analog zu
 * sammleDatevBuchungen() in lib/datev.ts: eine Sammelfunktion für Vorschau UND CSV-Export.
 */
import { prisma } from "@/lib/prisma";
import { HALTUNGSFORMEN } from "@/lib/auswahllisten";

export interface KatMeldungZeile {
  woche: string; // z.B. "2026-W37"
  erzeugercode: string;
  haltungsform: string | null;
  gueteklasse: string;
  gewichtsklasse: string;
  mengeSortiert: number; // aus EierSortierungPosition (Eingang/klassifiziert)
  mengeVerkauft: number; // aus Lieferposition (Ausgang/abgegeben)
}

/** ISO-8601-Wochennummer, Format "YYYY-Www" (z.B. "2026-W37"). */
function isoWoche(d: Date): string {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dayNr = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - dayNr + 3);
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4));
  const woche = 1 + Math.round(((date.getTime() - firstThursday.getTime()) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
  return `${date.getUTCFullYear()}-W${String(woche).padStart(2, "0")}`;
}

// Exportiert (statt nur modulintern), damit /eierkontrolle dieselbe "erste Ziffer des
// Erzeugercodes"-Logik für die Format-Validierung wiederverwendet statt sie zu duplizieren.
export function haltungsformAusErzeugercode(erzeugercode: string | null): string | null {
  if (!erzeugercode) return null;
  const code = parseInt(erzeugercode.trim().charAt(0), 10);
  return HALTUNGSFORMEN.find((h) => h.code === code)?.label ?? null;
}

export async function sammleKatMeldung(von: Date, bis: Date): Promise<KatMeldungZeile[]> {
  const [sortierPositionen, verkaufPositionen] = await Promise.all([
    prisma.eierSortierungPosition.findMany({
      where: { sortierung: { datum: { gte: von, lte: bis } } },
      select: { menge: true, gueteklasse: true, gewichtsklasse: true, erzeugercode: true, sortierung: { select: { datum: true } } },
    }),
    prisma.lieferposition.findMany({
      where: { gueteklasse: { not: null }, lieferung: { status: "geliefert", datum: { gte: von, lte: bis } } },
      select: { menge: true, gueteklasse: true, gewichtsklasse: true, erzeugercode: true, lieferung: { select: { datum: true } } },
    }),
  ]);

  const map = new Map<string, KatMeldungZeile>();
  function zeile(woche: string, erzeugercode: string | null, gueteklasse: string | null, gewichtsklasse: string | null) {
    const ec = erzeugercode ?? "—";
    const gk = gueteklasse ?? "—";
    const gw = gewichtsklasse ?? "—";
    const key = `${woche}|${ec}|${gk}|${gw}`;
    let z = map.get(key);
    if (!z) {
      z = { woche, erzeugercode: ec, haltungsform: haltungsformAusErzeugercode(erzeugercode), gueteklasse: gk, gewichtsklasse: gw, mengeSortiert: 0, mengeVerkauft: 0 };
      map.set(key, z);
    }
    return z;
  }

  for (const p of sortierPositionen) {
    zeile(isoWoche(p.sortierung.datum), p.erzeugercode, p.gueteklasse, p.gewichtsklasse).mengeSortiert += p.menge;
  }
  for (const p of verkaufPositionen) {
    zeile(isoWoche(p.lieferung.datum), p.erzeugercode, p.gueteklasse, p.gewichtsklasse).mengeVerkauft += p.menge;
  }

  return [...map.values()].sort((a, b) => a.woche.localeCompare(b.woche) || a.erzeugercode.localeCompare(b.erzeugercode));
}

function csvQ(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildKatMeldungCsv(zeilen: KatMeldungZeile[]): string {
  const header = ["Woche", "Erzeugercode", "Haltungsform", "Güteklasse", "Gewichtsklasse", "Menge sortiert", "Menge verkauft"].join(";");
  const rows = zeilen.map((z) =>
    [z.woche, z.erzeugercode, z.haltungsform ?? "", z.gueteklasse, z.gewichtsklasse, z.mengeSortiert, z.mengeVerkauft].map(csvQ).join(";")
  );
  return [header, ...rows].join("\n");
}

// ─── Berichte (/statistik/eier) ────────────────────────────────────────────────
// Nutzt dieselbe wöchentliche Aggregation wie die KAT-Meldung — keine zweite Prisma-Query.
// Die Berichte-Seite kollabiert/gruppiert die Wochendimension je nach Ansicht selbst
// (Güteklassen-Split, Gewichtsklassen-Verteilung, Top-Erzeuger), die Wochenauflösung bleibt
// dabei erhalten, falls später ein Zeitverlauf gebraucht wird.
export async function sammleEierStatistik(von: Date, bis: Date): Promise<KatMeldungZeile[]> {
  return sammleKatMeldung(von, bis);
}

export interface EierStatistikZusammenfassung {
  gueteklassen: { key: string; mengeSortiert: number; mengeVerkauft: number }[];
  gewichtsklassen: { key: string; mengeSortiert: number; mengeVerkauft: number }[];
  topErzeuger: { erzeugercode: string; haltungsform: string | null; mengeSortiert: number; mengeVerkauft: number }[];
  summeSortiert: number;
  summeVerkauft: number;
}

/** Verdichtet KatMeldungZeile[] (wochengenau) zu den drei Ansichten der Berichte-Seite. */
export function verdichteEierStatistik(zeilen: KatMeldungZeile[]): EierStatistikZusammenfassung {
  const gueteMap = new Map<string, { mengeSortiert: number; mengeVerkauft: number }>();
  const gewichtMap = new Map<string, { mengeSortiert: number; mengeVerkauft: number }>();
  const erzeugerMap = new Map<string, { haltungsform: string | null; mengeSortiert: number; mengeVerkauft: number }>();

  for (const z of zeilen) {
    const g = gueteMap.get(z.gueteklasse) ?? { mengeSortiert: 0, mengeVerkauft: 0 };
    g.mengeSortiert += z.mengeSortiert;
    g.mengeVerkauft += z.mengeVerkauft;
    gueteMap.set(z.gueteklasse, g);

    const w = gewichtMap.get(z.gewichtsklasse) ?? { mengeSortiert: 0, mengeVerkauft: 0 };
    w.mengeSortiert += z.mengeSortiert;
    w.mengeVerkauft += z.mengeVerkauft;
    gewichtMap.set(z.gewichtsklasse, w);

    const e = erzeugerMap.get(z.erzeugercode) ?? { haltungsform: z.haltungsform, mengeSortiert: 0, mengeVerkauft: 0 };
    e.mengeSortiert += z.mengeSortiert;
    e.mengeVerkauft += z.mengeVerkauft;
    erzeugerMap.set(z.erzeugercode, e);
  }

  const topErzeuger = [...erzeugerMap.entries()]
    .map(([erzeugercode, v]) => ({ erzeugercode, ...v }))
    .sort((a, b) => (b.mengeSortiert + b.mengeVerkauft) - (a.mengeSortiert + a.mengeVerkauft))
    .slice(0, 10);

  return {
    gueteklassen: [...gueteMap.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key)),
    gewichtsklassen: [...gewichtMap.entries()].map(([key, v]) => ({ key, ...v })).sort((a, b) => a.key.localeCompare(b.key)),
    topErzeuger,
    summeSortiert: zeilen.reduce((s, z) => s + z.mengeSortiert, 0),
    summeVerkauft: zeilen.reduce((s, z) => s + z.mengeVerkauft, 0),
  };
}
