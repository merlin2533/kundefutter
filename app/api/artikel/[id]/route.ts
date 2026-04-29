import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditChanges } from "@/lib/audit";
import { artikelSafeSelect } from "@/lib/artikel-select";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const artikel = await prisma.artikel.findUnique({
      where: { id: Number(id) },
      select: {
        ...artikelSafeSelect,
        inhaltsstoffe: true,
        lieferanten: { include: { lieferant: true } },
        kundePreise: { include: { kunde: true } },
        preisHistorie: { orderBy: { geaendertAm: "desc" as const }, take: 20 },
        bedarfe: { include: { kunde: true } },
        dokumente: true,
      },
    });
    if (!artikel) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(artikel);
  } catch (e) {
    console.error("Artikel [id] GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { lieferanten, inhaltsstoffe, ...data } = body;

  if (data.mwstSatz !== undefined) data.mwstSatz = Number(data.mwstSatz);

  try {
    let altSnapshot: Record<string, unknown> | null = null;
    const artikel = await prisma.$transaction(async (tx) => {
      const alt = await tx.artikel.findUnique({
        where: { id: Number(id) },
        select: { id: true, standardpreis: true },
      });
      if (!alt) throw new Error("Nicht gefunden");
      altSnapshot = alt as Record<string, unknown>;

      if (data.standardpreis !== undefined && alt.standardpreis !== data.standardpreis) {
        await tx.artikelPreisHistorie.create({
          data: {
            artikelId: Number(id),
            alterPreis: alt.standardpreis,
            neuerPreis: data.standardpreis,
          },
        });
      }

      return tx.artikel.update({
        where: { id: Number(id) },
        data: {
          ...data,
          ...(lieferanten !== undefined && {
            lieferanten: {
              deleteMany: {},
              create: lieferanten,
            },
          }),
          ...(inhaltsstoffe !== undefined && {
            inhaltsstoffe: {
              deleteMany: {},
              create: (inhaltsstoffe as { name: string; menge?: number | null; einheit?: string | null }[]).map((i) => ({
                name: i.name,
                menge: i.menge ?? null,
                einheit: i.einheit ?? null,
              })),
            },
          }),
        },
        select: {
          ...artikelSafeSelect,
          inhaltsstoffe: true,
          lieferanten: { include: { lieferant: true } },
          dokumente: true,
        },
      });
    });
    if (altSnapshot) {
      void auditChanges(
        "Artikel",
        Number(id),
        altSnapshot,
        artikel as Record<string, unknown>,
        ["name", "standardpreis", "mindestbestand"]
      );
    }
    return NextResponse.json(artikel);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    if (message === "Nicht gefunden") {
      return NextResponse.json({ error: message }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const artikelId = Number(id);
  if (!artikelId || isNaN(artikelId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    // Prüfen ob Artikel in anderen Entitäten referenziert wird → dann nur soft-delete
    const [lieferposCount, wareneingangCount, bewegungCount, bedarfCount, inventurCount, angebotPosCount, rabattCount, kundePreisCount] = await Promise.all([
      prisma.lieferposition.count({ where: { artikelId } }),
      prisma.wareineingangPosition.count({ where: { artikelId } }),
      prisma.lagerbewegung.count({ where: { artikelId } }),
      prisma.kundeBedarf.count({ where: { artikelId } }),
      prisma.inventurPosition.count({ where: { artikelId } }),
      prisma.angebotPosition.count({ where: { artikelId } }),
      prisma.mengenrabatt.count({ where: { artikelId } }),
      prisma.kundeArtikelPreis.count({ where: { artikelId } }),
    ]);
    const referenziert = lieferposCount + wareneingangCount + bewegungCount + bedarfCount + inventurCount + angebotPosCount + rabattCount + kundePreisCount > 0;
    if (referenziert) {
      // Soft-delete: nur deaktivieren, damit historische Daten erhalten bleiben
      await prisma.artikel.update({ where: { id: artikelId }, data: { aktiv: false } });
      return NextResponse.json({ ok: true, soft: true });
    }
    // Hard-delete: keine Referenzen vorhanden, Artikel kann komplett entfernt werden
    await prisma.artikel.delete({ where: { id: artikelId } });
    return NextResponse.json({ ok: true, soft: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Interner Fehler";
    if (message.includes("P2025")) {
      return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
