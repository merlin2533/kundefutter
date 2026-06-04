import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { istLagerrelevant } from "@/lib/utils";
import { liefposArtikelSelect } from "@/lib/artikel-select";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    const retoure = await prisma.retoure.findUnique({
      where: { id: numId },
      include: {
        lieferant: { select: { id: true, name: true } },
        eingangsRechnung: { select: { id: true, nummer: true, betrag: true, status: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!retoure) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(retoure);
  } catch (err) {
    console.error("Retoure GET error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  // Storno: Bestand zurückbuchen + Gutschrift neutralisieren
  if (body.aktion === "stornieren") {
    try {
      const result = await prisma.$transaction(async (tx) => {
        const ret = await tx.retoure.findUnique({
          where: { id: numId },
          include: { positionen: true },
        });
        if (!ret) throw new Error("Nicht gefunden");
        if (ret.status === "STORNIERT") throw new Error("Retoure ist bereits storniert");

        // Bestand zurückbuchen (nur lagergeführte Artikel – konsistent zur Buchung beim Anlegen)
        const artikelIds = [...new Set(ret.positionen.map((p) => p.artikelId))];
        const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
        for (const pos of ret.positionen) {
          const artikel = artikelMap.get(pos.artikelId);
          if (!artikel || !istLagerrelevant(artikel.kategorie)) continue;
          const neuerBestand = artikel.aktuellerBestand + pos.menge;
          artikel.aktuellerBestand = neuerBestand;
          await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
          await tx.lagerbewegung.create({
            data: {
              artikelId: pos.artikelId,
              typ: "eingang",
              menge: pos.menge,
              bestandNach: neuerBestand,
              retoureId: ret.id,
              chargeNr: pos.chargeNr,
              notiz: `Storno Retoure ${ret.nummer}`,
            },
          });
        }

        // Zugehörige Lieferantengutschrift stornieren (eigenständiger, von der Retoure erzeugter Beleg)
        if (ret.eingangsRechnungId) {
          await tx.eingangsRechnung.update({
            where: { id: ret.eingangsRechnungId },
            data: { status: "STORNIERT" },
          });
        }

        return tx.retoure.update({
          where: { id: numId },
          data: { status: "STORNIERT" },
          include: {
            lieferant: { select: { id: true, name: true } },
            eingangsRechnung: { select: { id: true, nummer: true, betrag: true, status: true } },
            positionen: { include: { artikel: { select: liefposArtikelSelect } } },
          },
        });
      });
      return NextResponse.json(result);
    } catch (err) {
      console.error("Retoure Storno error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Storno fehlgeschlagen";
      const status = err instanceof Error && err.message === "Nicht gefunden" ? 404 : 400;
      return NextResponse.json({ error: message }, { status });
    }
  }

  // Notiz aktualisieren
  if (body.notiz !== undefined) {
    try {
      const updated = await prisma.retoure.update({
        where: { id: numId },
        data: { notiz: typeof body.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null },
        include: {
          lieferant: { select: { id: true, name: true } },
          eingangsRechnung: { select: { id: true, nummer: true, betrag: true, status: true } },
          positionen: { include: { artikel: { select: liefposArtikelSelect } } },
        },
      });
      return NextResponse.json(updated);
    } catch (err) {
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Speichern fehlgeschlagen";
      return NextResponse.json({ error: message }, { status: 400 });
    }
  }

  return NextResponse.json({ error: "Unbekannte Aktion" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  try {
    const ret = await prisma.retoure.findUnique({ where: { id: numId }, select: { status: true } });
    if (!ret) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (ret.status !== "STORNIERT") {
      return NextResponse.json(
        { error: "Nur stornierte Retouren können gelöscht werden. Bitte zuerst stornieren." },
        { status: 400 },
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.lagerbewegung.updateMany({ where: { retoureId: numId }, data: { retoureId: null } });
      await tx.retourePosition.deleteMany({ where: { retoureId: numId } });
      await tx.retoure.delete({ where: { id: numId } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Retoure DELETE error:", err);
    return NextResponse.json({ error: "Löschen fehlgeschlagen" }, { status: 500 });
  }
}
