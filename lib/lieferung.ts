import { prisma } from "@/lib/prisma";
import { berechneVerkaufspreis, naechsteRechnungsnummer, istLagerrelevant, bestMengenstaffel, wendeMengenstaffelAn, effektiverMengenstaffelRabatt } from "@/lib/utils";
import { artikelSafeSelect } from "@/lib/artikel-select";
import { Sentry } from "@/lib/sentry";

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Rückverfolgbarkeitspflicht Futtermittel: ab diesem Lieferdatum ist die Chargennummer
// bei Tierfutter-Positionen im Lieferschein Pflichtfeld, davor bleibt sie ein Kannfeld.
const CHARGENPFLICHT_FUTTER_AB = new Date("2027-01-01T00:00:00.000Z");

export function istChargeNrPflichtFuerLieferschein(kategorie: string, lieferDatum: Date): boolean {
  return kategorie === "Futter" && lieferDatum >= CHARGENPFLICHT_FUTTER_AB;
}

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
  /** Nur zu Dokumentationszwecken (Rabatt-Spalte auf Lieferschein/Rechnung) — wird NUR
   *  übernommen, wenn `verkaufspreis` ebenfalls explizit gesetzt ist (siehe
   *  erstelleLieferungTransaktion(): dort wird ein Mengenrabatt nur dann automatisch
   *  berechnet UND auf den Preis angewendet, wenn der Aufrufer keinen verkaufspreis
   *  vorgibt — sonst würde ein clientseitig bereits rabattierter Preis serverseitig ein
   *  zweites Mal rabattiert). */
  rabattProzent?: number;
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

      // Ein vom Aufrufer explizit übergebener Preis gilt als bereits final (z.B. die manuelle
      // Lieferungserfassung berechnet Sonderpreis + Mengenrabatt schon clientseitig für die
      // Live-Vorschau) — der Mengenrabatt wird dann NICHT nochmal serverseitig angewendet,
      // sonst würde derselbe Rabatt doppelt abgezogen. Nur wenn kein Preis mitgegeben wird
      // (z.B. KI-Batch-Erkennung ohne erkannten VK), berechnet der Server ihn inkl. Mengenrabatt
      // selbst.
      let verkaufspreis: number;
      let bestRabatt: number;
      if (pos.verkaufspreis !== undefined) {
        verkaufspreis = pos.verkaufspreis;
        bestRabatt = pos.rabattProzent ?? 0;
      } else {
        const basisVerkaufspreis = berechneVerkaufspreis(artikel, kundePreis);
        const staffel = bestMengenstaffel(pos.artikelId, artikel.kategorie, pos.menge, kundeId, alleMengenrabatte);
        verkaufspreis = wendeMengenstaffelAn(basisVerkaufspreis, staffel);
        bestRabatt = effektiverMengenstaffelRabatt(basisVerkaufspreis, staffel);
      }

      return {
        artikelId: pos.artikelId,
        menge: pos.menge,
        verkaufspreis,
        einkaufspreis: pos.einkaufspreis ?? bevorzugterLieferant?.einkaufspreis ?? 0,
        // Eingefroren bei Erstellung (analog verkaufspreis) — eine spätere Änderung
        // von Artikel.mwstSatz darf diese Position nie mehr rückwirkend verändern.
        mwstSatz: artikel.mwstSatz,
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

/**
 * Setzt eine Lieferung mit Status "geplant" auf "geliefert": bucht den Lagerausgang
 * (außer bei Streckengeschäft) und prüft die Chargennummer-Pflicht für Tierfutter.
 * Macht nichts, wenn die Lieferung nicht (mehr) "geplant" ist (idempotent) — u.a. genutzt
 * von der QR-Mobilerfassung UND automatisch beim Erstellen einer Rechnung, damit ein
 * Auftrag nicht separat manuell als geliefert markiert werden muss, sobald dafür schon
 * eine Rechnung existiert.
 */
export async function markiereLieferungGeliefertFallsGeplant(tx: Tx, lieferungId: number): Promise<void> {
  const aktLieferung = await tx.lieferung.findUnique({
    where: { id: lieferungId },
    select: { status: true, istStreckengeschaeft: true, datum: true },
  });
  if (!aktLieferung || aktLieferung.status !== "geplant") return;

  const positionen = await tx.lieferposition.findMany({ where: { lieferungId } });
  const artikelIds = [...new Set(positionen.map((p) => p.artikelId))];
  const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
  const artikelMap = new Map(artikelList.map((a) => [a.id, a]));

  for (const pos of positionen) {
    const artikel = artikelMap.get(pos.artikelId);
    if (artikel && istChargeNrPflichtFuerLieferschein(artikel.kategorie, aktLieferung.datum) && !pos.chargeNr) {
      throw new Error(`Chargennummer ist bei Tierfutter-Positionen ab 2027 Pflicht (Artikel „${artikel.name}“)`);
    }
  }

  if (!aktLieferung.istStreckengeschaeft) {
    const neuGebuchtIds: number[] = [];
    for (const pos of positionen) {
      // Bereits gebucht (z.B. weil diese Lieferung vor dem Abspalten einer Teilrechnung schon
      // einmal "geliefert" war und dabei Lagerausgang für ALLE Positionen gebucht wurde) —
      // nicht erneut abbuchen, sonst würde derselbe Lagerausgang doppelt gezählt.
      if (pos.lagerBereitsGebucht) continue;
      const artikel = artikelMap.get(pos.artikelId);
      if (!artikel || !istLagerrelevant(artikel.kategorie)) continue;
      const neuerBestand = artikel.aktuellerBestand - pos.menge;
      await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
      await tx.lagerbewegung.create({
        data: { artikelId: pos.artikelId, typ: "ausgang", menge: -pos.menge, bestandNach: neuerBestand, lieferungId },
      });
      neuGebuchtIds.push(pos.id);
    }
    if (neuGebuchtIds.length > 0) {
      await tx.lieferposition.updateMany({ where: { id: { in: neuGebuchtIds } }, data: { lagerBereitsGebucht: true } });
    }
  }

  await tx.lieferung.update({ where: { id: lieferungId }, data: { status: "geliefert" } });
}

const ALTE_FORDERUNG_ARTIKELNUMMER = "ALTE-FORDERUNG";
export const GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER = "GUTSCHRIFT-VERRECHNUNG";

/**
 * Findet (oder legt einmalig an) einen unsichtbaren Pauschal-Artikel für automatisch
 * generierte Ausgleichspositionen (Alte Forderung, Gutschrift-Verrechnung) auf einer
 * Rechnung. mwstSatz 0 %, weil diese Positionen den Ausgleich eines bereits (auf der
 * Ursprungsrechnung) versteuerten Vorgangs darstellen, keinen neuen Umsatz — erneut zu
 * besteuern wäre eine Doppelbesteuerung.
 */
export async function ladeOderErstelleAusgleichsArtikel(tx: Tx, artikelnummer: string, name: string) {
  const bestehend = await tx.artikel.findUnique({ where: { artikelnummer } });
  if (bestehend) return bestehend;
  return tx.artikel.create({
    data: {
      artikelnummer,
      name,
      kategorie: "Sonstiges",
      einheit: "Pauschale",
      standardpreis: 0,
      mwstSatz: 0,
      lagerTracking: false,
    },
  });
}

/**
 * Trägt alle offenen KundeForderung-Einträge (Restdifferenz aus einer Unterzahlung,
 * z.B. aus dem Bankabgleich) des Kunden als zusätzliche Positionen in eine Rechnung ein
 * und markiert sie als erledigt. Wird beim Erstellen einer Rechnung aufgerufen
 * (aktion=rechnung_erstellen), damit eine noch offene Differenz automatisch auf der
 * nächsten Rechnung dieses Kunden erscheint, statt manuell nachgetragen werden zu müssen.
 */
export async function injiziereAlteForderungen(tx: Tx, lieferungId: number, kundeId: number): Promise<void> {
  const offeneForderungen = await tx.kundeForderung.findMany({
    where: { kundeId, erledigt: false },
    orderBy: { createdAt: "asc" },
  });
  if (offeneForderungen.length === 0) return;

  const forderungArtikel = await ladeOderErstelleAusgleichsArtikel(tx, ALTE_FORDERUNG_ARTIKELNUMMER, "Alte Forderung");

  for (const forderung of offeneForderungen) {
    await tx.lieferposition.create({
      data: {
        lieferungId,
        artikelId: forderungArtikel.id,
        menge: 1,
        verkaufspreis: forderung.betrag,
        einkaufspreis: 0,
        mwstSatz: forderungArtikel.mwstSatz,
        notiz: forderung.grund,
      },
    });
    await tx.kundeForderung.update({
      where: { id: forderung.id },
      data: { erledigt: true, erledigtBeiLieferungId: lieferungId },
    });
  }
}

/**
 * Trägt alle offenen Gutschriften (status "OFFEN", z.B. aus einer Überzahlung im
 * Bankabgleich) des Kunden als negative Ausgleichsposition in eine Rechnung ein und
 * markiert sie als verbucht. Wird wie injiziereAlteForderungen() beim Erstellen einer
 * Rechnung aufgerufen — Gegenstück für Überzahlungen statt Unterzahlungen.
 */
export async function injiziereOffeneGutschriften(tx: Tx, lieferungId: number, kundeId: number): Promise<void> {
  const offeneGutschriften = await tx.gutschrift.findMany({
    where: { kundeId, status: "OFFEN" },
    include: { positionen: true },
    orderBy: { createdAt: "asc" },
  });
  if (offeneGutschriften.length === 0) return;

  const gutschriftArtikel = await ladeOderErstelleAusgleichsArtikel(tx, GUTSCHRIFT_VERRECHNUNG_ARTIKELNUMMER, "Gutschrift-Verrechnung");

  for (const gutschrift of offeneGutschriften) {
    const betrag = gutschrift.positionen.reduce((s, p) => s + p.menge * p.preis, 0);
    if (betrag <= 0) continue;
    await tx.lieferposition.create({
      data: {
        lieferungId,
        artikelId: gutschriftArtikel.id,
        menge: 1,
        verkaufspreis: -betrag,
        einkaufspreis: 0,
        mwstSatz: gutschriftArtikel.mwstSatz,
        notiz: `Gutschrift ${gutschrift.nummer}${gutschrift.grund ? `: ${gutschrift.grund}` : ""}`,
      },
    });
    await tx.gutschrift.update({
      where: { id: gutschrift.id },
      data: { status: "VERBUCHT", verbuchtBeiLieferungId: lieferungId },
    });
  }
}
