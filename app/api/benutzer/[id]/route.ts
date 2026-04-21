import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

type Params = { params: Promise<{ id: string }> };

const ROLLEN = ["admin", "benutzer"] as const;

const SELECT = {
  id: true,
  benutzername: true,
  name: true,
  email: true,
  rolle: true,
  aktiv: true,
  letzterLogin: true,
  erstelltAm: true,
} as const;

function parseId(raw: string): number | null {
  const id = parseInt(raw, 10);
  if (isNaN(id) || id <= 0) return null;
  return id;
}

async function aktiveAdminsAusserDiesem(id: number): Promise<number> {
  return prisma.benutzer.count({
    where: { rolle: "admin", aktiv: true, NOT: { id } },
  });
}

export async function GET(_req: NextRequest, ctx: Params) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  const { id: raw } = await ctx.params;
  const id = parseId(raw);
  if (id === null) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  if (me.rolle !== "admin" && me.id !== id) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const user = await prisma.benutzer.findUnique({ where: { id }, select: SELECT });
    if (!user) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(user);
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const data: Prisma.BenutzerUpdateInput = {};
  if (typeof body?.name === "string") {
    if (!body.name.trim()) {
      return NextResponse.json({ error: "Name darf nicht leer sein" }, { status: 400 });
    }
    data.name = body.name.trim();
  }
  if (body?.email !== undefined) {
    data.email = typeof body.email === "string" && body.email.trim() ? body.email.trim() : null;
  }
  if (typeof body?.rolle === "string") {
    if (!ROLLEN.includes(body.rolle as (typeof ROLLEN)[number])) {
      return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 });
    }
    if (me.id === id && body.rolle !== "admin") {
      return NextResponse.json(
        { error: "Sie können sich selbst nicht die Admin-Rolle entziehen" },
        { status: 400 },
      );
    }
    if (body.rolle !== "admin") {
      // Auf Entzug der Admin-Rolle prüfen: letzter Admin darf es nicht sein
      const other = await aktiveAdminsAusserDiesem(id);
      if (other === 0) {
        return NextResponse.json(
          { error: "Der letzte aktive Admin kann nicht degradiert werden" },
          { status: 400 },
        );
      }
    }
    data.rolle = body.rolle;
  }
  if (typeof body?.aktiv === "boolean") {
    if (!body.aktiv && me.id === id) {
      return NextResponse.json(
        { error: "Sie können sich nicht selbst deaktivieren" },
        { status: 400 },
      );
    }
    if (!body.aktiv) {
      const other = await aktiveAdminsAusserDiesem(id);
      const target = await prisma.benutzer.findUnique({ where: { id }, select: { rolle: true, aktiv: true } });
      if (target?.rolle === "admin" && target.aktiv && other === 0) {
        return NextResponse.json(
          { error: "Der letzte aktive Admin kann nicht deaktiviert werden" },
          { status: 400 },
        );
      }
    }
    data.aktiv = body.aktiv;
  }
  if (typeof body?.passwort === "string" && body.passwort.length > 0) {
    if (body.passwort.length < 8) {
      return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
    }
    data.passwortHash = await hashPassword(body.passwort);
  }

  try {
    const user = await prisma.benutzer.update({ where: { id }, data, select: SELECT });
    return NextResponse.json(user);
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

  if (me.id === id) {
    return NextResponse.json({ error: "Sie können sich nicht selbst löschen" }, { status: 400 });
  }

  try {
    const target = await prisma.benutzer.findUnique({ where: { id }, select: { rolle: true, aktiv: true } });
    if (!target) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (target.rolle === "admin" && target.aktiv) {
      const other = await aktiveAdminsAusserDiesem(id);
      if (other === 0) {
        return NextResponse.json(
          { error: "Der letzte aktive Admin kann nicht gelöscht werden" },
          { status: 400 },
        );
      }
    }
    await prisma.benutzer.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
