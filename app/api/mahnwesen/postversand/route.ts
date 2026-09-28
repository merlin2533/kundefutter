import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// POST /api/mahnwesen/postversand
// Body: { lieferungId: number; mahnstufe?: number }
// Manuelle Bestätigung "als Brief versendet" für PDF/Ausdruck ohne E-Mail-Adresse — legt denselben
// KundeAktivitaet-Nachweis an wie POST /api/exporte/mahnung/mail (nur typ "brief" statt "email"),
// damit GET /api/mahnwesen den Versand ebenfalls erkennt. Kein Auto-Trigger beim PDF-Download/Drucken
// selbst (ein Download beweist noch keinen tatsächlichen Versand) — bewusst ein eigener, expliziter
// Klick, analog zu "rechnung_postversand_markieren" bei normalen Rechnungen.
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { lieferungId?: unknown; mahnstufe?: unknown };
    const lieferungId = Number(body.lieferungId);
    if (!Number.isInteger(lieferungId) || lieferungId <= 0) {
      return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
    }

    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      select: { kundeId: true, rechnungNr: true },
    });
    if (!lieferung) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    if (!lieferung.rechnungNr) {
      return NextResponse.json({ error: "Lieferung hat noch keine Rechnungsnummer" }, { status: 400 });
    }

    const mahnstufeRaw = body.mahnstufe;
    const mahnstufe = ([1, 2, 3] as const).includes(mahnstufeRaw as 1 | 2 | 3) ? (mahnstufeRaw as 1 | 2 | 3) : 1;
    const stufenText = mahnstufe === 1 ? "Zahlungserinnerung" : `Mahnung (Stufe ${mahnstufe})`;

    await prisma.kundeAktivitaet.create({
      data: {
        kundeId: lieferung.kundeId,
        typ: "brief",
        betreff: `${stufenText}: Rechnung ${lieferung.rechnungNr}`,
        inhalt: "Als Brief (Ausdruck/PDF) versendet markiert.",
        datum: new Date(),
        erledigt: true,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: `Markieren fehlgeschlagen: ${msg}` }, { status: 500 });
  }
}
