import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { setAktiverEinkaufspreis } from "@/lib/einkaufspreisverlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; lieferantId: string; preisId: string }> };

async function findeEintrag(artikelId: number, lieferantId: number, preisId: number) {
  const al = await prisma.artikelLieferant.findUnique({
    where: { artikelId_lieferantId: { artikelId, lieferantId } },
    select: { id: true },
  });
  if (!al) return null;
  const eintrag = await prisma.artikelLieferantPreis.findFirst({ where: { id: preisId, artikelLieferantId: al.id } });
  if (!eintrag) return null;
  return { artikelLieferantId: al.id, eintrag };
}

export async function PATCH(req: NextRequest, ctx: Params) {
  const { id, lieferantId, preisId } = await ctx.params;
  const artikelId = parseInt(id, 10);
  const lId = parseInt(lieferantId, 10);
  const pId = parseInt(preisId, 10);
  if (isNaN(artikelId) || isNaN(lId) || isNaN(pId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  try {
    const gefunden = await findeEintrag(artikelId, lId, pId);
    if (!gefunden) return NextResponse.json({ error: "Preiseintrag nicht gefunden" }, { status: 404 });
    const { artikelLieferantId } = gefunden;

    if (body.aktion === "aktivieren") {
      await setAktiverEinkaufspreis(artikelLieferantId, pId);
      const ergebnis = await prisma.artikelLieferantPreis.findUnique({ where: { id: pId } });
      return NextResponse.json(ergebnis);
    }

    const { datum, einkaufspreis, notiz } = body;
    const data: { datum?: Date; einkaufspreis?: number; notiz?: string | null } = {};
    if (datum !== undefined) {
      const geparstesDatum = new Date(String(datum));
      if (isNaN(geparstesDatum.getTime())) return NextResponse.json({ error: "Ungültiges Datum" }, { status: 400 });
      data.datum = geparstesDatum;
    }
    if (einkaufspreis !== undefined) {
      if (typeof einkaufspreis !== "number" || !Number.isFinite(einkaufspreis) || einkaufspreis < 0) {
        return NextResponse.json({ error: "einkaufspreis muss eine Zahl ≥ 0 sein" }, { status: 400 });
      }
      data.einkaufspreis = einkaufspreis;
    }
    if (notiz !== undefined) data.notiz = notiz ?? null;

    const aktualisiert = await prisma.artikelLieferantPreis.update({ where: { id: pId }, data });
    // War dieser Eintrag bereits der aktive, muss der Preis am ArtikelLieferant mitziehen —
    // sonst weicht die Anzeige überall im Rest der App vom gerade bearbeiteten Eintrag ab.
    if (aktualisiert.aktiv && einkaufspreis !== undefined) {
      await prisma.artikelLieferant.update({ where: { id: artikelLieferantId }, data: { einkaufspreis: aktualisiert.einkaufspreis } });
    }
    return NextResponse.json(aktualisiert);
  } catch (err) {
    Sentry.captureException(err);
    console.error("Einkaufspreis-Verlauf PATCH error:", err);
    return NextResponse.json({ error: "Fehler beim Speichern" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: Params) {
  const { id, lieferantId, preisId } = await ctx.params;
  const artikelId = parseInt(id, 10);
  const lId = parseInt(lieferantId, 10);
  const pId = parseInt(preisId, 10);
  if (isNaN(artikelId) || isNaN(lId) || isNaN(pId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  try {
    const gefunden = await findeEintrag(artikelId, lId, pId);
    if (!gefunden) return NextResponse.json({ error: "Preiseintrag nicht gefunden" }, { status: 404 });

    // Bewusst KEIN automatisches Aktivieren eines anderen Eintrags beim Löschen des aktiven
    // Preises — der Auswahl-Mechanismus ist explizit, ArtikelLieferant.einkaufspreis behält
    // einfach seinen zuletzt gesetzten Wert (kein interpolierender Ersatz wie bei Jahrespreisen).
    await prisma.artikelLieferantPreis.delete({ where: { id: pId } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Einkaufspreis-Verlauf DELETE error:", err);
    return NextResponse.json({ error: "Fehler beim Löschen" }, { status: 500 });
  }
}
