import { liefposArtikelSelect } from "@/lib/artikel-select";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtikelPreisFuerJahr } from "@/lib/jahrespreis";
import { resolveBevorzugtenEK } from "@/lib/utils";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


type Params = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const lieferungId = parseInt(id, 10);
  if (isNaN(lieferungId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { artikelId, menge, verkaufspreis, einkaufspreis, chargeNr, notiz, preisInterpoliert, preisQuelleJahr } = body;

  if (!artikelId || typeof artikelId !== "number") {
    return NextResponse.json({ error: "artikelId fehlt" }, { status: 400 });
  }
  const mengeNum = Number(menge);
  if (isNaN(mengeNum) || mengeNum <= 0) {
    return NextResponse.json({ error: "Menge ungültig" }, { status: 400 });
  }

  try {
    const lieferung = await prisma.lieferung.findUnique({
      where: { id: lieferungId },
      select: { status: true, datum: true, rechnungVersendetAm: true },
    });
    if (!lieferung) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    if (lieferung.status !== "geplant") {
      return NextResponse.json({ error: "Positionen können nur bei geplanten Lieferungen bearbeitet werden" }, { status: 400 });
    }
    // Steuerrechtlich unzulässig: eine bereits per E-Mail versendete Rechnung darf sich
    // nachträglich nicht mehr verändern (auch nicht durch neue Positionen).
    if (lieferung.rechnungVersendetAm) {
      return NextResponse.json({ error: "Diese Rechnung wurde bereits per E-Mail versendet und darf nicht mehr geändert werden." }, { status: 400 });
    }

    const artikel = await prisma.artikel.findUnique({
      where: { id: artikelId },
      select: { standardpreis: true, notiz: true, mwstSatz: true, lieferanten: { select: { einkaufspreis: true, bevorzugt: true } } },
    });
    if (!artikel) return NextResponse.json({ error: "Artikel nicht gefunden" }, { status: 404 });

    // Wurde kein Preis übergeben (z.B. programmatischer Aufruf ohne Frontend-Vorauflösung),
    // wird der Preis für das Jahr der Lieferung aufgelöst — inkl. Interpolationsmarkierung
    // für Lieferschein/Rechnung, falls kein Jahrespreis fürs Lieferjahr erfasst ist.
    let vk: number;
    let interpoliert = false;
    let quelleJahr: number | null = null;
    if (verkaufspreis !== undefined) {
      vk = Number(verkaufspreis);
      interpoliert = Boolean(preisInterpoliert);
      quelleJahr = typeof preisQuelleJahr === "number" ? preisQuelleJahr : null;
    } else {
      const lieferJahr = (lieferung.datum ?? new Date()).getFullYear();
      const aufgeloest = await getArtikelPreisFuerJahr(artikelId, lieferJahr);
      vk = aufgeloest.preis;
      interpoliert = aufgeloest.interpoliert;
      quelleJahr = aufgeloest.quelleJahr;
    }
    const ek = einkaufspreis !== undefined ? Number(einkaufspreis) : resolveBevorzugtenEK(artikel.lieferanten);
    // Artikel-Notiz durchschleifen, falls keine positionsspezifische Notiz übergeben wurde
    const posNotiz = typeof notiz === "string" && notiz.trim() ? notiz.trim() : (artikel.notiz ?? null);

    const pos = await prisma.lieferposition.create({
      data: {
        lieferungId,
        artikelId,
        menge: mengeNum,
        verkaufspreis: vk,
        einkaufspreis: ek,
        // Eingefroren bei Erstellung (analog verkaufspreis) — siehe Lieferposition.mwstSatz
        mwstSatz: artikel.mwstSatz,
        chargeNr: chargeNr ?? null,
        notiz: posNotiz,
        preisInterpoliert: interpoliert,
        preisQuelleJahr: quelleJahr,
      },
      include: { artikel: { select: liefposArtikelSelect } },
    });
    return NextResponse.json(pos, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
