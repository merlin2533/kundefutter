import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { erstelleDoppelzahlungsGutschrift, type DoppelzahlungModus, type DoppelzahlungZielTyp } from "@/lib/gutschrift";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const ZIEL_TYPEN: DoppelzahlungZielTyp[] = ["lieferung", "sammelrechnung"];
const MODI: DoppelzahlungModus[] = ["erstatten", "verrechnen"];

/**
 * Wandelt einen Kontoumsatz, der eine bereits bezahlte Rechnung ein zweites Mal begleicht
 * (Doppelzahlung), in eine Gutschrift des Kunden um — die duplizierte Rechnung taucht als
 * normaler Zuordnungskandidat nicht mehr auf, da sie bereits bezahlt ist (siehe
 * lib/bankabgleich-kandidaten.ts, `bezahltAm: null`-Filter). `lieferungId`/`sammelrechnungId`
 * sind hier rein informativ (Notiztext + optionaler Gutschrift.lieferungId-Verweis), keine
 * Zahlungszuordnung im Sinne von markiereAlsBezahlt().
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const umsatzId = parseInt(id, 10);
  if (isNaN(umsatzId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { kundeId, zielTyp, zielId, modus } = body as {
    kundeId?: number;
    zielTyp?: string;
    zielId?: number;
    modus?: string;
  };

  if (!kundeId || typeof kundeId !== "number") {
    return NextResponse.json({ error: "kundeId fehlt" }, { status: 400 });
  }
  if (!zielTyp || !ZIEL_TYPEN.includes(zielTyp as DoppelzahlungZielTyp) || !zielId || typeof zielId !== "number") {
    return NextResponse.json({ error: "Referenz auf die doppelt bezahlte Rechnung fehlt" }, { status: 400 });
  }
  if (!modus || !MODI.includes(modus as DoppelzahlungModus)) {
    return NextResponse.json({ error: "Ungültiger Modus (erstatten oder verrechnen erforderlich)" }, { status: 400 });
  }

  try {
    const umsatz = await prisma.kontoumsatz.findUnique({ where: { id: umsatzId } });
    if (!umsatz) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (umsatz.zugeordnet) {
      return NextResponse.json({ error: "Dieser Kontoumsatz ist bereits zugeordnet — Zuordnung zuerst aufheben" }, { status: 400 });
    }
    if (umsatz.betrag <= 0) {
      return NextResponse.json({ error: "Eine Doppelzahlungs-Gutschrift ist nur für Zahlungseingänge (positiver Betrag) möglich" }, { status: 400 });
    }

    const ziel = zielTyp === "lieferung"
      ? await prisma.lieferung.findUnique({ where: { id: zielId }, select: { kundeId: true, rechnungNr: true } })
      : await prisma.sammelrechnung.findUnique({ where: { id: zielId }, select: { kundeId: true, rechnungNr: true } });
    if (!ziel) return NextResponse.json({ error: "Referenzierte Rechnung nicht gefunden" }, { status: 404 });
    if (ziel.kundeId !== kundeId) {
      return NextResponse.json({ error: "Die referenzierte Rechnung gehört nicht zum gewählten Kunden" }, { status: 400 });
    }

    const aktualisiert = await prisma.$transaction(async (tx) => {
      const gutschrift = await erstelleDoppelzahlungsGutschrift(tx, {
        kundeId,
        zielTyp: zielTyp as DoppelzahlungZielTyp,
        zielId,
        zielBezeichnung: ziel.rechnungNr ?? `${zielTyp === "lieferung" ? "Lieferung" : "Sammelrechnung"} ${zielId}`,
        betrag: umsatz.betrag,
        bankDatum: umsatz.buchungsdatum,
        modus: modus as DoppelzahlungModus,
      });
      return tx.kontoumsatz.update({
        where: { id: umsatzId },
        data: { zugeordnet: true, gutschriftId: gutschrift.id, zuordnungsArt: "manuell" },
      });
    });

    return NextResponse.json(aktualisiert);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Datenbankfehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
