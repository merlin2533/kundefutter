import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, hashPassword } from "@/lib/auth";

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

export async function GET() {
  const me = await getCurrentUser();
  if (!me) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  if (me.rolle !== "admin") {
    return NextResponse.json({ error: "Keine Berechtigung" }, { status: 403 });
  }

  try {
    const benutzer = await prisma.benutzer.findMany({
      orderBy: { benutzername: "asc" },
      select: SELECT,
      take: 500,
    });
    return NextResponse.json(benutzer);
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

  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const benutzername = typeof body?.benutzername === "string" ? body.benutzername.trim() : "";
  const passwort = typeof body?.passwort === "string" ? body.passwort : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" && body.email.trim() ? body.email.trim() : null;
  const rolle = typeof body?.rolle === "string" ? body.rolle : "benutzer";

  if (benutzername.length < 3) {
    return NextResponse.json({ error: "Benutzername muss mindestens 3 Zeichen haben" }, { status: 400 });
  }
  if (passwort.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "Name ist erforderlich" }, { status: 400 });
  }
  if (!ROLLEN.includes(rolle as (typeof ROLLEN)[number])) {
    return NextResponse.json({ error: "Ungültige Rolle" }, { status: 400 });
  }

  try {
    const passwortHash = await hashPassword(passwort);
    const user = await prisma.benutzer.create({
      data: { benutzername, passwortHash, name, email, rolle },
      select: SELECT,
    });
    return NextResponse.json(user, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ error: "Benutzername bereits vergeben" }, { status: 409 });
    }
    return NextResponse.json({ error: "Fehler beim Anlegen" }, { status: 500 });
  }
}
