import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ALL_PERMISSIONS } from "@/lib/permissions";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

function parseJson(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}

const SELECT = {
  id: true,
  name: true,
  bezeichnung: true,
  beschreibung: true,
  berechtigungen: true,
  istSystem: true,
  erstelltAm: true,
  geaendertAm: true,
  _count: { select: { benutzer: true } },
} as const;

export async function GET(_req: NextRequest, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const rolle = await prisma.rolle.findUnique({ where: { id }, select: SELECT });
    if (!rolle) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({
      ...rolle,
      berechtigungen: parseJson(rolle.berechtigungen),
      benutzerAnzahl: rolle._count.benutzer,
      _count: undefined,
    });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (me.rolle !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: { bezeichnung?: string; beschreibung?: string; berechtigungen?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Prisma.RolleUpdateInput = {};
  if (typeof body?.bezeichnung === "string") {
    const bez = body.bezeichnung.trim();
    if (!bez) return NextResponse.json({ error: "Bezeichnung darf nicht leer sein" }, { status: 400 });
    data.bezeichnung = bez;
  }
  if (body?.beschreibung !== undefined) {
    data.beschreibung = typeof body.beschreibung === "string" && body.beschreibung.trim()
      ? body.beschreibung.trim() : null;
  }
  if (Array.isArray(body?.berechtigungen)) {
    const valid = body.berechtigungen.filter(
      (p) => p === "*" || ALL_PERMISSIONS.includes(p),
    );
    data.berechtigungen = JSON.stringify(valid);
  }

  try {
    const rolle = await prisma.rolle.update({ where: { id }, data, select: SELECT });
    return NextResponse.json({
      ...rolle,
      berechtigungen: parseJson(rolle.berechtigungen),
      benutzerAnzahl: rolle._count.benutzer,
      _count: undefined,
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (me.rolle !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const rolle = await prisma.rolle.findUnique({
      where: { id },
      select: { istSystem: true, _count: { select: { benutzer: true } } },
    });
    if (!rolle) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (rolle.istSystem) {
      return NextResponse.json({ error: "System-Rollen können nicht gelöscht werden" }, { status: 400 });
    }
    if (rolle._count.benutzer > 0) {
      return NextResponse.json(
        { error: `Diese Rolle ist noch ${rolle._count.benutzer} Benutzer(n) zugewiesen` },
        { status: 400 },
      );
    }
    await prisma.rolle.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
