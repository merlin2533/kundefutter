import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseKontoauszug } from "@/lib/bankimport";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const von = searchParams.get("von");
  const bis = searchParams.get("bis");
  const zugeordnet = searchParams.get("zugeordnet");
  const kontoBezeichnung = searchParams.get("kontoBezeichnung");
  const importDatei = searchParams.get("importDatei");
  const ignoriert = searchParams.get("ignoriert");
  const limit = Math.min(parseInt(searchParams.get("limit") || "200", 10) || 200, 500);

  const where: Record<string, unknown> = {};

  // Manuell ausgeblendete Buchungen (z.B. interne Umbuchungen) verschwinden standardmäßig aus
  // allen Ansichten — nur mit explizitem ignoriert=true (eigener "Ausgeblendet"-Filter) sichtbar.
  where.ignoriert = ignoriert === "true";

  // Zeitraum bezieht sich immer auf das Buchungsdatum der Bank (Überweisungseingang/-ausgang),
  // unabhängig davon, wann eine zugehörige Rechnung gestellt wurde — die Datei kann weitere Daten
  // (z.B. Wertstellung) enthalten, die hier bewusst nicht zur Filterung herangezogen werden.
  if (von || bis) {
    where.buchungsdatum = {
      ...(von ? { gte: new Date(von) } : {}),
      ...(bis ? { lte: new Date(new Date(bis).setHours(23, 59, 59, 999)) } : {}),
    };
  }

  if (zugeordnet === "true") where.zugeordnet = true;
  else if (zugeordnet === "false") where.zugeordnet = false;

  if (kontoBezeichnung) where.kontoBezeichnung = kontoBezeichnung;
  if (importDatei) where.importDatei = importDatei;

  try {
    const [umsaetzeRaw, gesamt, offen] = await Promise.all([
      prisma.kontoumsatz.findMany({
        where,
        include: { weitereZuordnungen: true },
        orderBy: { buchungsdatum: "desc" },
        take: limit,
      }),
      prisma.kontoumsatz.count({ where }),
      prisma.kontoumsatz.count({ where: { ...where, zugeordnet: false } }),
    ]);

    // KontoumsatzWeitereZuordnung führt lieferungId/sammelrechnungId als "weiche" IDs ohne
    // Prisma-Relation (analog zu Kontoumsatz.lieferungId/sammelrechnungId selbst) — Rechnungsnr.
    // + Kundenname für die Anzeige daher in einem Rutsch nachladen statt pro Zeile einzeln.
    // Die Haupt-Zuordnung (Kontoumsatz.lieferungId/sammelrechnungId) läuft über dieselben Maps mit,
    // damit das Frontend beim Hinzufügen "weiterer Rechnungen" weiß, für welchen Kunden es andere
    // offene Rechnungen suchen soll, ohne einen Extra-Request zu brauchen.
    const lieferungIds = new Set<number>();
    const sammelrechnungIds = new Set<number>();
    for (const u of umsaetzeRaw) {
      if (u.lieferungId) lieferungIds.add(u.lieferungId);
      if (u.sammelrechnungId) sammelrechnungIds.add(u.sammelrechnungId);
      for (const w of u.weitereZuordnungen) {
        if (w.lieferungId) lieferungIds.add(w.lieferungId);
        if (w.sammelrechnungId) sammelrechnungIds.add(w.sammelrechnungId);
      }
    }
    const [lieferungen, sammelrechnungen] = await Promise.all([
      lieferungIds.size
        ? prisma.lieferung.findMany({ where: { id: { in: [...lieferungIds] } }, select: { id: true, rechnungNr: true, kundeId: true, kunde: { select: { name: true } } } })
        : [],
      sammelrechnungIds.size
        ? prisma.sammelrechnung.findMany({ where: { id: { in: [...sammelrechnungIds] } }, select: { id: true, rechnungNr: true, kundeId: true, kunde: { select: { name: true } } } })
        : [],
    ]);
    const lieferungMap = new Map(lieferungen.map((l) => [l.id, l]));
    const sammelrechnungMap = new Map(sammelrechnungen.map((s) => [s.id, s]));

    const umsaetze = umsaetzeRaw.map((u) => {
      const primaryZiel = u.lieferungId ? lieferungMap.get(u.lieferungId) : u.sammelrechnungId ? sammelrechnungMap.get(u.sammelrechnungId) : undefined;
      return {
        ...u,
        primaryKundeId: primaryZiel?.kundeId ?? null,
        primaryKundeName: primaryZiel?.kunde.name ?? null,
        weitereZuordnungen: u.weitereZuordnungen.map((w) => {
          const ziel = w.lieferungId ? lieferungMap.get(w.lieferungId) : w.sammelrechnungId ? sammelrechnungMap.get(w.sammelrechnungId) : undefined;
          return {
            id: w.id,
            lieferungId: w.lieferungId,
            sammelrechnungId: w.sammelrechnungId,
            rechnungNr: ziel?.rechnungNr ?? null,
            kundeName: ziel?.kunde.name ?? null,
          };
        }),
      };
    });

    return NextResponse.json({ umsaetze, gesamt, offen });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const datei = formData.get("datei") as File | null;
    const kontoBezeichnung = (formData.get("kontoBezeichnung") as string | null) || null;

    if (!datei) {
      return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 });
    }

    const buffer = await datei.arrayBuffer();
    // Try UTF-8 first, fall back to latin1
    let csvText: string;
    try {
      csvText = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    } catch (err) {
      Sentry.captureException(err);
      csvText = new TextDecoder("latin1").decode(buffer);
    }

    const buchungen = parseKontoauszug(csvText, datei.name);
    if (buchungen.length === 0) {
      return NextResponse.json({ error: "Keine Buchungen erkannt" }, { status: 422 });
    }

    let importiert = 0;
    let duplikate = 0;

    for (const b of buchungen) {
      // Duplikat-Check: gleicher buchungsdatum + betrag + verwendungszweck (ersten 50 Zeichen)
      const vzKurz = b.verwendungszweck.slice(0, 50);
      const existing = await prisma.kontoumsatz.findFirst({
        where: {
          buchungsdatum: b.buchungsdatum,
          betrag: b.betrag,
          verwendungszweck: { startsWith: vzKurz },
        },
        select: { id: true },
      });

      if (existing) {
        duplikate++;
        continue;
      }

      await prisma.kontoumsatz.create({
        data: {
          buchungsdatum: b.buchungsdatum,
          wertstellung: b.wertstellung ?? null,
          betrag: b.betrag,
          waehrung: b.waehrung || "EUR",
          verwendungszweck: b.verwendungszweck,
          gegenkonto: b.gegenkonto ?? null,
          gegenkontoName: b.gegenkontoName ?? null,
          saldo: b.saldo ?? null,
          kontoBezeichnung: kontoBezeichnung,
          importDatei: datei.name,
        },
      });
      importiert++;
    }

    return NextResponse.json({ importiert, duplikate });
  } catch (err) {
    Sentry.captureException(err);
    console.error(err);
    return NextResponse.json({ error: "Importfehler" }, { status: 500 });
  }
}
