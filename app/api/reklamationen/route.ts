import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function naechsteReklamationsnummer(letzteNummer: string | null): string {
  const jahr = new Date().getFullYear();
  if (!letzteNummer) return `RK-${jahr}-0001`;
  const match = letzteNummer.match(/^RK-(\d{4})-(\d+)$/);
  if (!match) return `RK-${jahr}-0001`;
  const letzterJahrInt = parseInt(match[1], 10);
  const letzterZaehler = parseInt(match[2], 10);
  if (letzterJahrInt !== jahr) return `RK-${jahr}-0001`;
  return `RK-${jahr}-${String(letzterZaehler + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const kundeId = searchParams.get("kundeId");
  const status = searchParams.get("status");
  const prioritaet = searchParams.get("prioritaet");

  const GUELTIGE_STATUS = ["OFFEN", "IN_BEARBEITUNG", "GELOEST", "GESCHLOSSEN"];
  if (status && !GUELTIGE_STATUS.includes(status)) {
    return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
  }

  const GUELTIGE_PRIORITAETEN = ["niedrig", "normal", "hoch", "kritisch"];
  if (prioritaet && !GUELTIGE_PRIORITAETEN.includes(prioritaet)) {
    return NextResponse.json({ error: "Ungültige Priorität" }, { status: 400 });
  }

  const where: Record<string, unknown> = {};
  if (kundeId) {
    const kid = parseInt(kundeId, 10);
    if (isNaN(kid)) return NextResponse.json({ error: "Ungültige kundeId" }, { status: 400 });
    where.kundeId = kid;
  }
  if (status) where.status = status;
  if (prioritaet) where.prioritaet = prioritaet;

  try {
    const reklamationen = await prisma.reklamation.findMany({
      where,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true, rechnungNr: true } },
      },
      orderBy: { datum: "desc" },
      take: 200,
    });
    return NextResponse.json(reklamationen);
  } catch (e) {
    console.error("Reklamationen GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler beim Laden der Reklamationen" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const kundeId = parseInt(String(body.kundeId ?? ""), 10);
  if (isNaN(kundeId) || kundeId <= 0) {
    return NextResponse.json({ error: "kundeId ist erforderlich" }, { status: 400 });
  }

  const betreff = typeof body.betreff === "string" ? body.betreff.trim() : "";
  const beschreibung = typeof body.beschreibung === "string" ? body.beschreibung.trim() : "";
  if (!betreff) return NextResponse.json({ error: "Betreff ist erforderlich" }, { status: 400 });
  if (!beschreibung) return NextResponse.json({ error: "Beschreibung ist erforderlich" }, { status: 400 });

  const GUELTIGE_KATEGORIEN = ["Qualitaet", "Menge", "Lieferung", "Preis", "Sonstiges"];
  const GUELTIGE_PRIORITAETEN = ["niedrig", "normal", "hoch", "kritisch"];

  const kategorie = typeof body.kategorie === "string" && GUELTIGE_KATEGORIEN.includes(body.kategorie)
    ? body.kategorie
    : "Qualitaet";
  const prioritaet = typeof body.prioritaet === "string" && GUELTIGE_PRIORITAETEN.includes(body.prioritaet)
    ? body.prioritaet
    : "normal";

  const lieferungId = body.lieferungId != null
    ? parseInt(String(body.lieferungId), 10)
    : null;
  if (lieferungId !== null && isNaN(lieferungId)) {
    return NextResponse.json({ error: "Ungültige lieferungId" }, { status: 400 });
  }

  const zugewiesen = typeof body.zugewiesen === "string" && body.zugewiesen.trim()
    ? body.zugewiesen.trim()
    : null;

  try {
    const reklamation = await prisma.$transaction(async (tx) => {
      const einstellung = await tx.einstellung.findUnique({
        where: { key: "letzte_reklamationsnummer" },
      });
      const nummer = naechsteReklamationsnummer(einstellung?.value ?? null);
      await tx.einstellung.upsert({
        where: { key: "letzte_reklamationsnummer" },
        update: { value: nummer },
        create: { key: "letzte_reklamationsnummer", value: nummer },
      });
      return tx.reklamation.create({
        data: {
          nummer,
          kundeId,
          lieferungId: lieferungId ?? undefined,
          betreff,
          beschreibung,
          kategorie,
          prioritaet,
          zugewiesen,
        },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          lieferung: { select: { id: true, datum: true, rechnungNr: true } },
        },
      });
    });
    return NextResponse.json(reklamation, { status: 201 });
  } catch (err) {
    console.error("Reklamation POST error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Reklamation konnte nicht angelegt werden";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
