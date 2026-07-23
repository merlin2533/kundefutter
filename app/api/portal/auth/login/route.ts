import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { signPortalSession, PORTAL_SESSION_COOKIE, portalCookieOptions } from "@/lib/portal-auth";
import { createRateLimiter, getClientIp } from "@/lib/rate-limit";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// Brute-Force-Schutz: max. 10 Versuche pro IP in 15 Minuten
const portalLoginRateLimiter = createRateLimiter({ limit: 10, windowMs: 15 * 60 * 1000 });

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req);
    if (!portalLoginRateLimiter.check(ip)) {
      return NextResponse.json(
        { error: "Zu viele Anmeldeversuche. Bitte 15 Minuten warten." },
        { status: 429 },
      );
    }

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
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
