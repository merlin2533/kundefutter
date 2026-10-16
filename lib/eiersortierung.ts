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

/** Wandelt die rohen Positionen aus einem Request-Body in typisierte Eingaben um (Trimmen,
 * Großschreibung der Klassen). Einzige Quelle für POST und PUT /api/eiersortierung. */
export function parsePositionenInput(raw: unknown[]): EierSortierungPositionInput[] {
  return (raw as {
    artikelId: unknown;
    gueteklasse: unknown;
    gewichtsklasse: unknown;
    menge: unknown;
    chargeNr?: unknown;
    legedatum?: unknown;
    erzeugercode?: unknown;
  }[]).map((p) => ({
    artikelId: Number(p.artikelId),
    gueteklasse: typeof p.gueteklasse === "string" ? p.gueteklasse.trim().toUpperCase() : "",
    gewichtsklasse: typeof p.gewichtsklasse === "string" ? p.gewichtsklasse.trim().toUpperCase() : "",
    menge: Number(p.menge),
    chargeNr: typeof p.chargeNr === "string" && p.chargeNr.trim() ? p.chargeNr.trim() : null,
    legedatum: typeof p.legedatum === "string" && p.legedatum.trim() ? new Date(p.legedatum) : null,
    erzeugercode: typeof p.erzeugercode === "string" && p.erzeugercode.trim() ? p.erzeugercode.trim() : null,
  }));
}

/** Netto-Mengenänderung je Artikel zwischen altem und neuem Positionsstand (neu − alt).
 * Artikel ohne Änderung fehlen im Ergebnis. Rein, ohne DB. */
export function berechneMengenDeltas(
  alt: { artikelId: number; menge: number }[],
  neu: { artikelId: number; menge: number }[],
): Map<number, number> {
  const delta = new Map<number, number>();
  for (const p of alt) delta.set(p.artikelId, (delta.get(p.artikelId) ?? 0) - p.menge);
  for (const p of neu) delta.set(p.artikelId, (delta.get(p.artikelId) ?? 0) + p.menge);
  for (const [k, v] of [...delta]) {
    // Float-Rundungsreste (z.B. 0.1+0.2−0.3) nicht als Änderung werten
    if (Math.abs(v) < 1e-9) delta.delete(k);
  }
  return delta;
}

export interface AktualisiereEierSortierungInput {
  datum: Date;
  notiz?: string | null;
  positionen: EierSortierungPositionInput[];
}

export interface AktualisiereEierSortierungErgebnis {
  sortierung: Awaited<ReturnType<typeof ladeSortierung>>;
  /** Nicht blockierender Hinweis (z.B. mehr sortiert als angeliefert), sonst null */
  warnung: string | null;
}

async function ladeSortierung(tx: Tx, id: number) {
  return tx.eierSortierung.findUnique({
    where: { id },
    include: { positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
  });
}

/** Ersetzt Datum/Notiz/Positionen einer bestehenden Sortierung und gleicht den Lagerbestand
 * per Differenzbuchung ab (Lagerbewegung "eingang" bei Mehrmenge, "ausgang" bei Minderung).
 * Innerhalb einer offenen Transaktion aufrufen; Positionen vorher mit
 * validiereEierSortierungPositionen() prüfen. Wirft EierSortierungValidierungsFehler, wenn die
 * Sortierung nicht existiert, die verknüpfte Erzeuger-Gutschrift nicht mehr OFFEN ist oder der
 * Bestand eines Artikels dadurch negativ würde. Die Anlieferung bleibt unverändert. */
export async function aktualisiereEierSortierung(
  tx: Tx,
  id: number,
  input: AktualisiereEierSortierungInput,
): Promise<AktualisiereEierSortierungErgebnis> {
  const bestehend = await tx.eierSortierung.findUnique({
    where: { id },
    include: {
      positionen: true,
      anlieferung: { select: { id: true, menge: true, gutschrift: { select: { status: true } } } },
    },
  });
  if (!bestehend) throw new EierSortierungValidierungsFehler("Sortierung nicht gefunden");

  const gs = bestehend.anlieferung?.gutschrift;
  if (gs && gs.status !== "OFFEN") {
    throw new EierSortierungValidierungsFehler(
      "Die Erzeuger-Gutschrift zu dieser Anlieferung ist bereits verbucht/abgeschlossen — Sortierung nicht mehr änderbar (manuelle Prüfung nötig)",
    );
  }

  const deltas = berechneMengenDeltas(bestehend.positionen, input.positionen);
  const artikelIds = [...new Set([...bestehend.positionen, ...input.positionen].map((p) => p.artikelId))];
  const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
  const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

  for (const [artikelId, delta] of deltas) {
    const artikel = artikelMap.get(artikelId);
    if (!artikel) throw new EierSortierungValidierungsFehler(`Artikel #${artikelId} nicht gefunden`);
    if (!istLagerrelevant(artikel.kategorie, artikel.lagerTracking)) continue;
    if (artikel.aktuellerBestand + delta < -1e-9) {
      throw new EierSortierungValidierungsFehler(
        `Bestand von „${artikel.name}“ würde negativ (${artikel.aktuellerBestand} ${delta < 0 ? "−" : "+"} ${Math.abs(delta)}) — die Ware ist offenbar schon verkauft`,
      );
    }
  }

  await tx.eierSortierungPosition.deleteMany({ where: { sortierungId: id } });
  await tx.eierSortierung.update({
    where: { id },
    data: {
      datum: input.datum,
      notiz: input.notiz ?? null,
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
  });

  for (const [artikelId, delta] of deltas) {
    const artikel = artikelMap.get(artikelId)!;
    if (!istLagerrelevant(artikel.kategorie, artikel.lagerTracking)) continue;
    const neuerBestand = artikel.aktuellerBestand + delta;
    artikel.aktuellerBestand = neuerBestand;
    await tx.artikel.update({ where: { id: artikelId }, data: { aktuellerBestand: neuerBestand } });
    await tx.lagerbewegung.create({
      data: {
        artikelId,
        typ: delta > 0 ? "eingang" : "ausgang",
        menge: delta,
        bestandNach: neuerBestand,
        notiz: `Ei-Sortierung #${id} bearbeitet — Mengenkorrektur ${delta > 0 ? "+" : ""}${delta}`,
      },
    });
  }

  let warnung: string | null = null;
  if (bestehend.anlieferung) {
    const agg = await tx.eierSortierungPosition.aggregate({
      where: { sortierung: { anlieferungId: bestehend.anlieferung.id } },
      _sum: { menge: true },
    });
    const summe = agg._sum.menge ?? 0;
    if (summe > bestehend.anlieferung.menge + 1e-9) {
      warnung = `Sortiert insgesamt ${summe}, angeliefert wurden aber nur ${bestehend.anlieferung.menge} — bitte Mengen prüfen`;
    }
  }

  return { sortierung: await ladeSortierung(tx, id), warnung };
}
