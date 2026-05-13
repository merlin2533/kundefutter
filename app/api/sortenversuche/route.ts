import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
export const dynamic = "force-dynamic";

const STATUS_WHITELIST = new Set(["LAUFEND", "ABGESCHLOSSEN"]);

// GET /api/sortenversuche?jahr=2026&kultur=Wintergerste&kundeId=12&sorte=Avenue
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const jahr = parseInt(searchParams.get("jahr") ?? "", 10);
  const kultur = searchParams.get("kultur");
  const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
  const sorte = searchParams.get("sorte");

  try {
    const where: {
      jahr?: number;
      kultur?: string;
      kundeId?: number;
      positionen?: { some: { sorte: { contains: string } } };
    } = {};
    if (!isNaN(jahr)) where.jahr = jahr;
    if (kultur) where.kultur = kultur;
    if (!isNaN(kundeId)) where.kundeId = kundeId;
    if (sorte) where.positionen = { some: { sorte: { contains: sorte } } };

    const liste = await prisma.sortenversuch.findMany({
      where,
      include: {
        positionen: true,
        kunde: { select: { id: true, name: true, firma: true } },
        schlag: { select: { id: true, name: true } },
      },
      orderBy: [{ jahr: "desc" }, { kultur: "asc" }],
      take: 500,
    });
    return NextResponse.json(liste);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/sortenversuche
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (!body.name?.trim()) return NextResponse.json({ error: "Name erforderlich" }, { status: 400 });
    if (!body.kultur?.trim()) return NextResponse.json({ error: "Kultur erforderlich" }, { status: 400 });
    const jahr = parseInt(String(body.jahr ?? new Date().getFullYear()), 10);
    if (isNaN(jahr) || jahr < 1900 || jahr > 2100) {
      return NextResponse.json({ error: "Ungültiges Jahr" }, { status: 400 });
    }
    const status = body.status && STATUS_WHITELIST.has(body.status) ? body.status : "LAUFEND";

    const positionen = Array.isArray(body.positionen) ? body.positionen : [];

    const versuch = await prisma.sortenversuch.create({
      data: {
        name: body.name.trim(),
        jahr,
        kultur: body.kultur.trim(),
        standort: body.standort?.trim() || null,
        kundeId: body.kundeId ? parseInt(String(body.kundeId), 10) : null,
        schlagId: body.schlagId ? parseInt(String(body.schlagId), 10) : null,
        flaeche: body.flaeche != null && body.flaeche !== "" ? Number(body.flaeche) : null,
        status,
        startDatum: body.startDatum ? new Date(body.startDatum) : null,
        endeDatum: body.endeDatum ? new Date(body.endeDatum) : null,
        notiz: body.notiz?.trim() || null,
        positionen: {
          create: positionen
            .filter((p: { sorte?: string }) => p.sorte?.trim())
            .map((p: Record<string, unknown>) => ({
              sorte: String(p.sorte).trim(),
              saatstaerke: numOrNull(p.saatstaerke),
              ertragDtHa: numOrNull(p.ertragDtHa),
              feuchteProzent: numOrNull(p.feuchteProzent),
              proteinProzent: numOrNull(p.proteinProzent),
              hektolitergew: numOrNull(p.hektolitergew),
              bonitur: intOrNull(p.bonitur),
              reife: typeof p.reife === "string" ? p.reife : null,
              notiz: typeof p.notiz === "string" ? p.notiz : null,
            })),
        },
      },
      include: { positionen: true },
    });
    return NextResponse.json(versuch, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
function intOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = parseInt(String(v), 10);
  return isNaN(n) ? null : n;
}
