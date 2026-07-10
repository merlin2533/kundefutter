import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "kundefutter_session";
const PORTAL_SESSION_COOKIE = "kundefutter_portal_session";

const DEV_FALLBACK_SECRET =
  "unsicher-dev-secret-bitte-SESSION_SECRET-in-der-produktion-setzen";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[middleware] SESSION_SECRET ist nicht gesetzt. In Produktion MUSS SESSION_SECRET gesetzt sein.");
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

function getPortalSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("[middleware] SESSION_SECRET ist nicht gesetzt. In Produktion MUSS SESSION_SECRET gesetzt sein.");
    }
    return new TextEncoder().encode(DEV_FALLBACK_SECRET + "-portal");
  }
  return new TextEncoder().encode(secret + "-portal");
}

// Pfade, die ohne Session aufgerufen werden dürfen
const PUBLIC_PATHS = [
  "/login",
  "/api/auth/login",
  "/api/auth/logout",
  "/api/db-check",
  "/api/app-info",
  "/api/cron",       // Cron-Endpunkt: Auth via CRON_SECRET im Handler
  "/portal/login",
  "/api/portal/auth/",
  "/api/kontakt",    // Öffentliches Kontaktformular (Marketing-Website), eigene CSRF/Rate-Limit-Absicherung
];

// Prefix-Match mit Pfadgrenze: "/api/kontakt" matcht "/api/kontakt" und
// "/api/kontakt/foo", NICHT aber "/api/kontaktdaten" (verhindert versehentlich
// zu breite Public-/CSRF-Exempt-Treffer bei künftigen Routen mit gleichem Präfix).
function matchesPathPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/");
}

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => matchesPathPrefix(pathname, p));
}

function isPortalPath(pathname: string): boolean {
  return pathname.startsWith("/portal/") || pathname.startsWith("/api/portal/");
}

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Endpunkte, die absichtlich von fremden Origins aufgerufen werden (z.B. externe
// Marketing-Website) und daher nicht am Origin-Header gemessen werden können.
// Diese Endpunkte müssen eigene CSRF-/Rate-Limit-Absicherung mitbringen.
const ORIGIN_CHECK_EXEMPT_PATHS = ["/api/kontakt"];

function isOriginCheckExempt(pathname: string): boolean {
  return ORIGIN_CHECK_EXEMPT_PATHS.some((p) => matchesPathPrefix(pathname, p));
}

/**
 * Grober CSRF-Schutz: Bei state-ändernden Requests gegen /api/* muss der
 * Origin-Header (falls vom Client gesendet) zum Host passen. Fehlt der
 * Origin-Header (z.B. curl, Server-zu-Server, ältere Browser) wird
 * durchgelassen — das ist kein vollständiger CSRF-Schutz, verhindert aber
 * klassische Cross-Site-Form-/Fetch-Angriffe moderner Browser zuverlässig.
 */
function originMismatch(req: NextRequest, pathname: string): boolean {
  if (!pathname.startsWith("/api/")) return false;
  if (!STATE_CHANGING_METHODS.has(req.method)) return false;
  if (isOriginCheckExempt(pathname)) return false;

  const origin = req.headers.get("origin");
  if (!origin) return false;

  const host = req.headers.get("host");
  if (!host) return false;

  try {
    return new URL(origin).host !== host;
  } catch {
    return true;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (originMismatch(req, pathname)) {
    return NextResponse.json({ error: "Ungültiger Origin" }, { status: 403 });
  }

  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Portal-Pfade: separates JWT prüfen
  if (isPortalPath(pathname)) {
    const portalToken = req.cookies.get(PORTAL_SESSION_COOKIE)?.value;
    let portalOk = false;
    if (portalToken) {
      try {
        await jwtVerify(portalToken, getPortalSecret(), { algorithms: ["HS256"] });
        portalOk = true;
      } catch {
        portalOk = false;
      }
    }
    if (portalOk) return NextResponse.next();
    if (pathname.startsWith("/api/portal/")) {
      return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
    }
    const loginUrl = new URL("/portal/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  let ok = false;
  if (token) {
    try {
      await jwtVerify(token, getSecret(), { algorithms: ["HS256"] });
      ok = true;
    } catch {
      ok = false;
    }
  }

  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  loginUrl.searchParams.set("next", pathname + req.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Alle Routes außer Static Assets, Service Worker, Icons
    "/((?!_next/static|_next/image|favicon.ico|sw\\.js|manifest\\.webmanifest|icons/|uploads/|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff|woff2|ttf)$).*)",
  ],
};
