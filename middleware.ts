import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const SESSION_COOKIE = "kundefutter_session";
const PORTAL_SESSION_COOKIE = "kundefutter_portal_session";

const DEV_FALLBACK_SECRET =
  "unsicher-dev-secret-bitte-SESSION_SECRET-in-der-produktion-setzen";

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    return new TextEncoder().encode(DEV_FALLBACK_SECRET);
  }
  return new TextEncoder().encode(secret);
}

function getPortalSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
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
  "/portal/login",
  "/api/portal/auth/",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p));
}

function isPortalPath(pathname: string): boolean {
  return pathname.startsWith("/portal/") || pathname.startsWith("/api/portal/");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

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
