import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from "@/lib/auth";

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const benutzername = typeof body?.benutzername === "string" ? body.benutzername.trim() : "";
  const passwort = typeof body?.passwort === "string" ? body.passwort : "";

  if (!benutzername || !passwort) {
    return NextResponse.json(
      { error: "Benutzername und Passwort erforderlich" },
      { status: 400 },
    );
  }

  try {
    const user = await prisma.benutzer.findUnique({ where: { benutzername } });
    if (!user || !user.aktiv) {
      return NextResponse.json({ error: "Ungültige Zugangsdaten" }, { status: 401 });
    }
    const ok = await verifyPassword(passwort, user.passwortHash);
    if (!ok) {
      return NextResponse.json({ error: "Ungültige Zugangsdaten" }, { status: 401 });
    }

    await prisma.benutzer.update({
      where: { id: user.id },
      data: { letzterLogin: new Date() },
    });

    const token = await signSession({
      sub: user.id,
      benutzername: user.benutzername,
      rolle: user.rolle,
    });

    const res = NextResponse.json({
      user: {
        id: user.id,
        benutzername: user.benutzername,
        name: user.name,
        email: user.email,
        rolle: user.rolle,
      },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch {
    return NextResponse.json({ error: "Anmeldung fehlgeschlagen" }, { status: 500 });
  }
}
