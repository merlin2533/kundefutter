import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Gibt alle aktiven Mitarbeiter zurück, für die im angegebenen Monat/Jahr
// noch KEINE Gehaltsabrechnung existiert.
export async function GET(req: NextRequest) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const now = new Date();
  const monat = parseInt(searchParams.get("monat") ?? String(now.getMonth() + 1), 10);
  const jahr = parseInt(searchParams.get("jahr") ?? String(now.getFullYear()), 10);

  if (isNaN(monat) || isNaN(jahr)) {
    return NextResponse.json({ error: "Ungültige Parameter" }, { status: 400 });
  }

  try {
    const [alleMitarbeiter, vorhandeneAbrechnungen] = await Promise.all([
      prisma.mitarbeiter.findMany({
        where: { aktiv: true },
        select: { id: true, vorname: true, nachname: true, typ: true },
        take: 500,
      }),
      prisma.gehaltsabrechnung.findMany({
        where: { monat, jahr },
        select: { mitarbeiterId: true },
      }),
    ]);

    const vorhandeneIds = new Set(vorhandeneAbrechnungen.map((a) => a.mitarbeiterId));
    const offene = alleMitarbeiter.filter((m) => !vorhandeneIds.has(m.id));

    return NextResponse.json(offene);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}
