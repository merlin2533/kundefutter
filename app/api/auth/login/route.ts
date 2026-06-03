import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  SESSION_COOKIE,
  sessionCookieOptions,
  signSession,
  verifyPassword,
} from "@/lib/auth";
export const dynamic = "force-dynamic";

// Brute-Force-Schutz: max. 10 Versuche pro IP in 15 Minuten
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_LIMIT = 10;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

function checkLoginRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = loginAttempts.get(ip);
  if (!entry || now > entry.resetAt) {
    loginAttempts.set(ip, { count: 1, resetAt: now + LOGIN_WINDOW_MS });
    return true;
  }
  if (entry.count >= LOGIN_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req);
  if (!checkLoginRateLimit(ip)) {
    return NextResponse.json(
      { error: "Zu viele Anmeldeversuche. Bitte 15 Minuten warten." },
      { status: 429 },
    );
  }

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
