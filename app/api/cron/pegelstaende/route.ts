import { NextRequest, NextResponse } from "next/server";

// GET /api/cron/pegelstaende
// Leitet an den zentralen Dispatcher /api/cron weiter (Abwärtskompatibilität).
export async function GET(req: NextRequest) {
  const base = req.nextUrl.origin;
  const authHeader = req.headers.get("authorization") ?? undefined;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (authHeader) headers["Authorization"] = authHeader;

  try {
    const res = await fetch(`${base}/api/cron`, { headers });
    const data = await res.json().catch(() => ({ ok: false, error: "Ungültige Antwort" }));
    return NextResponse.json(data, { status: res.status });
  } catch {
    return NextResponse.json({ ok: false, error: "Interner Fehler beim Weiterleiten" }, { status: 502 });
  }
}
