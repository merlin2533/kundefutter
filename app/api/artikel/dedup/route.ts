import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

/** Findet Artikel-Gruppen mit identischem Namen (case-insensitiv). */
async function findDuplicateGroups() {
  // Alle aktiven Artikel nach Name sortiert laden (id + name genügt)
  const alle = await prisma.artikel.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
    take: 5000,
  });

  // Gruppieren nach normiertem Namen
  const groups = new Map<string, { id: number; name: string }[]>();
  for (const a of alle) {
    const key = a.name.trim().toLowerCase();
    const g = groups.get(key) ?? [];
    g.push(a);
    groups.set(key, g);
  }

  return [...groups.values()]
    .filter((g) => g.length > 1)
    .map((g) => {
      const sorted = g.slice().sort((a, b) => a.id - b.id);
      return {
        name: sorted[0].name,
        count: sorted.length,
        keepId: sorted[0].id,
        deleteIds: sorted.slice(1).map((a) => a.id),
      };
    });
}

/** GET – Vorschau: wie viele Duplikate gibt es? */
export async function GET() {
  try {
    const groups = await findDuplicateGroups();
    const duplicateCount = groups.reduce((s, g) => s + g.deleteIds.length, 0);
    return NextResponse.json({ groups: groups.slice(0, 50), duplicateCount, groupCount: groups.length });
  } catch (e) {
    console.error("Dedup GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

/** POST – Bereinigung ausführen. Body: { confirm: true } */
export async function POST(req: NextRequest) {
  let body: { confirm?: boolean } = {};
  try { body = await req.json(); } catch { /* ignore */ }
  if (!body.confirm) {
    return NextResponse.json({ error: "confirm: true erforderlich" }, { status: 400 });
  }

  try {
    const groups = await findDuplicateGroups();
    let deleted = 0;
    let deactivated = 0;

    for (const g of groups) {
      for (const dupId of g.deleteIds) {
        // Prüfen ob referenziert (dann nur deaktivieren)
        const [lief, wae, bew, bed, inv, ang, rab, kp] = await Promise.all([
          prisma.lieferposition.count({ where: { artikelId: dupId } }),
          prisma.wareineingangPosition.count({ where: { artikelId: dupId } }),
          prisma.lagerbewegung.count({ where: { artikelId: dupId } }),
          prisma.kundeBedarf.count({ where: { artikelId: dupId } }),
          prisma.inventurPosition.count({ where: { artikelId: dupId } }),
          prisma.angebotPosition.count({ where: { artikelId: dupId } }),
          prisma.mengenrabatt.count({ where: { artikelId: dupId } }),
          prisma.kundeArtikelPreis.count({ where: { artikelId: dupId } }),
        ]);
        const referenziert = lief + wae + bew + bed + inv + ang + rab + kp > 0;
        if (referenziert) {
          await prisma.artikel.update({ where: { id: dupId }, data: { aktiv: false } });
          deactivated++;
        } else {
          // Abhängige Datensätze löschen
          await prisma.$transaction([
            prisma.artikelInhaltsstoff.deleteMany({ where: { artikelId: dupId } }),
            prisma.artikelLieferant.deleteMany({ where: { artikelId: dupId } }),
            prisma.artikelPreisHistorie.deleteMany({ where: { artikelId: dupId } }),
            prisma.artikelDokument.deleteMany({ where: { artikelId: dupId } }),
            prisma.artikel.delete({ where: { id: dupId } }),
          ]);
          deleted++;
        }
      }
    }

    return NextResponse.json({ deleted, deactivated, groupCount: groups.length });
  } catch (e) {
    console.error("Dedup POST error:", e);
    return NextResponse.json({ error: "Bereinigung fehlgeschlagen" }, { status: 500 });
  }
}
