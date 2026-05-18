import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signPortalSession, PORTAL_SESSION_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { benutzername, passwort } = body as { benutzername?: string; passwort?: string };

    if (!benutzername?.trim() || !passwort) {
      return NextResponse.json({ error: "Benutzername und Passwort erforderlich" }, { status: 400 });
    }

    const zugang = await prisma.kundePortalZugang.findUnique({
      where: { benutzername: benutzername.trim() },
      include: { kunde: { select: { id: true, name: true, aktiv: true } } },
    });

    if (!zugang || !zugang.aktiv) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    const valid = await bcrypt.compare(passwort, zugang.passwortHash);
    if (!valid) {
      return NextResponse.json({ error: "Ungültige Anmeldedaten" }, { status: 401 });
    }

    // Update letzterLogin
    await prisma.kundePortalZugang.update({
      where: { id: zugang.id },
      data: { letzterLogin: new Date() },
    });

    const token = await signPortalSession({
      kundeId: zugang.kundeId,
      benutzername: zugang.benutzername,
      typ: "portal",
    });

    const res = NextResponse.json({
      ok: true,
      kundeId: zugang.kundeId,
      kundeName: zugang.kunde.name,
    });

    res.cookies.set(PORTAL_SESSION_COOKIE, token, portalCookieOptions());
    return res;
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
