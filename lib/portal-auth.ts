import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { Sentry } from "@/lib/sentry";

export const PORTAL_SESSION_COOKIE = "kundefutter_portal_session";
export const PORTAL_SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 Tage

const DEV_FALLBACK_SECRET =
  "unsicher-dev-secret-bitte-SESSION_SECRET-in-der-produktion-setzen";

function getPortalSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return new TextEncoder().encode(DEV_FALLBACK_SECRET + "-portal");
  }
  return new TextEncoder().encode(secret + "-portal");
}

export type PortalSessionPayload = {
  kundeId: number;
  benutzername: string;
  typ: "portal";
};

export async function signPortalSession(payload: PortalSessionPayload): Promise<string> {
  return new SignJWT({ ...payload } as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${PORTAL_SESSION_MAX_AGE}s`)
    .sign(getPortalSecret());
}

export async function verifyPortalSession(token: string): Promise<PortalSessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getPortalSecret(), {
      algorithms: ["HS256"],
    });
    if (
      typeof payload.kundeId === "number" &&
      typeof payload.benutzername === "string" &&
      payload.typ === "portal"
    ) {
      return {
        kundeId: payload.kundeId as number,
        benutzername: payload.benutzername as string,
        typ: "portal",
      };
    }
    return null;
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

export async function getPortalSession(): Promise<{ kundeId: number; benutzername: string } | null> {
  try {
    const jar = await cookies();
    const token = jar.get(PORTAL_SESSION_COOKIE)?.value;
    if (!token) return null;
    const payload = await verifyPortalSession(token);
    if (!payload) return null;
    return { kundeId: payload.kundeId, benutzername: payload.benutzername };
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
}

// Hinweis: `secure` folgt COOKIE_SECURE (nicht NODE_ENV), da das Deployment
// standardmäßig über reines HTTP läuft (siehe lib/auth.ts sessionCookieOptions).
export function portalCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: PORTAL_SESSION_MAX_AGE,
  };
}

export function portalClearedCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "strict" as const,
    secure: process.env.COOKIE_SECURE === "true",
    path: "/",
    maxAge: 0,
  };
}
