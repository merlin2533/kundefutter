import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { naechsteRechnungsnummer } from "@/lib/utils";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { ladeStandardZahlungsziel } from "@/lib/lieferung";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    // Automatisch abgelaufen setzen wenn nötig
    await prisma.angebot.updateMany({
      where: { id: numId, status: "OFFEN", gueltigBis: { lt: new Date() } },
      data: { status: "ABGELAUFEN" },
    });

    const angebot = await prisma.angebot.findUnique({
      where: { id: numId },
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!angebot) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(angebot);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Angebot GET error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { aktion, status, notiz, gueltigBis } = body;

  try {
    // Sonderaktion: Angebot annehmen → Lieferung + Sammelrechnung + Bestellpositionen
    if (aktion === "annehmen") {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

      const result = await prisma.$transaction(async (tx) => {
        const angebot = await tx.angebot.findUnique({
          where: { id: numId },
          include: {
            positionen: { include: { artikel: { select: liefposArtikelSelect } } },
          },
        });
        if (!angebot) throw new Error("Angebot nicht gefunden");
        if (angebot.status !== "OFFEN") {
          throw new Error(`Angebot hat Status "${angebot.status}" und kann nicht angenommen werden`);
        }

        // Bulk-Lookup bevorzugter Lieferanten (statt N+1 per Position)
        const artikelIds = [...new Set(angebot.positionen.map((p) => p.artikelId))];
        const lieferantenRows = artikelIds.length > 0
          ? await tx.artikelLieferant.findMany({
              where: { artikelId: { in: artikelIds } },
              orderBy: [{ bevorzugt: "desc" }, { id: "asc" }],
            })
          : [];
        const bevorzugterLieferantMap = new Map<number, typeof lieferantenRows[number]>();
        for (const row of lieferantenRows) {
          if (!bevorzugterLieferantMap.has(row.artikelId)) {
            bevorzugterLieferantMap.set(row.artikelId, row);
          }
        }

        // 1. Lieferung erstellen
        const lieferung = await tx.lieferung.create({
          data: {
            kundeId: angebot.kundeId,
            notiz: `Aus Angebot ${angebot.nummer} übernommen${angebot.notiz ? `: ${angebot.notiz}` : ""}`,
            positionen: {
              create: angebot.positionen.map((pos) => ({
                artikelId: pos.artikelId,
                menge: pos.menge,
                verkaufspreis: pos.preis * (1 - pos.rabatt / 100),
                einkaufspreis: bevorzugterLieferantMap.get(pos.artikelId)?.einkaufspreis ?? 0,
                rabattProzent: pos.rabatt,
              })),
            },
          },
        });

        // 2. Sammelrechnung erstellen und mit Lieferung verknüpfen
        const [einstellung, zahlungsziel] = await Promise.all([
          tx.einstellung.findUnique({ where: { key: "letzte_rechnungsnummer" } }),
          ladeStandardZahlungsziel(tx),
        ]);
        const rechnungNr = naechsteRechnungsnummer(einstellung?.value ?? null);
        await tx.einstellung.upsert({
          where: { key: "letzte_rechnungsnummer" },
          update: { value: rechnungNr },
          create: { key: "letzte_rechnungsnummer", value: rechnungNr },
        });
        const sammelrechnung = await tx.sammelrechnung.create({
          data: {
            kundeId: angebot.kundeId,
            rechnungNr,
            rechnungDatum: new Date(),
            zahlungsziel,
          },
        });
        await tx.lieferung.update({
          where: { id: lieferung.id },
          data: { sammelrechnungId: sammelrechnung.id },
        });

        // 3. Bestellpositionen für Lieferanten anlegen (Bulk-Map statt N+1)
        const bestellpositionen = angebot.positionen
          .map((pos) => {
            const al = bevorzugterLieferantMap.get(pos.artikelId);
            if (!al) return null;
            return {
              lieferantId: al.lieferantId,
              artikelId: pos.artikelId,
              kundeId: angebot.kundeId,
              lieferungId: lieferung.id,
              angebotId: angebot.id,
              menge: pos.menge,
              einheit: pos.einheit,
              einkaufspreis: al.einkaufspreis,
            };
          })
          .filter((p): p is NonNullable<typeof p> => p !== null);
        if (bestellpositionen.length > 0) {
          await tx.bestellposition.createMany({ data: bestellpositionen });
        }

        const updated = await tx.angebot.update({
          where: { id: numId },
          data: { status: "ANGENOMMEN", notiz: `Lieferung ${lieferung.id} / Rechnung ${rechnungNr}. ${angebot.notiz ?? ""}`.trim() },
          include: {
            kunde: { include: { kontakte: true } },
            positionen: { include: { artikel: { select: liefposArtikelSelect } } },
          },
        });

        return { angebot: updated, lieferungId: lieferung.id, sammelrechnungId: sammelrechnung.id, rechnungNr };
      });

      return NextResponse.json(result);
    }

    const numId = parseInt(id, 10);
    if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    // Positionen nachträglich bearbeiten (Voll-Ersatz) – nur bei offenen Angeboten
    if (Array.isArray(body.positionen)) {
      const eingaben: { artikelId: number; menge: number; preis: number; rabatt: number; einheit?: string; notiz?: string | null }[] = [];
      for (const p of body.positionen) {
        const artikelId = Number(p?.artikelId);
        const menge = Number(p?.menge);
        const preis = Number(p?.preis);
        const rabatt = p?.rabatt == null || p.rabatt === "" ? 0 : Number(p.rabatt);
        if (!artikelId || isNaN(artikelId)) return NextResponse.json({ error: "Ungültige artikelId in Position" }, { status: 400 });
        if (isNaN(menge) || menge <= 0) return NextResponse.json({ error: "Menge muss größer als 0 sein" }, { status: 400 });
        if (isNaN(preis) || preis < 0) return NextResponse.json({ error: "Ungültiger Preis" }, { status: 400 });
        if (isNaN(rabatt) || rabatt < 0 || rabatt > 100) return NextResponse.json({ error: "Rabatt muss zwischen 0 und 100 liegen" }, { status: 400 });
        eingaben.push({
          artikelId, menge, preis, rabatt,
          einheit: typeof p.einheit === "string" ? p.einheit : undefined,
          notiz: typeof p.notiz === "string" ? (p.notiz.trim() || null) : null,
        });
      }
      if (eingaben.length === 0) return NextResponse.json({ error: "Mindestens eine Position erforderlich" }, { status: 400 });

      const updated = await prisma.$transaction(async (tx) => {
        const ang = await tx.angebot.findUnique({ where: { id: numId }, select: { status: true } });
        if (!ang) throw Object.assign(new Error("Angebot nicht gefunden"), { code: "P2025" });
        if (ang.status !== "OFFEN") throw new Error("Nur offene Angebote können bearbeitet werden");

        const artikelIds = [...new Set(eingaben.map((p) => p.artikelId))];
        const arts = await tx.artikel.findMany({ where: { id: { in: artikelIds } }, select: { id: true, einheit: true } });
        const einheitMap = new Map(arts.map((a) => [a.id, a.einheit]));

        await tx.angebotPosition.deleteMany({ where: { angebotId: numId } });
        await tx.angebot.update({
          where: { id: numId },
          data: {
            ...(notiz !== undefined ? { notiz } : {}),
            ...(gueltigBis !== undefined ? { gueltigBis: gueltigBis ? new Date(gueltigBis) : null } : {}),
            positionen: {
              create: eingaben.map((p) => ({
                artikelId: p.artikelId,
                menge: p.menge,
                preis: p.preis,
                rabatt: p.rabatt,
                einheit: p.einheit || einheitMap.get(p.artikelId) || "kg",
                notiz: p.notiz,
              })),
            },
          },
        });
        return tx.angebot.findUnique({
          where: { id: numId },
          include: {
            kunde: { include: { kontakte: true } },
            positionen: { include: { artikel: { select: liefposArtikelSelect } } },
          },
        });
      });
      return NextResponse.json(updated);
    }

    // Normales Update
    const VALID_STATUS = ["OFFEN", "ANGENOMMEN", "ABGELEHNT", "ABGELAUFEN"];
    const updateData: { status?: string; notiz?: string | null; gueltigBis?: Date | null } = {};
    if (status !== undefined) {
      if (!VALID_STATUS.includes(status)) {
        return NextResponse.json({ error: `Ungültiger Status: ${status}` }, { status: 400 });
      }
      updateData.status = status;
    }
    if (notiz !== undefined) updateData.notiz = notiz;
    if (gueltigBis !== undefined) updateData.gueltigBis = gueltigBis ? new Date(gueltigBis) : null;

    const updated = await prisma.angebot.update({
      where: { id: numId },
      data: updateData,
      include: {
        kunde: { include: { kontakte: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Angebot PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Aktion konnte nicht ausgeführt werden";
    // Prisma P2025 = Record not found
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    await prisma.angebot.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Angebot DELETE error:", err);
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2025") {
      return NextResponse.json({ error: "Angebot nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 400 });
  }
}
