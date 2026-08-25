import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { liefposArtikelSelect } from "@/lib/artikel-select";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  try {
    const gutschrift = await prisma.gutschrift.findUnique({
      where: { id: Number(id) },
      include: {
        kunde: true,
        lieferung: {
          include: { positionen: { include: { artikel: { select: liefposArtikelSelect } } } },
        },
        verbuchtBeiLieferung: { select: { id: true, rechnungNr: true } },
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });
    if (!gutschrift) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(gutschrift);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  const { id } = await params;
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  try {
    const existing = await prisma.gutschrift.findUnique({
      where: { id: Number(id) },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    if (existing.status !== "OFFEN") {
      return NextResponse.json(
        { error: "Nur Gutschriften mit Status OFFEN können bearbeitet werden" },
        { status: 400 }
      );
    }

    const ERLAUBTE_STATUS = ["OFFEN", "VERBUCHT", "STORNIERT"];
    if (body.status && !ERLAUBTE_STATUS.includes(body.status)) {
      return NextResponse.json({ error: "Ungültiger Status" }, { status: 400 });
    }

    const updateData: Record<string, unknown> = {};
    if (body.status !== undefined) updateData.status = body.status;
    if (body.notiz !== undefined) updateData.notiz = body.notiz;
    if (body.grund !== undefined) updateData.grund = body.grund;
    if (body.datum !== undefined) updateData.datum = new Date(body.datum);

    const updated = await prisma.gutschrift.update({
      where: { id: Number(id) },
      data: updateData,
      include: {
        kunde: true,
        lieferung: true,
        positionen: { include: { artikel: { select: liefposArtikelSelect } } },
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Gutschrift error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

// Löscht eine Gutschrift unabhängig vom Status (OFFEN/VERBUCHT/STORNIERT) — anders als
// PUT (nur OFFEN bearbeitbar), da eine versehentlich beim falschen Kunden angelegte
// Gutschrift auch dann noch entfernbar sein muss, wenn sie inzwischen automatisch in
// eine Rechnung verrechnet wurde (injiziereOffeneGutschriften() in lib/lieferung.ts,
// status→VERBUCHT). Macht dabei alle Nebenwirkungen der Gutschrift rückgängig:
//   • VERBUCHT: entfernt die dabei in der Ziel-Lieferung angelegte negative
//     Ausgleichsposition (sonst bliebe der Rechnungsbetrag um die Gutschrift reduziert,
//     obwohl der Datensatz selbst verschwindet)
//   • Rücknahme-Positionen: bucht den bei Erstellung gutgeschriebenen Lagerzugang wieder
//     zurück (sonst bliebe die Ware im Bestand, obwohl die Gutschrift gelöscht wird)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const gutschriftId = Number(id);

  try {
    const existing = await prisma.gutschrift.findUnique({
      where: { id: gutschriftId },
      include: { positionen: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (existing.verbuchtBeiLieferungId) {
        // Eindeutig identifizierbar über die Gutschriftnummer im notiz-Feld — so wurde die
        // Position in injiziereOffeneGutschriften() angelegt, es gibt keine feste FK.
        await tx.lieferposition.deleteMany({
          where: {
            lieferungId: existing.verbuchtBeiLieferungId,
            notiz: { startsWith: `Gutschrift ${existing.nummer}` },
          },
        });
      }

      const ruecknahmePos = existing.positionen.filter((p) => p.ruecknahme);
      if (ruecknahmePos.length > 0) {
        const artikelIds = [...new Set(ruecknahmePos.map((p) => p.artikelId))];
        const artikelList = await tx.artikel.findMany({ where: { id: { in: artikelIds } } });
        const artikelMap = new Map(artikelList.map((a) => [a.id, a]));
        for (const pos of ruecknahmePos) {
          const artikel = artikelMap.get(pos.artikelId);
          if (!artikel) continue;
          const neuerBestand = artikel.aktuellerBestand - pos.menge;
          artikel.aktuellerBestand = neuerBestand;
          await tx.artikel.update({
            where: { id: pos.artikelId },
            data: { aktuellerBestand: neuerBestand },
          });
          await tx.lagerbewegung.create({
            data: {
              artikelId: pos.artikelId,
              typ: "ausgang",
              menge: -pos.menge,
              bestandNach: neuerBestand,
              notiz: `Gutschrift ${existing.nummer} gelöscht – Retoure rückgängig gemacht`,
            },
          });
        }
      }

      // GutschriftPosition hat onDelete: Cascade — wird automatisch mitgelöscht.
      await tx.gutschrift.delete({ where: { id: gutschriftId } });
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Gutschrift error:", err);
    const isDev = process.env.NODE_ENV === "development";
    const message = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
