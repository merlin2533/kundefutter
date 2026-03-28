import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET /api/agrarantraege?search=NAME&plz=12345&ort=Musterstadt&haushaltsjahr=2023&kundeId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim();
  const plz = searchParams.get("plz")?.trim();
  const ort = searchParams.get("ort")?.trim();
  const haushaltsjahr = searchParams.get("haushaltsjahr");
  const kundeId = searchParams.get("kundeId");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: Record<string, any> = {};

  if (search) where.name = { contains: search };
  if (plz)    where.plz = { contains: plz };
  if (ort)    where.gemeinde = { contains: ort };
  if (haushaltsjahr) where.haushaltsjahr = Number(haushaltsjahr);
  if (kundeId) where.kundeId = Number(kundeId);

  const items = await prisma.antragEmpfaenger.findMany({
    where,
    include: { kunde: { select: { id: true, name: true, firma: true } } },
    orderBy: [{ haushaltsjahr: "desc" }, { gesamtBetrag: "desc" }],
    take: 100,
  });

  return NextResponse.json(items);
}

// PATCH /api/agrarantraege?id=X — Verknüpfe mit Kunden oder aktualisiere Felder
export async function PATCH(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const body = await req.json();
  const allowed: Record<string, unknown> = {};

  if ("kundeId" in body) {
    allowed.kundeId = body.kundeId ? Number(body.kundeId) : null;
  }

  const existing = await prisma.antragEmpfaenger.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

  const updated = await prisma.antragEmpfaenger.update({ where: { id }, data: allowed });
  return NextResponse.json(updated);
}

// DELETE /api/agrarantraege?id=X
export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = Number(searchParams.get("id"));
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  await prisma.antragEmpfaenger.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
