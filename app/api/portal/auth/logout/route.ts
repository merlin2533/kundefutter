import { NextResponse } from "next/server";
import { PORTAL_SESSION_COOKIE, portalClearedCookieOptions } from "@/lib/portal-auth";
export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(PORTAL_SESSION_COOKIE, "", portalClearedCookieOptions());
  return res;
}
