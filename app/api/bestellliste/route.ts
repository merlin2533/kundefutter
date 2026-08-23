import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { vorschlagLieferantFuerArtikel } from "@/lib/bestellvorschlag-lieferant";
import { Sentry } from "@/lib/sentry";

// GET /api/bestellliste?status=offen&lieferantId=X
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status"); // offen | bestellt | geliefert | alle
  const lieferantId = searchParams.get("lieferantId");

  const where: Record<string, unknown> = {};
  if (lieferantId) {
    const id = parseInt(lieferantId, 10);
    if (isNaN(id)) return NextResponse.json({ error: "Ungültige lieferantId" }, { status: 400 });
    where.lieferantId = id;
  }
  if (status && status !== "alle") where.status = status;
  else if (!status) where.status = { in: ["offen", "bestellt"] }; // default: aktive

  try {
    const positionen = await prisma.bestellposition.findMany({
      where,
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true, frachtkosten: true, mindestbestellwert: true } },
        artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, kategorie: true, aktuellerBestand: true, lagerort: true } },
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true } },
        bestellung: { select: { id: true, nummer: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
    });
    return NextResponse.json(positionen);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

// POST /api/bestellliste — manuelles/diktiertes Erfassen einer Position, unabhängig von einem
// Kundenangebot (kundeId/lieferungId/angebotId bleiben null). Body: { artikelId, menge, einheit?,
// lieferantId?, notiz? }. Ohne lieferantId wird automatisch ein Vorschlag ermittelt
// (vorschlagLieferantFuerArtikel) — ohne jeden zugeordneten Lieferanten schlägt die Anfrage fehl,
// da Bestellposition.lieferantId nicht optional ist; der Lieferant lässt sich danach jederzeit
// über PATCH ändern ("Umschlüsseln").
export async function POST(req: NextRequest) {
  let body: { artikelId?: unknown; menge?: unknown; einheit?: unknown; lieferantId?: unknown; notiz?: unknown };
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const artikelId = parseInt(String(body.artikelId), 10);
  if (isNaN(artikelId)) return NextResponse.json({ error: "Ungültige artikelId" }, { status: 400 });
  const menge = Number(body.menge);
  if (!Number.isFinite(menge) || menge <= 0) return NextResponse.json({ error: "Ungültige Menge" }, { status: 400 });

  try {
    const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { einheit: true } });
    if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });

    let lieferantId = body.lieferantId != null ? parseInt(String(body.lieferantId), 10) : NaN;
    let einkaufspreis = 0;
    if (isNaN(lieferantId)) {
      const vorschlag = await vorschlagLieferantFuerArtikel(artikelId);
      if (!vorschlag) {
        return NextResponse.json(
          { error: "Kein Lieferant für diesen Artikel hinterlegt — bitte manuell auswählen." },
          { status: 422 }
        );
      }
      lieferantId = vorschlag.lieferantId;
      einkaufspreis = vorschlag.einkaufspreis;
    } else {
      const zuordnung = await prisma.artikelLieferant.findUnique({
        where: { artikelId_lieferantId: { artikelId, lieferantId } },
        select: { einkaufspreis: true },
      });
      einkaufspreis = zuordnung?.einkaufspreis ?? 0;
    }

    const position = await prisma.bestellposition.create({
      data: {
        artikelId,
        lieferantId,
        menge,
        einheit: typeof body.einheit === "string" && body.einheit.trim() ? body.einheit.trim() : artikel.einheit,
        einkaufspreis,
        notiz: typeof body.notiz === "string" && body.notiz.trim() ? body.notiz.trim() : null,
      },
      include: {
        lieferant: { select: { id: true, name: true, email: true, telefon: true, frachtkosten: true, mindestbestellwert: true } },
        artikel: { select: { id: true, name: true, artikelnummer: true, einheit: true, kategorie: true, aktuellerBestand: true, lagerort: true } },
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true } },
        bestellung: { select: { id: true, nummer: true } },
      },
    });
    return NextResponse.json(position, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
