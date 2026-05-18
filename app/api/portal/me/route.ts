import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getPortalSession } from "@/lib/portal-auth";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getPortalSession();
  if (!session) return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });

  try {
    const zugang = await prisma.kundePortalZugang.findUnique({
      where: { kundeId: session.kundeId },
      include: {
        kunde: {
          select: {
            id: true,
            name: true,
            firma: true,
            strasse: true,
            plz: true,
            ort: true,
          },
        },
      },
    });

    if (!zugang) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    return NextResponse.json({
      kundeId: zugang.kundeId,
      benutzername: zugang.benutzername,
      aktiv: zugang.aktiv,
      letzterLogin: zugang.letzterLogin,
      kunde: zugang.kunde,
    });
  } catch {
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
