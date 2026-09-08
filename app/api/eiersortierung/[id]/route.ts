import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { istLagerrelevant } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET /api/eiersortierung/[id]
export async function GET(_req: NextRequest, ctx: Params) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { id } = await ctx.params;
    const sortierungId = parseInt(id, 10);
    if (isNaN(sortierungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    const sortierung = await prisma.eierSortierung.findUnique({
      where: { id: sortierungId },
      include: {
        anlieferung: { select: { id: true, nummer: true, kunde: { select: { id: true, name: true, firma: true, erzeugercode: true, haltungsform: true } } } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!sortierung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(sortierung);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// DELETE /api/eiersortierung/[id] — bucht den Lagerzugang je Position zurück (Lagerbewegung
// "ausgang"), bevor der Datensatz (inkl. Positionen, onDelete: Cascade) gelöscht wird.
export async function DELETE(_req: NextRequest, ctx: Params) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const { id } = await ctx.params;
    const sortierungId = parseInt(id, 10);
    if (isNaN(sortierungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

    await prisma.$transaction(async (tx) => {
      const sortierung = await tx.eierSortierung.findUnique({
        where: { id: sortierungId },
        include: { positionen: true },
      });
      if (!sortierung) return;

      for (const pos of sortierung.positionen) {
        const artikel = await tx.artikel.findUnique({ where: { id: pos.artikelId } });
        if (!artikel || !istLagerrelevant(artikel.kategorie, artikel.lagerTracking)) continue;
        const neuerBestand = artikel.aktuellerBestand - pos.menge;
        await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
        await tx.lagerbewegung.create({
          data: {
            artikelId: pos.artikelId,
            typ: "ausgang",
            menge: -pos.menge,
            bestandNach: neuerBestand,
            chargeNr: pos.chargeNr,
            notiz: `Ei-Sortierung #${sortierung.id} gelöscht — Lagerzugang zurückgebucht`,
          },
        });
      }

      await tx.eierSortierung.delete({ where: { id: sortierungId } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
