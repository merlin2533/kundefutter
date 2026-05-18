import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const aufgaben = await prisma.aufgabe.findMany({
      where: {
        kundeId: session.kundeId,
        typ: "aufgabe",
        betreff: { startsWith: "Portal-Bestellung:" },
      },
      orderBy: { erstellt: "desc" },
      take: 50,
    });

    return NextResponse.json(aufgaben);
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const body = await req.json();
    const { artikelName, menge, einheit, notiz } = body as {
      artikelName?: string;
      menge?: number;
      einheit?: string;
      notiz?: string;
    };

    if (!artikelName?.trim() || !menge || menge <= 0) {
      return NextResponse.json({ error: "Artikel und Menge sind erforderlich" }, { status: 400 });
    }

    const betreff = `Portal-Bestellung: ${artikelName.trim()}`;
    const beschreibung = [
      `Menge: ${menge} ${einheit ?? ""}`.trim(),
      notiz ? `Notiz: ${notiz.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const aufgabe = await prisma.aufgabe.create({
      data: {
        betreff,
        beschreibung: beschreibung || null,
        typ: "aufgabe",
        prioritaet: "normal",
        erledigt: false,
        kundeId: session.kundeId,
      },
    });

    return NextResponse.json(aufgabe, { status: 201 });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
