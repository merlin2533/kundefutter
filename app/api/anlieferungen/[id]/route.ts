import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const anlieferung = await prisma.anlieferung.findUnique({
      where: { id },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        artikel: { select: { id: true, name: true, einheit: true } },
        gutschrift: { select: { id: true, nummer: true, status: true } },
      },
    });
    if (!anlieferung) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    return NextResponse.json(anlieferung);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const body = await req.json();
    const { datum, menge, einheit, feuchte, qualitaet, preisProEinheit, notiz } = body;

    // preisProEinheit/gesamtBetrag nur anfassen, wenn preisProEinheit im Body tatsächlich
    // enthalten ist — sonst würde z.B. ein reiner Notiz-Edit den im gradierten Modus (Stage 3,
    // Erzeugerabrechnung aus Sortierergebnis) berechneten gesamtBetrag stillschweigend auf null
    // zurücksetzen, obwohl dieses Feld dort nicht aus preisProEinheit×menge stammt.
    const preisImBody = Object.prototype.hasOwnProperty.call(body, "preisProEinheit");
    const gesamtBetragUpdate = preisImBody
      ? {
          gesamtBetrag:
            preisProEinheit != null && menge != null
              ? Math.round(parseFloat(String(preisProEinheit)) * parseFloat(String(menge)) * 100) / 100
              : null,
        }
      : {};

    const updated = await prisma.anlieferung.update({
      where: { id },
      data: {
        ...(datum ? { datum: new Date(datum) } : {}),
        ...(menge != null ? { menge: parseFloat(String(menge)) } : {}),
        ...(einheit ? { einheit } : {}),
        feuchte: feuchte != null ? parseFloat(String(feuchte)) : null,
        qualitaet: qualitaet ?? null,
        ...(preisImBody ? { preisProEinheit: preisProEinheit != null ? parseFloat(String(preisProEinheit)) : null } : {}),
        ...gesamtBetragUpdate,
        notiz: notiz ?? null,
      },
      include: {
        kunde: { select: { id: true, name: true, firma: true } },
        artikel: { select: { id: true, name: true, einheit: true } },
        gutschrift: { select: { id: true, nummer: true, status: true } },
      },
    });
    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    if (err instanceof Error && err.message.includes("P2025")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "erzeugerabrechnung");
  if (denyModul) return denyModul;

  const { id: idStr } = await ctx.params;
  const id = parseInt(idStr, 10);
  if (isNaN(id)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    // EierSortierung.anlieferungId ist ON DELETE SET NULL (kein FK-Restrict) — ein Löschen
    // würde die Herkunfts-Verknüpfung sonst still auf null setzen, ohne Warnung. Explizit
    // vorher prüfen und blocken statt sich auf einen (hier gar nicht greifenden) P2003-Fehler
    // zu verlassen.
    const verknuepfteSortierungen = await prisma.eierSortierung.count({ where: { anlieferungId: id } });
    if (verknuepfteSortierungen > 0) {
      return NextResponse.json(
        {
          error: `Diese Anlieferung ist mit ${verknuepfteSortierungen} Ei-Sortierung(en) verknüpft und kann nicht gelöscht werden — bitte zuerst die Sortierung(en) löschen oder umhängen.`,
        },
        { status: 409 },
      );
    }

    // Eine verknüpfte, noch nicht verbuchte Erzeuger-Gutschrift (Status OFFEN) hängt sonst mit
    // totem anlieferungId-losem Notiztext in der Luft — Löschen erst nach Entfernen/Verbuchen der
    // Gutschrift erlauben (analog zum Sortierung-Check oben). Eine bereits VERBUCHTE/STORNIERTE/
    // ERSTATTETE Gutschrift blockt nicht (die Anlieferung selbst wird dafür nicht mehr gebraucht).
    const anlieferungMitGutschrift = await prisma.anlieferung.findUnique({
      where: { id },
      select: { gutschrift: { select: { status: true } } },
    });
    if (anlieferungMitGutschrift?.gutschrift?.status === "OFFEN") {
      return NextResponse.json(
        {
          error: "Diese Anlieferung hat eine noch offene Erzeuger-Gutschrift — bitte diese zuerst entfernen oder verbuchen.",
        },
        { status: 409 },
      );
    }

    await prisma.anlieferung.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    if (err instanceof Error && err.message.includes("P2025")) {
      return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });
    }
    return NextResponse.json(
      { error: isDev && err instanceof Error ? err.message : "Interner Fehler" },
      { status: 500 }
    );
  }
}
