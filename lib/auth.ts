import { cookies } from "next/headers";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "kundefutter_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

const DEV_FALLBACK_SECRET =
  "unsicher-dev-secret-bitte-SESSION_SECRET-in-der-produktion-setzen";

let warnedAboutFallback = false;

export function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (!warnedAboutFallback) {
      warnedAboutFallback = true;
      console.warn(
        "[auth] SESSION_SECRET ist nicht gesetzt oder zu kurz – Dev-Fallback wird verwendet. In Produktion MUSS SESSION_SECRET (>= 32 Zeichen) gesetzt sein.",
      );
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

export async function signSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload } as unknown as JWTPayload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(getSessionSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
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
        aktiv: true,
      },
    });
    if (!user || !user.aktiv) return null;
    return user;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function clearedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
