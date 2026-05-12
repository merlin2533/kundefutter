import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const reklamation = await prisma.reklamation.findUnique({
      where: { id: numId },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true, rechnungNr: true } },
      },
    });
    if (!reklamation) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(reklamation);
  } catch (e) {
    console.error("Reklamation GET error:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  // Aktion: loesen
  if (body.aktion === "loesen") {
    try {
      const reklamation = await prisma.reklamation.update({
        where: { id: numId },
        data: {
          status: "GELOEST",
          geloestAm: new Date(),
        },
        include: {
          kunde: { select: { id: true, name: true, firma: true } },
          lieferung: { select: { id: true, datum: true, rechnungNr: true } },
        },
      });
      return NextResponse.json(reklamation);
    } catch (err) {
      // P2025: Record not found
      if ((err as { code?: string }).code === "P2025") {
        return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
      }
      console.error("Reklamation loesen error:", err);
      const isDev = process.env.NODE_ENV === "development";
      const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
      return NextResponse.json({ error: message }, { status: 500 });
    }
  }

  const GUELTIGE_STATUS = ["OFFEN", "IN_BEARBEITUNG", "GELOEST", "GESCHLOSSEN"];
  const GUELTIGE_KATEGORIEN = ["Qualitaet", "Menge", "Lieferung", "Preis", "Sonstiges"];
  const GUELTIGE_PRIORITAETEN = ["niedrig", "normal", "hoch", "kritisch"];

  // Explizite Feldliste (Mass-Assignment-Schutz)
  const updateData: {
    betreff?: string;
    beschreibung?: string;
    kategorie?: string;
    prioritaet?: string;
    status?: string;
    zugewiesen?: string | null;
    loesung?: string | null;
    geloestAm?: Date | null;
  } = {};

  if (body.betreff !== undefined) {
    const betreff = typeof body.betreff === "string" ? body.betreff.trim() : "";
    if (!betreff) return NextResponse.json({ error: "Betreff darf nicht leer sein" }, { status: 400 });
    updateData.betreff = betreff;
  }

  if (body.beschreibung !== undefined) {
    const beschreibung = typeof body.beschreibung === "string" ? body.beschreibung.trim() : "";
    if (!beschreibung) return NextResponse.json({ error: "Beschreibung darf nicht leer sein" }, { status: 400 });
    updateData.beschreibung = beschreibung;
  }

  if (body.kategorie !== undefined) {
    if (typeof body.kategorie !== "string" || !GUELTIGE_KATEGORIEN.includes(body.kategorie)) {
      return NextResponse.json({ error: "Ungültige Kategorie" }, { status: 400 });
    }
    updateData.kategorie = body.kategorie;
  }

  if (body.prioritaet !== undefined) {
    if (typeof body.prioritaet !== "string" || !GUELTIGE_PRIORITAETEN.includes(body.prioritaet)) {
      return NextResponse.json({ error: "Ungültige Priorität" }, { status: 400 });
    }
    updateData.prioritaet = body.prioritaet;
  }

  if (body.status !== undefined) {
    if (typeof body.status !== "string" || !GUELTIGE_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }
    updateData.status = body.status;
    // Wenn Status auf GELOEST gesetzt wird und geloestAm noch nicht gesetzt, automatisch setzen
    if (body.status === "GELOEST" && body.geloestAm === undefined) {
      updateData.geloestAm = new Date();
    }
  }

  if (body.zugewiesen !== undefined) {
    updateData.zugewiesen = typeof body.zugewiesen === "string" && body.zugewiesen.trim()
      ? body.zugewiesen.trim()
      : null;
  }

  if (body.loesung !== undefined) {
    updateData.loesung = typeof body.loesung === "string" && body.loesung.trim()
      ? body.loesung.trim()
      : null;
  }

  try {
    const reklamation = await prisma.reklamation.update({
      where: { id: numId },
      data: updateData,
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        lieferung: { select: { id: true, datum: true, rechnungNr: true } },
      },
    });
    return NextResponse.json(reklamation);
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    console.error("Reklamation PUT error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const numId = parseInt(id, 10);
  if (isNaN(numId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const reklamation = await prisma.reklamation.findUnique({
      where: { id: numId },
      select: { status: true },
    });
    if (!reklamation) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    if (reklamation.status !== "OFFEN") {
      return NextResponse.json(
        { error: "Nur offene Reklamationen können gelöscht werden" },
        { status: 400 },
      );
    }

    await prisma.reklamation.delete({ where: { id: numId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if ((err as { code?: string }).code === "P2025") {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    console.error("Reklamation DELETE error:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
