import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRetourennummer, istLagerrelevant } from "@/lib/utils";
import { liefposArtikelSelect } from "@/lib/artikel-select";

export const dynamic = "force-dynamic";

const GRUENDE = ["Kommission", "Mangel", "Falschlieferung", "Sonstiges"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferantId = searchParams.get("lieferantId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};
  if (lieferantId) where.lieferantId = Number(lieferantId);
  if (status) where.status = status;

  try {
    const retouren = await prisma.retoure.findMany({
      where,
      include: {
        lieferant: { select: { id: true, name: true } },
        eingangsRechnung: { select: { id: true, nummer: true, betrag: true, status: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(retouren);
  } catch (err) {
    console.error("Retouren GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { lieferantId, datum, grund, notiz } = body;

  if (!lieferantId) {
    return NextResponse.json({ error: "Lieferant ist Pflichtfeld" }, { status: 400 });
  }
  const grundWert = typeof grund === "string" && GRUENDE.includes(grund) ? grund : "Kommission";

  const positionen = (Array.isArray(body.positionen) ? body.positionen : []).map((p: {
    artikelId: unknown; menge: unknown; einkaufspreis?: unknown; chargeNr?: unknown;
  }) => ({
    artikelId: Number(p.artikelId),
    menge: Number(p.menge),
    einkaufspreis: Number(p.einkaufspreis ?? 0),
    chargeNr: typeof p.chargeNr === "string" && p.chargeNr.trim() ? p.chargeNr.trim() : null,
  })).filter((p: { artikelId: number; menge: number; einkaufspreis: number }) =>
    Number.isInteger(p.artikelId) && p.artikelId > 0 && Number.isFinite(p.menge) && p.menge > 0 &&
    Number.isFinite(p.einkaufspreis) && p.einkaufspreis >= 0);

  if (positionen.length === 0) {
    return NextResponse.json({ error: "Mindestens eine gültige Position erforderlich" }, { status: 400 });
  }

  try {
    const retoure = await prisma.$transaction(async (tx) => {
      const lieferant = await tx.lieferant.findUnique({ where: { id: Number(lieferantId) }, select: { id: true, name: true } });
      if (!lieferant) throw new Error("Lieferant nicht gefunden");

      // Nummer vergeben
      const einstellung = await tx.einstellung.findUnique({ where: { key: "system.letzteRetourenNr" } });
      const nummer = naechsteRetourennummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "system.letzteRetourenNr" },
        update: { value: nummer },
        create: { key: "system.letzteRetourenNr", value: nummer },
      });

      const gutschriftBetrag = Math.round(
        positionen.reduce((s: number, p: { menge: number; einkaufspreis: number }) => s + p.menge * p.einkaufspreis, 0) * 100,
      ) / 100;

      // Retoure + Positionen anlegen
      const ret = await tx.retoure.create({
        data: {
          nummer,
          lieferantId: lieferant.id,
          datum: datum ? new Date(datum) : new Date(),
          grund: grundWert,
          notiz: typeof notiz === "string" && notiz.trim() ? notiz.trim() : null,
          status: "GEBUCHT",
          gutschriftBetrag,
          positionen: {
            create: positionen.map((p: { artikelId: number; menge: number; einkaufspreis: number; chargeNr: string | null }) => ({
              artikelId: p.artikelId,
              menge: p.menge,
              einkaufspreis: p.einkaufspreis,
              chargeNr: p.chargeNr,
            })),
          },
        },
        include: { positionen: true },
      });

      // Bestand abbuchen (Ware geht zurück zum Lieferanten)
      const artikelIds = [...new Set(ret.positionen.map((p) => p.artikelId))];
      const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
      const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
      for (const pos of ret.positionen) {
        const artikel = artikelMap.get(pos.artikelId);
        // Nur lagergeführte Artikel buchen (wie im Liefer-Flow) – Dienstleistungen o.ä. überspringen
        if (!artikel || !istLagerrelevant(artikel.kategorie)) continue;
        const neuerBestand = artikel.aktuellerBestand - pos.menge;
        artikel.aktuellerBestand = neuerBestand;
        await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "retoure",
            menge: -pos.menge,
            bestandNach: neuerBestand,
            retoureId: ret.id,
            chargeNr: pos.chargeNr,
            notiz: `Retoure ${nummer} → ${lieferant.name}`,
          },
        });
      }

      // Lieferantengutschrift als eigenständigen, bereits ausgeglichenen Beleg dokumentieren.
      // Status "BEZAHLT" + mwst 0, damit der Gutschrift-Beleg NICHT in der SEPA-Überweisungsliste
      // oder der Liquiditätsvorschau (Filter status="OFFEN") als zu zahlende Verbindlichkeit auftaucht.
      if (gutschriftBetrag > 0) {
        const gutschrift = await tx.eingangsRechnung.create({
          data: {
            nummer,
            lieferantId: lieferant.id,
            datum: ret.datum,
            betrag: -gutschriftBetrag,
            mwst: 0,
            status: "BEZAHLT",
            zahlungsDatum: ret.datum,
            notiz: `Lieferantengutschrift zu Retoure ${nummer}`,
          },
        });
        await tx.retoure.update({ where: { id: ret.id }, data: { eingangsRechnungId: gutschrift.id } });
      }

      return tx.retoure.findUnique({
        where: { id: ret.id },
        include: {
          lieferant: { select: { id: true, name: true } },
          eingangsRechnung: { select: { id: true, nummer: true, betrag: true, status: true } },
          positionen: { include: { artikel: { select: liefposArtikelSelect } } },
        },
      });
    });

    return NextResponse.json(retoure, { status: 201 });
  } catch (err) {
    console.error("Retoure POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Retoure konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
