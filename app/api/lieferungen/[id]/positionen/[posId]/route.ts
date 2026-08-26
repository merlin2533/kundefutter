import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { istLagerrelevant } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Ctx = { params: Promise<{ id: string; posId: string }> };

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const { id, posId } = await ctx.params;
  const lieferungId = parseInt(id, 10);
  const positionId = parseInt(posId, 10);
  if (isNaN(lieferungId) || isNaN(positionId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }
  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      select: { status: true, rechnungVersendetAm: true, rechnungStorniert: true, istStreckengeschaeft: true },
    });
    if (!lieferung) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    if (lieferung.status === "storniert") {
      return NextResponse.json({ error: "Positionen können bei stornierten Lieferungen nicht gelöscht werden" }, { status: 400 });
    }
    // Ein Rechnungs-Storno setzt NICHT lieferung.status auf "storniert" — separat prüfen
    // (analog zur Sperre beim Hinzufügen neuer Positionen).
    if (lieferung.rechnungStorniert) {
      return NextResponse.json({ error: "Diese Rechnung ist storniert — Positionen können nicht mehr gelöscht werden" }, { status: 400 });
    }
    // Steuerrechtlich unzulässig: eine bereits versendete Rechnung (E-Mail ODER Post) darf sich
    // nachträglich nicht mehr verändern. Solange die Rechnung noch nicht versendet ist,
    // darf aber auch nach Rechnungsstellung (Status bereits "geliefert") weiterhin eine
    // versehentlich falsch erfasste Position gelöscht werden — ein ggf. dafür bereits
    // gebuchter Lagerausgang wird dabei zurückgebucht (siehe unten), analog zur
    // Storno-Rückbuchung beim Statuswechsel geliefert→storniert.
    if (lieferung.rechnungVersendetAm) {
      return NextResponse.json({ error: "Diese Rechnung wurde bereits versendet und darf nicht mehr geändert werden." }, { status: 400 });
    }
    const pos = await prisma.lieferposition.findUnique({
      where: { id: positionId },
      select: { lieferungId: true, artikelId: true, menge: true, lagerBereitsGebucht: true },
    });
    if (!pos || pos.lieferungId !== lieferungId) {
      return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (pos.lagerBereitsGebucht && !lieferung.istStreckengeschaeft) {
        const artikel = await tx.artikel.findUnique({ where: { id: pos.artikelId } });
        if (artikel && istLagerrelevant(artikel.kategorie)) {
          const neuerBestand = artikel.aktuellerBestand + pos.menge;
          await tx.artikel.update({ where: { id: pos.artikelId }, data: { aktuellerBestand: neuerBestand } });
          await tx.lagerbewegung.create({
            data: {
              artikelId: pos.artikelId,
              typ: "eingang",
              menge: pos.menge,
              bestandNach: neuerBestand,
              lieferungId,
              notiz: "Position nachträglich gelöscht — Lagerausgang zurückgebucht",
            },
          });
        }
      }
      await tx.lieferposition.delete({ where: { id: positionId } });
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const { id, posId } = await ctx.params;
  const lieferungId = parseInt(id, 10);
  const positionId = parseInt(posId, 10);
  if (isNaN(lieferungId) || isNaN(positionId)) {
    return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });
  }

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  // Nur ausgewählte Felder zulassen
  const updateData: { rabattProzent?: number; verkaufspreis?: number; einkaufspreis?: number; menge?: number; notiz?: string | null; chargeNr?: string | null; preisInterpoliert?: boolean; preisQuelleJahr?: number | null } = {};
  if (body.rabattProzent !== undefined) {
    const r = Number(body.rabattProzent);
    if (isNaN(r) || r < 0 || r > 100) {
      return NextResponse.json({ error: "Rabatt muss zwischen 0 und 100 liegen" }, { status: 400 });
    }
    updateData.rabattProzent = r;
  }
  if (body.verkaufspreis !== undefined) {
    const v = Number(body.verkaufspreis);
    if (isNaN(v) || v < 0) {
      return NextResponse.json({ error: "Verkaufspreis ungültig" }, { status: 400 });
    }
    updateData.verkaufspreis = v;
    // Beim Preiswechsel Interpolations-Markierung mitgeben (Frontend löst Jahrespreis vorab auf)
    // bzw. zurücksetzen, wenn kein Hinweis übergeben wurde.
    updateData.preisInterpoliert = Boolean(body.preisInterpoliert);
    updateData.preisQuelleJahr = typeof body.preisQuelleJahr === "number" ? body.preisQuelleJahr : null;
  }
  if (body.einkaufspreis !== undefined) {
    const e = Number(body.einkaufspreis);
    if (isNaN(e) || e < 0) {
      return NextResponse.json({ error: "Einkaufspreis ungültig" }, { status: 400 });
    }
    updateData.einkaufspreis = e;
  }
  if (body.menge !== undefined) {
    const m = Number(body.menge);
    if (isNaN(m) || m <= 0) {
      return NextResponse.json({ error: "Menge muss größer als 0 sein" }, { status: 400 });
    }
    updateData.menge = m;
  }
  if (body.notiz !== undefined) {
    updateData.notiz = typeof body.notiz === "string" ? body.notiz.trim() || null : null;
  }
  // Chargennummer: reine Dokumentation/Rückverfolgung – auch nachträglich (nach Lieferung/Rechnung) erfassbar
  if (body.chargeNr !== undefined) {
    updateData.chargeNr = typeof body.chargeNr === "string" ? body.chargeNr.trim() || null : null;
  }
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Keine Felder zum Aktualisieren" }, { status: 400 });
  }

  try {
    const pos = await prisma.lieferposition.findUnique({
      where: { id: positionId },
      select: { lieferungId: true, lieferung: { select: { rechnungNr: true, rechnungVersendetAm: true } } },
    });
    if (!pos || pos.lieferungId !== lieferungId) {
      return NextResponse.json({ error: "Position nicht gefunden" }, { status: 404 });
    }
    // Steuerrechtlich unzulässig: die auf einer bereits versendeten Rechnung (E-Mail ODER Post)
    // ausgewiesenen Beträge dürfen sich nachträglich nicht mehr verändern. chargeNr/notiz
    // bleiben davon bewusst ausgenommen (reine Dokumentation/Rückverfolgung, siehe Kommentar
    // weiter unten — Charge ist oft erst nach Rechnungsstellung bekannt).
    const betragsrelevant = updateData.verkaufspreis !== undefined || updateData.einkaufspreis !== undefined
      || updateData.menge !== undefined || updateData.rabattProzent !== undefined;
    if (betragsrelevant && pos.lieferung.rechnungVersendetAm) {
      return NextResponse.json({ error: "Diese Rechnung wurde bereits versendet — Menge, Preis und Rabatt dürfen nicht mehr geändert werden." }, { status: 400 });
    }
    const updated = await prisma.lieferposition.update({
      where: { id: positionId },
      data: updateData,
    });
    return NextResponse.json(updated);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
