import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { ALL_PERMISSIONS, ROLLE_PRESETS } from "@/lib/permissions";
export const dynamic = "force-dynamic";

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

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (me.rolle !== "admin" && !me.rolleId) {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const rollen = await prisma.rolle.findMany({
      orderBy: [{ istSystem: "desc" }, { name: "asc" }],
      select: SELECT,
    });
    return NextResponse.json(
      rollen.map((r) => ({
        ...r,
        berechtigungen: parseJson(r.berechtigungen),
        benutzerAnzahl: r._count.benutzer,
        _count: undefined,
      })),
    );
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (me.rolle !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  let body: { name?: string; bezeichnung?: string; beschreibung?: string; berechtigungen?: string[]; preset?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const name = typeof body?.name === "string" ? body.name.trim().toLowerCase().replace(/\s+/g, "_") : "";
  const bezeichnung = typeof body?.bezeichnung === "string" ? body.bezeichnung.trim() : "";
  if (!name || name.length < 2) return NextResponse.json({ error: "Name zu kurz" }, { status: 400 });
  if (!bezeichnung) return NextResponse.json({ error: "Bezeichnung erforderlich" }, { status: 400 });

  // Berechtigungen: aus Preset oder direkt übergeben
  let berechtigungen: string[] = [];
  if (body?.preset && ROLLE_PRESETS[body.preset]) {
    berechtigungen = ROLLE_PRESETS[body.preset].berechtigungen;
  } else if (Array.isArray(body?.berechtigungen)) {
    berechtigungen = body.berechtigungen.filter(
      (p) => p === "*" || ALL_PERMISSIONS.includes(p),
    );
  }

  try {
    const rolle = await prisma.rolle.create({
      data: {
        name,
        bezeichnung,
        beschreibung: typeof body?.beschreibung === "string" ? body.beschreibung.trim() || null : null,
        berechtigungen: JSON.stringify(berechtigungen),
        istSystem: false,
      },
      select: SELECT,
    });
    return NextResponse.json(
      { ...rolle, berechtigungen: parseJson(rolle.berechtigungen), benutzerAnzahl: 0, _count: undefined },
      { status: 201 },
    );
  } catch (e: unknown) {
    if (e && typeof e === "object" && "code" in e && (e as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "Rollenname bereits vergeben" }, { status: 409 });
    }
    return NextResponse.json({ error: "Fehler beim Anlegen" }, { status: 500 });
  }
}

function parseJson(raw: string): string[] {
  try {
    const p = JSON.parse(raw);
    return Array.isArray(p) ? p : [];
  } catch {
    return [];
  }
}
