import { prisma } from "@/lib/prisma";
import { berechneVerkaufspreis, naechsteRechnungsnummer } from "@/lib/utils";
import { artikelSafeSelect } from "@/lib/artikel-select";
import { Sentry } from "@/lib/sentry";

type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

/**
 * Lädt das unter Einstellungen › Firma hinterlegte Standard-Zahlungsziel (Tage).
 * Fällt auf 30 Tage zurück, falls kein Wert konfiguriert oder ungültig ist.
 */
export async function ladeStandardZahlungsziel(client: Tx | typeof prisma = prisma): Promise<number> {
  const einstellung = await client.einstellung.findUnique({ where: { key: "firma.zahlungszielStandard" } });
  const wert = parseInt(einstellung?.value ?? "", 10);
  return !isNaN(wert) && wert >= 0 ? wert : 30;
}

export interface LieferungPositionInput {
  artikelId: number;
  menge: number;
  verkaufspreis?: number;
  einkaufspreis?: number;
  chargeNr?: string;
  notiz?: string;
}

export interface ErstelleLieferungInput {
  kundeId: number;
  datum?: Date;
  notiz?: string;
  wiederkehrend?: boolean;
  istStreckengeschaeft?: boolean;
  streckenLieferantId?: number | null;
  quelle?: string;
  positionen: LieferungPositionInput[];
}

export interface ErstelleLieferungResult {
  lieferung: Awaited<ReturnType<typeof erstelleLieferungTransaktion>>;
  kreditlimitWarnung: boolean;
  offenerBetrag?: number;
  kreditlimit?: number;
}

async function erstelleLieferungTransaktion(input: ErstelleLieferungInput) {
  const { kundeId, positionen } = input;
  return prisma.$transaction(async (tx) => {
    // Batch-load all needed data upfront to avoid N+1 queries
    const artikelIds = positionen.map((p) => p.artikelId);

    const [alleArtikel, alleKundePreise, alleBevorzugteLieferanten, alleMengenrabatte, zahlungsziel] = await Promise.all([
      tx.artikel.findMany({ where: { id: { in: artikelIds } }, select: { id: true, name: true, kategorie: true, standardpreis: true, einheit: true, mwstSatz: true, aktuellerBestand: true, mindestbestand: true, notiz: true } }),
      tx.kundeArtikelPreis.findMany({ where: { kundeId, artikelId: { in: artikelIds } } }),
      tx.artikelLieferant.findMany({ where: { artikelId: { in: artikelIds }, bevorzugt: true } }),
      tx.mengenrabatt.findMany({
        where: {
          aktiv: true,
          OR: [{ kundeId }, { kundeId: null }],
        },
      }),
      ladeStandardZahlungsziel(tx),
    ]);

    const artikelMap = new Map(alleArtikel.map((a) => [a.id, a]));
    const kundePreisMap = new Map(alleKundePreise.map((kp) => [kp.artikelId, kp]));
    const bevorzugterLieferantMap = new Map(alleBevorzugteLieferanten.map((al) => [al.artikelId, al]));

    // Verkaufspreise + Einkaufspreise automatisch befüllen falls nicht übergeben
    const angereichert = positionen.map((pos) => {
      const artikel = artikelMap.get(pos.artikelId);
      if (!artikel) throw new Error(`Artikel mit ID ${pos.artikelId} nicht gefunden`);
      const kundePreis = kundePreisMap.get(pos.artikelId) ?? null;
      const bevorzugterLieferant = bevorzugterLieferantMap.get(pos.artikelId);

      const basisVerkaufspreis = pos.verkaufspreis ?? berechneVerkaufspreis(artikel, kundePreis);

      // Mengenrabatt: filter in JS (vonMenge per position, then artikel/kategorie match)
      const passende = alleMengenrabatte.filter((r) => {
        if (r.vonMenge > pos.menge) return false;
        if (r.artikelId !== null) return r.artikelId === pos.artikelId;
        if (r.kategorie !== null) return r.kategorie === artikel.kategorie;
        return false;
      });

      // Wähle den höchsten Rabatt
      let bestRabatt = 0;
      for (const r of passende) {
        if (r.rabattProzent > bestRabatt) bestRabatt = r.rabattProzent;
      }

      const rabattVerkaufspreis = bestRabatt > 0
        ? Math.round(basisVerkaufspreis * (1 - bestRabatt / 100) * 100) / 100
        : basisVerkaufspreis;

      return {
        artikelId: pos.artikelId,
        menge: pos.menge,
        verkaufspreis: rabattVerkaufspreis,
        einkaufspreis: pos.einkaufspreis ?? bevorzugterLieferant?.einkaufspreis ?? 0,
        chargeNr: pos.chargeNr ?? null,
        // Artikel-Notiz durchschleifen, falls keine positionsspezifische Notiz übergeben wurde
        notiz: pos.notiz ?? artikel.notiz ?? null,
        rabattProzent: bestRabatt,
      };
    });

    return tx.lieferung.create({
      data: {
        kundeId,
        datum: input.datum ?? new Date(),
        notiz: input.notiz,
        wiederkehrend: input.wiederkehrend ?? false,
        istStreckengeschaeft: input.istStreckengeschaeft ?? false,
        streckenLieferantId: input.streckenLieferantId ?? undefined,
        quelle: input.quelle,
        zahlungsziel,
        positionen: { create: angereichert },
      },
      include: {
        kunde: true,
        positionen: { include: { artikel: { select: artikelSafeSelect } } },
      },
    });
  });
}

/**
 * Legt eine Lieferung inkl. Positionen an, berechnet dabei automatisch fehlende
 * Verkaufspreise (Sonderpreise/Mengenrabatte) und prüft anschließend nicht-blockierend
 * das Kreditlimit des Kunden. Wird sowohl von der manuellen Lieferungs-Erfassung
 * (POST /api/lieferungen) als auch von der KI-Batch-Erkennung genutzt.
 */
export async function erstelleLieferungMitPreisberechnung(
  input: ErstelleLieferungInput
): Promise<ErstelleLieferungResult> {
  const lieferung = await erstelleLieferungTransaktion(input);

  // Kreditlimit-Prüfung (nur Warnung, kein Fehler)
  let kreditlimitWarnung = false;
  let offenerBetrag: number | undefined;
  let kreditlimitWert: number | undefined;
  try {
    const kunde = await prisma.kunde.findUnique({
      where: { id: input.kundeId },
      select: { kreditlimit: true },
    });
    if (kunde?.kreditlimit != null) {
      kreditlimitWert = kunde.kreditlimit;
      // Offene Lieferungen (geliefert, noch nicht bezahlt, mit Rechnungsnummer)
      const offeneLieferungen = await prisma.lieferung.findMany({
        where: { kundeId: input.kundeId, bezahltAm: null, status: "geliefert", rechnungNr: { not: null }, rechnungStorniert: null },
        include: { positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true } } },
        take: 200,
      });
      offenerBetrag = offeneLieferungen.reduce((sum, l) => {
        const netto = l.positionen.reduce((s, p) => s + p.menge * p.verkaufspreis * (1 - p.rabattProzent / 100), 0);
        return sum + netto;
      }, 0);
      if (offenerBetrag > kreditlimitWert) {
        kreditlimitWarnung = true;
      }
    }
  } catch (err) {
    Sentry.captureException(err);
    // Kreditlimit-Check ist nicht kritisch, Fehler ignorieren
  }

  return { lieferung, kreditlimitWarnung, offenerBetrag, kreditlimit: kreditlimitWert };
}

// Prüft, ob eine Rechnungsnummer bereits an eine andere Lieferung oder Sammelrechnung vergeben ist.
export async function rechnungsnummerVergeben(
  tx: Tx,
  nr: string,
  exceptLieferungId: number | null,
): Promise<boolean> {
  const l = await tx.lieferung.findFirst({
    where: { rechnungNr: nr, ...(exceptLieferungId ? { id: { not: exceptLieferungId } } : {}) },
    select: { id: true },
  });
  if (l) return true;
  const s = await tx.sammelrechnung.findFirst({ where: { rechnungNr: nr }, select: { id: true } });
  return !!s;
}

/**
 * Vergibt die nächste Rechnungsnummer (Zähler `letzte_rechnungsnummer`) an eine bestehende
 * Lieferung und setzt `rechnungNr`/`rechnungDatum`. Wird sowohl von der manuellen
 * Rechnungserstellung (PUT /api/lieferungen/[id], aktion=rechnung_erstellen) als auch von der
 * KI-Batch-Erkennung (optionales "Rechnung automatisch erzeugen") genutzt.
 */
export async function vergebeRechnungsnummerFuerLieferung(tx: Tx, lieferungId: number): Promise<string> {
  const existing = await tx.lieferung.findUnique({ where: { id: lieferungId }, select: { rechnungNr: true } });
  if (existing?.rechnungNr) {
    throw new Error("Lieferung hat bereits eine Rechnungsnummer");
  }

  const [einstellung, prefixSetting] = await Promise.all([
    tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } }),
    tx.einstellung.findUnique({ where: { key: "system.nummernkreis.rechnung_prefix" } }),
  ]);
  const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null, prefixSetting?.value || "RE");

  if (await rechnungsnummerVergeben(tx, rechnungNr, lieferungId)) {
    throw new Error(`Rechnungsnummer ${rechnungNr} ist bereits vergeben – bitte den Zählerstand unter Einstellungen › Nummernkreise korrigieren`);
  }

  await tx.einstellung.upsert({
    where: { key: "letzte_rechnungsnummer" },
    update: { value: rechnungNr },
    create: { key: "letzte_rechnungsnummer", value: rechnungNr },
  });

  await tx.lieferung.update({
    where: { id: lieferungId },
    data: { rechnungNr, rechnungDatum: new Date() },
  });

  return rechnungNr;
}
