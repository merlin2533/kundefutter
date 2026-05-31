import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auditChanges } from "@/lib/audit";
import { artikelSafeSelect } from "@/lib/artikel-select";
import { getCurrentUser } from "@/lib/auth";
import { filterArtikelFelder, P, hasPermission } from "@/lib/permissions";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const me = await getCurrentUser();
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
    // EK-Preis-Filterung: sensible Felder nur für berechtigte User
    const result = me && !hasPermission(me, P.FELD_ARTIKEL_EINKAUFSPREIS)
      ? filterArtikelFelder(artikel as Record<string, unknown>, me)
      : artikel;
    return NextResponse.json(result);
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

  const { lieferanten, inhaltsstoffe } = body;

  // Explicit allowlist (mass-assignment protection) with typed fields for Prisma
  const data = {
    ...(body.name !== undefined ? { name: String(body.name) } : {}),
    ...(body.artikelnummer !== undefined ? { artikelnummer: String(body.artikelnummer) } : {}),
    ...(body.einheit !== undefined ? { einheit: String(body.einheit) } : {}),
    ...(body.kategorie !== undefined ? { kategorie: String(body.kategorie) } : {}),
    ...(body.unterkategorie !== undefined ? { unterkategorie: body.unterkategorie ? String(body.unterkategorie) : null } : {}),
    ...(body.standardpreis !== undefined ? { standardpreis: Number(body.standardpreis) } : {}),
    ...(body.mwstSatz !== undefined ? { mwstSatz: Number(body.mwstSatz) } : {}),
    ...(body.aktuellerBestand !== undefined ? { aktuellerBestand: Number(body.aktuellerBestand) } : {}),
    ...(body.mindestbestand !== undefined ? { mindestbestand: Number(body.mindestbestand) } : {}),
    ...(body.beschreibung !== undefined ? { beschreibung: body.beschreibung ? String(body.beschreibung) : null } : {}),
    ...(body.aktiv !== undefined ? { aktiv: Boolean(body.aktiv) } : {}),
    ...(body.chargePflicht !== undefined ? { chargePflicht: Boolean(body.chargePflicht) } : {}),
    ...(body.sprengstoffvorlaeufer !== undefined ? { sprengstoffvorlaeufer: Boolean(body.sprengstoffvorlaeufer) } : {}),
    ...(body.lagerTracking !== undefined ? { lagerTracking: Boolean(body.lagerTracking) } : {}),
    ...(body.ghsKlassen !== undefined ? { ghsKlassen: body.ghsKlassen ? String(body.ghsKlassen) : null } : {}),
    ...(body.hSaetze !== undefined ? { hSaetze: body.hSaetze ? String(body.hSaetze) : null } : {}),
    ...(body.pSaetze !== undefined ? { pSaetze: body.pSaetze ? String(body.pSaetze) : null } : {}),
    ...(body.signalwort !== undefined ? { signalwort: body.signalwort ? String(body.signalwort) : null } : {}),
    ...(body.lagerort !== undefined ? { lagerort: body.lagerort ? String(body.lagerort) : null } : {}),
    ...(body.liefergroesse !== undefined ? { liefergroesse: body.liefergroesse ? String(body.liefergroesse) : null } : {}),
    ...(body.preisStand !== undefined ? { preisStand: body.preisStand ? new Date(String(body.preisStand)) : null } : {}),
  };

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
    const message = err instanceof Error ? err.message : String(err);
    if (message === "Nicht gefunden") {
      return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
    }
    console.error("Artikel PUT error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
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
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("P2025")) {
      return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });
    }
    console.error("Artikel DELETE error:", err);
    return NextResponse.json({ error: "Interner Fehler" }, { status: 500 });
  }
}
