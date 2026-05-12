import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const GUELTIGE_STATUS = ["AKTIV", "ABGESCHLOSSEN", "STORNIERT"];

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");

  const where: Record<string, unknown> = {};

  if (kundeId) {
    const kid = parseInt(kundeId, 10);
    if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = kid;
  }
  if (status) {
    if (!GUELTIGE_STATUS.includes(status)) return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    where.status = status;
  }

  try {
    const list = await prisma.kontrakt.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        positionen: {
          include: {
            artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } },
          },
        },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(list);
  } catch (err) {
    console.error("Kontrakte GET error:", err);
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

  const kundeId = parseInt(String(body.kundeId), 10);
  if (isNaN(kundeId)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
  if (!body.gueltigVon) return NextResponse.json({ error: "gueltigVon erforderlich" }, { status: 400 });
  if (!body.gueltigBis) return NextResponse.json({ error: "gueltigBis erforderlich" }, { status: 400 });

  const positionenRaw = Array.isArray(body.positionen) ? body.positionen : [];

  try {
    const kontrakt = await prisma.$transaction(async (tx) => {
      const jahr = new Date().getFullYear();
      const key = "letzte_kontraktnummer";
      const existing = await tx.einstellung.findUnique({ where: { key } });
      const nr = (existing ? parseInt(existing.value, 10) : 0) + 1;
      await tx.einstellung.upsert({
        where: { key },
        update: { value: String(nr) },
        create: { key, value: String(nr) },
      });
      const nummer = `KON-${jahr}-${String(nr).padStart(4, "0")}`;

      const positionen = positionenRaw
        .filter((p: { artikelId?: unknown; menge?: unknown }) => p.artikelId && p.menge)
        .map((p: { artikelId: unknown; menge: unknown; preis?: unknown; einheit?: unknown }) => ({
          artikelId: parseInt(String(p.artikelId), 10),
          menge: Number(p.menge),
          preis: p.preis != null ? Number(p.preis) : null,
          einheit: p.einheit ? String(p.einheit) : "kg",
        }));

      return tx.kontrakt.create({
        data: {
          nummer,
          kundeId,
          gueltigVon: new Date(body.gueltigVon),
          gueltigBis: new Date(body.gueltigBis),
          notiz: body.notiz ? String(body.notiz) : null,
          positionen: { create: positionen },
        },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          positionen: {
            include: { artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true } } },
          },
        },
      });
    });
    return NextResponse.json(kontrakt, { status: 201 });
  } catch (err) {
    console.error("Kontrakte POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
