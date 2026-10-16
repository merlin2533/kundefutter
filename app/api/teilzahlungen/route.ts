import { getCurrentUser } from "@/lib/auth";
import { P, requirePermission, requireAnyPermission } from "@/lib/permissions";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { berechneOffenenBetrag, berechneSammelrechnungBrutto } from "@/lib/lieferung-brutto";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lieferungIdParam = searchParams.get("lieferungId");
  const sammelrechnungIdParam = searchParams.get("sammelrechnungId");

  const lieferungId = lieferungIdParam ? parseInt(lieferungIdParam, 10) : null;
  const sammelrechnungId = sammelrechnungIdParam ? parseInt(sammelrechnungIdParam, 10) : null;

  if (lieferungId && isNaN(lieferungId))
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  if (sammelrechnungId && isNaN(sammelrechnungId))
    return NextResponse.json({ error: "Ungültige sammelrechnungId" }, { status: 400 });

  if (!lieferungId && !sammelrechnungId)
    return NextResponse.json({ error: "lieferungId oder sammelrechnungId erforderlich" }, { status: 400 });

  try {
    const teilzahlungen = await prisma.teilzahlung.findMany({
      where: {
        ...(lieferungId ? { lieferungId } : {}),
        ...(sammelrechnungId ? { sammelrechnungId } : {}),
      },
      orderBy: { datum: "asc" },
      take: 200,
    });
    return NextResponse.json(teilzahlungen);
  } catch (e) {
    Sentry.captureException(e);
    console.error("Teilzahlungen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const __me = await getCurrentUser();
  const __deny = requireAnyPermission(__me, [P.EXPORT_RECHNUNG, P.BANKABGLEICH_BEARBEITEN, P.LIEFERUNGEN_ERSTELLEN]);
  if (__deny) return __deny;
  let body: unknown;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const lieferungId = b.lieferungId != null ? parseInt(String(b.lieferungId), 10) : null;
  const sammelrechnungId = b.sammelrechnungId != null ? parseInt(String(b.sammelrechnungId), 10) : null;
  const betrag = Number(b.betrag);
  const notiz = b.notiz != null ? String(b.notiz) : null;

  if (!lieferungId && !sammelrechnungId)
    return NextResponse.json({ error: "lieferungId oder sammelrechnungId erforderlich" }, { status: 400 });
  if (lieferungId && isNaN(lieferungId))
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  if (sammelrechnungId && isNaN(sammelrechnungId))
    return NextResponse.json({ error: "Ungültige sammelrechnungId" }, { status: 400 });
  if (!betrag || isNaN(betrag) || betrag <= 0)
    return NextResponse.json({ error: "Betrag muss eine positive Zahl sein" }, { status: 400 });

  const datum = b.datum ? new Date(String(b.datum)) : new Date();
  if (isNaN(datum.getTime()))
    return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });

  try {
    const teilzahlung = await prisma.$transaction(async (tx) => {
      const tz = await tx.teilzahlung.create({
        data: {
          ...(lieferungId ? { lieferungId } : {}),
          ...(sammelrechnungId ? { sammelrechnungId } : {}),
          betrag,
          datum,
          notiz,
        },
      });
      // Decken die Teilzahlungen die Rechnung vollständig ab, gilt sie als bezahlt —
      // sonst bliebe sie in Mahnwesen/Offene Posten stehen, obwohl nichts mehr offen ist.
      if (lieferungId) {
        const l = await tx.lieferung.findUnique({
          where: { id: lieferungId },
          select: {
            bezahltAm: true, rechnungNr: true,
            teilzahlungen: { select: { betrag: true } },
            positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, mwstSatz: true, artikel: { select: { mwstSatz: true } } } },
          },
        });
        if (l && l.rechnungNr && !l.bezahltAm && berechneOffenenBetrag(l) <= 0.005) {
          await tx.lieferung.update({ where: { id: lieferungId }, data: { bezahltAm: datum } });
        }
      } else if (sammelrechnungId) {
        const sr = await tx.sammelrechnung.findUnique({
          where: { id: sammelrechnungId },
          select: {
            bezahltAm: true,
            teilzahlungen: { select: { betrag: true } },
            lieferungen: { select: { positionen: { select: { menge: true, verkaufspreis: true, rabattProzent: true, mwstSatz: true, artikel: { select: { mwstSatz: true } } } } } },
          },
        });
        if (sr && !sr.bezahltAm) {
          const brutto = berechneSammelrechnungBrutto(sr);
          const bezahlt = sr.teilzahlungen.reduce((a, t) => a + t.betrag, 0);
          if (brutto - bezahlt <= 0.005) {
            await tx.sammelrechnung.update({ where: { id: sammelrechnungId }, data: { bezahltAm: datum } });
          }
        }
      }
      return tz;
    });
    return NextResponse.json(teilzahlung, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Teilzahlung POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
