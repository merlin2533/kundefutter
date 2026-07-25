import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";

export const SESSION_COOKIE = "kundefutter_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage (Standardwert)

/** Lädt die Session-Laufzeit aus den DB-Einstellungen (sicherheit.session_timeout_stunden). */
export async function getSessionMaxAge(): Promise<number> {
  try {
    const { prisma: db } = await import("@/lib/prisma");
    const e = await db.einstellung.findUnique({ where: { key: "sicherheit.session_timeout_stunden" } });
    if (!e?.value) return SESSION_MAX_AGE;
    const h = parseFloat(e.value);
    return Number.isFinite(h) && h > 0 ? Math.round(h * 3600) : SESSION_MAX_AGE;
  } catch (e) {
    Sentry.captureException(e);
    return SESSION_MAX_AGE;
  }
}

const DEV_FALLBACK_SECRET =
  "unsicher-dev-secret-bitte-SESSION_SECRET-in-der-produktion-setzen";

let warnedAboutFallback = false;

export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      if (process.env.NODE_ENV === "production") {
        console.error(
          "[auth] CRITICAL: SESSION_SECRET nicht gesetzt – Dev-Fallback wird in Produktion verwendet! Bitte SESSION_SECRET setzen.",
        );
      } else {
        console.warn(
          "[auth] SESSION_SECRET nicht gesetzt – Dev-Fallback aktiv.",
        );
      }
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  sub: number;
  benutzername: string;
  rolle: string;
};

export async function hashPassword(pw: string): Promise<string> {
  return bcrypt.hash(pw, 10);
}

export async function verifyPassword(pw: string, hash: string): Promise<boolean> {
  return bcrypt.compare(pw, hash);
}

export async function signSession(payload: SessionPayload, maxAge?: number): Promise<string> {
  const age = maxAge ?? await getSessionMaxAge();
  return new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${age}s`)
    .sign(getSessionSecret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getSessionSecret(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.sub === "number" &&
      typeof payload.benutzername === "string" &&
      typeof payload.rolle === "string"
    ) {
      return {
        sub: payload.sub,
        benutzername: payload.benutzername,
        rolle: payload.rolle,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export type CurrentUser = {
  id: number;
  benutzername: string;
  name: string;
  email: string | null;
  rolle: string;
  rolleId: number | null;
  rolleBezeichnung: string | null;    // Anzeigename der zugewiesenen Rolle
  rolleBerechtigungen: string[];      // Berechtigungen aus der Rolle (geparst)
  berechtigungen: string[];           // individuelle Overrides (geparst)
  aktiv: boolean;
};

export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const payload = await verifySession(token);
  if (!payload) return null;
  try {
    const user = await prisma.benutzer.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        benutzername: true,
        name: true,
        email: true,
        rolle: true,
        rolleId: true,
        berechtigungen: true,
        aktiv: true,
        rolleRef: {
          select: { bezeichnung: true, berechtigungen: true },
        },
      },
    });
    if (!user || !user.aktiv) return null;
    return {
      id: user.id,
      benutzername: user.benutzername,
      name: user.name,
      email: user.email,
      rolle: user.rolle,
      rolleId: user.rolleId,
      rolleBezeichnung: user.rolleRef?.bezeichnung ?? null,
      rolleBerechtigungen: parseJson(user.rolleRef?.berechtigungen),
      berechtigungen: parseJson(user.berechtigungen),
      aktiv: user.aktiv,
    };
  } catch (e) {
    Sentry.captureException(e);
    return null;
  }
}

function parseJson(raw: string | undefined | null): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    Sentry.captureException(e);
    return [];
  }
}

export function sessionCookieOptions(maxAge: number = SESSION_MAX_AGE) {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge,
  };
}

export function clearedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  };
}
