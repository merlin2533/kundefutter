import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifySession, SESSION_COOKIE } from "@/lib/auth";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const abrechnung = await prisma.gehaltsabrechnung.findUnique({
      where: { id: numId },
      include: {
        mitarbeiter: true,
      },
    });
    if (!abrechnung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(abrechnung);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json({ error: isDev && err instanceof Error ? err.message : "Interner Fehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, ctx: Ctx) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { aktion, brutto, netto, abzuege, notiz, status, zahlungsDatum } = body;

    // Aktion: "abrechnen" = OFFEN -> ABGERECHNET
    if (aktion === "abrechnen") {
      const updated = await prisma.gehaltsabrechnung.update({
        where: { id: numId },
        data: { status: "ABGERECHNET" },
        include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
      });
      return NextResponse.json(updated);
    }

    // Aktion: "auszahlen" = ABGERECHNET -> AUSGEZAHLT + Ausgabe erstellen
    if (aktion === "auszahlen") {
      const abrechnung = await prisma.gehaltsabrechnung.findUnique({
        where: { id: numId },
        include: { mitarbeiter: true },
      });
      if (!abrechnung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      if (abrechnung.status === "AUSGEZAHLT") {
        return NextResponse.json({ error: "Abrechnung wurde bereits ausgezahlt" }, { status: 409 });
      }

      const zd = zahlungsDatum ? new Date(zahlungsDatum) : new Date();
      const mm = String(abrechnung.monat).padStart(2, "0");
      const beschreibung = `Gehalt ${abrechnung.mitarbeiter.vorname} ${abrechnung.mitarbeiter.nachname} ${mm}/${abrechnung.jahr}`;

      // Ausgabe erstellen + Abrechnung in einer Transaktion aktualisieren
      const [ausgabe, updatedAbrechnung] = await prisma.$transaction(async (tx) => {
        const newAusgabe = await tx.ausgabe.create({
          data: {
            datum: zd,
            beschreibung,
            betragNetto: abrechnung.netto,
            mwstSatz: 0,
            kategorie: "Personal",
            bezahltAm: zd,
            notiz: `Gehaltsabrechnung ID ${numId}`,
          },
        });
        const updAbr = await tx.gehaltsabrechnung.update({
          where: { id: numId },
          data: {
            status: "AUSGEZAHLT",
            zahlungsDatum: zd,
            ausgabeId: newAusgabe.id,
          },
          include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
        });
        return [newAusgabe, updAbr];
      });

      return NextResponse.json({ abrechnung: updatedAbrechnung, ausgabe });
    }

    // Normales Update der Felder
    const updated = await prisma.gehaltsabrechnung.update({
      where: { id: numId },
      data: {
        ...(brutto !== undefined && { brutto: parseFloat(brutto) }),
        ...(netto !== undefined && { netto: parseFloat(netto) }),
        ...(abzuege !== undefined && { abzuege: parseFloat(abzuege) }),
        ...(notiz !== undefined && { notiz: notiz || null }),
        ...(status !== undefined && ["OFFEN", "ABGERECHNET"].includes(status) && { status }),
        ...(zahlungsDatum !== undefined && { zahlungsDatum: zahlungsDatum ? new Date(zahlungsDatum) : null }),
      },
      include: { mitarbeiter: { select: { id: true, vorname: true, nachname: true } } },
    });

    return NextResponse.json(updated);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: Ctx) {
  const session = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await ctx.params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const abrechnung = await prisma.gehaltsabrechnung.findUnique({ where: { id: numId } });
    if (!abrechnung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    if (abrechnung.status === "AUSGEZAHLT") {
      return NextResponse.json({ error: "Ausgezahlte Abrechnungen können nicht gelöscht werden" }, { status: 409 });
    }

    await prisma.gehaltsabrechnung.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const e = err as { code?: string; message?: string };
    if (e.code === "P2025") return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json({ error: isDev ? (e.message ?? "Fehler") : "Interner Fehler" }, { status: 500 });
  }
}
