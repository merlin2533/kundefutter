import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { stundenZwischenUhrzeiten } from "@/lib/utils";

export const dynamic = "force-dynamic";

const GUELTIGE_ARTEN = ["arbeit", "urlaub", "krank", "feiertag"];
type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { datum, stunden, art, notiz, von, bis } = body;

    if (art !== undefined && !GUELTIGE_ARTEN.includes(art)) {
      return NextResponse.json({ error: "Ungültige Stundenart" }, { status: 400 });
    }

    // Wird ein vollständiges Zeitfenster mitgeschickt, hat es Vorrang vor einer manuell
    // übergebenen Stundenzahl — die Stunden werden daraus neu berechnet (Aufzeichnungspflicht:
    // die Uhrzeit ist der maßgebliche Wert, nicht die reine Dauer).
    let stundenVal: number | undefined;
    if (typeof von === "string" && von.trim() && typeof bis === "string" && bis.trim()) {
      const berechnet = stundenZwischenUhrzeiten(von, bis);
      if (berechnet == null) {
        return NextResponse.json(
          { error: "Ungültiges Zeitfenster (Bis muss nach Von liegen, Format HH:MM)" },
          { status: 400 },
        );
      }
      stundenVal = berechnet;
    } else if (stunden !== undefined) {
      stundenVal = parseFloat(stunden);
    }

    const updated = await prisma.arbeitsstunde.update({
      where: { id: numId },
      data: {
        ...(datum !== undefined && { datum: new Date(datum) }),
        ...(stundenVal !== undefined && { stunden: stundenVal }),
        ...(art !== undefined && { art }),
        ...(von !== undefined && { von: von || null }),
        ...(bis !== undefined && { bis: bis || null }),
        ...(notiz !== undefined && { notiz: notiz || null }),
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "personal");
  if (denyModul) return denyModul;
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    await prisma.arbeitsstunde.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}
