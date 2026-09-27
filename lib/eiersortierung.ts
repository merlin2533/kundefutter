// Gemeinsame Ei-Sortierungs-Logik: Validierung + Anlage inkl. Lagerbuchung, extrahiert aus
// POST /api/eiersortierung, damit der CSV/XLS-Import und der Demodaten-Loader
// (scripts/lade-demodaten-eierhandel.ts) exakt dieselbe Logik nutzen — sonst greift z.B. eine
// später angehängte Erzeugerabrechnungs-Kopplung nicht bei importierten/geseedeten Sortierungen.
// Relative statt @/-Importe: dieses Modul wird auch von scripts/lade-demodaten-eierhandel.ts
// per ts-node geladen, das (wie prisma/seed.ts) ohne tsconfig-paths läuft und den @/-Alias
// nicht auflösen kann.
import { liefposArtikelSelect } from "./artikel-select";
import { GUETEKLASSEN, GEWICHTSKLASSEN, istGueltigerErzeugercode } from "./auswahllisten";
import { istLagerrelevant } from "./utils";
import type { Tx } from "./lieferung";

const GUETEKLASSEN_KEYS = new Set<string>(GUETEKLASSEN.map((g) => g.key));
const GEWICHTSKLASSEN_KEYS = new Set<string>(GEWICHTSKLASSEN.map((g) => g.key));

export class EierSortierungValidierungsFehler extends Error {}

export interface EierSortierungPositionInput {
  artikelId: number;
  gueteklasse: string;
  gewichtsklasse: string;
  menge: number;
  chargeNr?: string | null;
  legedatum?: Date | null;
  erzeugercode?: string | null;
}

export interface ErstelleEierSortierungInput {
  datum: Date;
  anlieferungId?: number | null;
  notiz?: string | null;
  erstelltVon?: string | null;
  positionen: EierSortierungPositionInput[];
}

/** Validiert die bereits geparsten Positionen einer Ei-Sortierung — wirft
 * EierSortierungValidierungsFehler bei ungültigen Werten. Einzige Quelle der Wahrheit für
 * POST /api/eiersortierung, den CSV/XLS-Import und den Demodaten-Loader. */
export function validiereEierSortierungPositionen(positionen: EierSortierungPositionInput[]): void {
  if (positionen.length === 0) {
    throw new EierSortierungValidierungsFehler("positionen erforderlich");
  }
  for (const p of positionen) {
    if (!Number.isInteger(p.artikelId) || p.artikelId <= 0 || !Number.isFinite(p.menge) || p.menge <= 0) {
      throw new EierSortierungValidierungsFehler("Ungültige Position (artikelId/menge)");
    }
    if (!GUETEKLASSEN_KEYS.has(p.gueteklasse)) {
      throw new EierSortierungValidierungsFehler(`Ungültige Güteklasse „${p.gueteklasse}“ (erlaubt: A, B)`);
    }
    if (!GEWICHTSKLASSEN_KEYS.has(p.gewichtsklasse)) {
      throw new EierSortierungValidierungsFehler(`Ungültige Gewichtsklasse „${p.gewichtsklasse}“ (erlaubt: S, M, L, XL)`);
    }
    if (p.legedatum && isNaN(p.legedatum.getTime())) {
      throw new EierSortierungValidierungsFehler("Ungültiges Legedatum");
    }
    if (!istGueltigerErzeugercode(p.erzeugercode ?? null)) {
      throw new EierSortierungValidierungsFehler(`Erzeugercode-Format ungültig: „${p.erzeugercode}“`);
    }
  }
}

/** Prüft, dass eine gewählte anlieferungId existiert und einen Eier-Artikel betrifft — wirft
 * EierSortierungValidierungsFehler sonst. */
export async function validiereAnlieferungFuerSortierung(tx: Tx, anlieferungId: number): Promise<void> {
  const anlieferung = await tx.anlieferung.findUnique({
    where: { id: anlieferungId },
    select: { artikel: { select: { kategorie: true } } },
  });
  if (!anlieferung) {
    throw new EierSortierungValidierungsFehler("Anlieferung nicht gefunden");
  }
  if (anlieferung.artikel.kategorie !== "Eier") {
    throw new EierSortierungValidierungsFehler("Die gewählte Anlieferung betrifft keinen Artikel der Kategorie „Eier“");
  }
}

/** Legt eine EierSortierung inkl. Positionen an und bucht je Position Lagerzugang
 * (Lagerbewegung "eingang" + Artikel.aktuellerBestand) — muss innerhalb einer bereits offenen
 * Transaktion aufgerufen werden (Aufrufer trägt die äußere prisma.$transaction()). Validiert
 * NICHT selbst — validiereEierSortierungPositionen()/validiereAnlieferungFuerSortierung() vorher
 * aufrufen. */
export async function erstelleEierSortierung(tx: Tx, input: ErstelleEierSortierungInput) {
  const s = await tx.eierSortierung.create({
    data: {
      datum: input.datum,
      anlieferungId: input.anlieferungId ?? null,
      notiz: input.notiz ?? null,
      erstelltVon: input.erstelltVon ?? null,
      positionen: {
        create: input.positionen.map((p) => ({
          artikelId: p.artikelId,
          gueteklasse: p.gueteklasse,
          gewichtsklasse: p.gewichtsklasse,
          menge: p.menge,
          chargeNr: p.chargeNr ?? null,
          legedatum: p.legedatum ?? null,
          erzeugercode: p.erzeugercode ?? null,
        })),
      },
    },
    include: { positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
  });

  const artikelIds = [...new Set(s.positionen.map((p) => p.artikelId))];
  const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
  const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

  for (const pos of s.positionen) {
    const artikel = artikelMap.get(pos.artikelId);
    if (!artikel || !istLagerrelevant(artikel.kategorie, artikel.lagerTracking)) continue;
    const neuerBestand = artikel.aktuellerBestand + pos.menge;
    artikel.aktuellerBestand = neuerBestand;
    await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
    await tx.lagerbewegung.create({
      data: {
        artikelId: pos.artikelId,
        typ: "eingang",
        menge: pos.menge,
        bestandNach: neuerBestand,
        chargeNr: pos.chargeNr,
        notiz: `Ei-Sortierung #${s.id} · Güte ${pos.gueteklasse}/${pos.gewichtsklasse}${pos.chargeNr ? ` · Charge ${pos.chargeNr}` : ""}`,
      },
    });
  }

  return s;
}
