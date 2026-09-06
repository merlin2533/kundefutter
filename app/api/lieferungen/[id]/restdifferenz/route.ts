import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verrechneOffeneRestdifferenz, RestdifferenzValidierungsFehler } from "@/lib/lieferung";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Verrechnet den noch offenen Restbetrag einer bereits gestellten Rechnung — z.B. wenn ein
// Kunde beim Überweisen eine Gutschrift falsch/zu wenig abgezogen hat. Optional wird eine
// bestehende offene Gutschrift des Kunden dagegen verbucht; ein danach verbleibender
// Restbetrag wird als KundeForderung angelegt und automatisch in die nächste Rechnung
// dieses Kunden übernommen (siehe injiziereAlteForderungen() in lib/lieferung.ts).
export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const nId = parseInt(id, 10);
  if (isNaN(nId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const gutschriftId = b.gutschriftId != null ? parseInt(String(b.gutschriftId), 10) : null;
  if (gutschriftId != null && isNaN(gutschriftId)) {
    return NextResponse.json({ error: "Ungültige gutschriftId" }, { status: 400 });
  }

  try {
    const ergebnis = await prisma.$transaction((tx) => verrechneOffeneRestdifferenz(tx, nId, { gutschriftId }));
    return NextResponse.json(ergebnis);
  } catch (err) {
    if (err instanceof RestdifferenzValidierungsFehler) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    Sentry.captureException(err);
    console.error("Restdifferenz POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
