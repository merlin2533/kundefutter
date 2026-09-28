/**
 * lib/mahnwesen-erinnerung.ts
 * Legt für überfällige Rechnungen eine `Aufgabe`-Erinnerung an, sobald sie in eine (höhere)
 * Mahnstufe rutschen — der bestehende `cron.digest.mahnwesen`-Job (app/api/cron/route.ts,
 * jobDigestEmail) listet überfällige Rechnungen nur in einer täglichen Sammel-Mail auf, erzeugt
 * aber keine Aufgabe/Wiedervorlage. Nutzt dieselbe Mahnstufen-Berechnung wie `GET /api/mahnwesen`
 * (Fristen aus `system.mahnwesen`, manueller Override hat Vorrang).
 *
 * BEWUSST KEIN automatischer Versand — wie das Projekt Mahnungen bereits konsequent nur manuell
 * über `/mahnwesen` auslösen lässt (siehe AGENTS.md), ist auch diese Funktion nur eine Erinnerung,
 * dass eine Aktion aussteht, kein Auto-Mailer.
 *
 * Idempotenz analog `pruefeMeldepflichten()`: der Betreff enthält Rechnungsnummer UND Mahnstufe —
 * ein `findFirst`/`findMany` auf exakten Betreff (unabhängig vom `erledigt`-Status) verhindert ein
 * Duplikat, solange sich die Stufe nicht ändert. Rutscht dieselbe Rechnung später in eine höhere
 * Stufe, ändert sich der Betreff (neue Stufen-Bezeichnung) und eine neue Aufgabe entsteht —
 * gewünscht, das ist die eigentliche Eskalation.
 */
import { prisma } from "@/lib/prisma";
import { parseMahnwesenConfig, MAHNUNG_BETREFF } from "@/lib/mahnwesen-config";

export interface MahnwesenErinnerungErgebnis {
  geprueft: number;
  angelegt: number;
  aufgabenIds: number[];
}

export async function pruefeMahnstufenEskalation(): Promise<MahnwesenErinnerungErgebnis> {
  const heute = new Date();
  heute.setHours(0, 0, 0, 0);

  const cfgSetting = await prisma.einstellung.findUnique({ where: { key: "system.mahnwesen" } });
  const cfg = parseMahnwesenConfig(cfgSetting?.value);
  const automatischeMahnstufe = (tage: number): 1 | 2 | 3 =>
    tage >= cfg.stufe3Tage ? 3 : tage >= cfg.stufe2Tage ? 2 : 1;

  const offene = await prisma.lieferung.findMany({
    where: { status: "geliefert", bezahltAm: null, rechnungNr: { not: null }, rechnungStorniert: null },
    select: {
      id: true,
      kundeId: true,
      datum: true,
      rechnungNr: true,
      rechnungDatum: true,
      zahlungsziel: true,
      manuelleMahnstufe: true,
      kunde: { select: { name: true, firma: true } },
    },
    take: 5000,
  });

  interface Faellig {
    kundeId: number;
    betreff: string;
  }
  const faellige: Faellig[] = [];

  for (const l of offene) {
    const zahlungstageFrist = l.zahlungsziel ?? 30;
    const basisDatum = l.rechnungDatum ?? l.datum;
    const faelligAm = new Date(new Date(basisDatum).getTime() + zahlungstageFrist * 24 * 60 * 60 * 1000);
    faelligAm.setHours(0, 0, 0, 0);
    if (heute <= faelligAm) continue; // noch nicht überfällig

    const tageUeberfaellig = Math.floor((heute.getTime() - faelligAm.getTime()) / (24 * 60 * 60 * 1000));
    const automatischeStufe = automatischeMahnstufe(tageUeberfaellig);
    if (l.manuelleMahnstufe === null && tageUeberfaellig < cfg.stufe1Tage) continue;
    const stufe = (l.manuelleMahnstufe ?? automatischeStufe) as 1 | 2 | 3;

    const kundeName = l.kunde.firma ?? l.kunde.name;
    const betreff = `${MAHNUNG_BETREFF[stufe]} fällig: Rechnung ${l.rechnungNr} (${kundeName})`;
    faellige.push({ kundeId: l.kundeId, betreff });
  }

  if (faellige.length === 0) {
    return { geprueft: offene.length, angelegt: 0, aufgabenIds: [] };
  }

  // Ein einziger Bulk-Fetch statt N Einzelabfragen (N+1-Vermeidung, siehe AGENTS.md-Bugtabelle
  // zu wiederkehrenden Lieferungen) — welche Betreffe existieren bereits irgendwo als Aufgabe.
  const bestehendeBetreffs = new Set(
    (
      await prisma.aufgabe.findMany({
        where: { betreff: { in: faellige.map((f) => f.betreff) } },
        select: { betreff: true },
      })
    ).map((a) => a.betreff),
  );

  const aufgabenIds: number[] = [];
  for (const f of faellige) {
    if (bestehendeBetreffs.has(f.betreff)) continue;
    // Innerhalb desselben Laufs kann derselbe Betreff mehrfach vorkommen (zwei überfällige
    // Rechnungen desselben Kunden auf derselben Stufe wären unterschiedliche Rechnungsnummern und
    // damit unterschiedliche Betreffe — ein Duplikat innerhalb dieses Laufs ist deshalb praktisch
    // ausgeschlossen, das Set wird trotzdem defensiv mitgeführt).
    bestehendeBetreffs.add(f.betreff);
    const aufgabe = await prisma.aufgabe.create({
      data: {
        betreff: f.betreff,
        faelligAm: heute,
        prioritaet: f.betreff.startsWith(MAHNUNG_BETREFF[3]) ? "kritisch" : f.betreff.startsWith(MAHNUNG_BETREFF[2]) ? "hoch" : "normal",
        typ: "aufgabe",
        erledigt: false,
        kundeId: f.kundeId,
      },
    });
    aufgabenIds.push(aufgabe.id);
  }

  return { geprueft: offene.length, angelegt: aufgabenIds.length, aufgabenIds };
}
