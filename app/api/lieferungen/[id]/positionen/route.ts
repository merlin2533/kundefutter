import { liefposArtikelSelect } from "@/lib/artikel-select";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getArtikelPreisFuerJahr } from "@/lib/jahrespreis";
import { resolveBevorzugtenEK, istLagerrelevant } from "@/lib/utils";
import { istChargeNrPflichtFuerLieferschein } from "@/lib/lieferung";
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
      select: { status: true, datum: true, rechnungVersendetAm: true, rechnungStorniert: true, istStreckengeschaeft: true },
    });
    if (!lieferung) return NextResponse.json({ error: "Lieferung nicht gefunden" }, { status: 404 });
    if (lieferung.status === "storniert") {
      return NextResponse.json({ error: "Positionen können bei stornierten Lieferungen nicht bearbeitet werden" }, { status: 400 });
    }
    // Ein Rechnungs-Storno setzt NICHT lieferung.status auf "storniert" (das bleibt
    // "geliefert"), sondern nur rechnungStorniert — separat prüfen, sonst ließen sich einer
    // stornierten Rechnung nachträglich noch Positionen hinzufügen.
    if (lieferung.rechnungStorniert) {
      return NextResponse.json({ error: "Diese Rechnung ist storniert — Positionen können nicht mehr ergänzt werden" }, { status: 400 });
    }
    // Steuerrechtlich unzulässig: eine bereits versendete Rechnung (E-Mail ODER manuell "Als per
    // Post versendet markieren") darf sich nachträglich nicht mehr verändern (auch nicht durch
    // neue Positionen). Solange die Rechnung noch nicht versendet ist, dürfen aber auch nach
    // Rechnungsstellung (Status bereits "geliefert") weiterhin Positionen ergänzt werden — siehe
    // unten für die dabei nötige Lagerausgangsbuchung, da diese sonst (anders als bei "geplant")
    // nicht mehr automatisch nachgeholt wird.
    if (lieferung.rechnungVersendetAm) {
      return NextResponse.json({ error: "Diese Rechnung wurde bereits versendet und darf nicht mehr geändert werden." }, { status: 400 });
    }

    const artikel = await prisma.artikel.findUnique({
      where: { id: artikelId },
      select: { name: true, kategorie: true, standardpreis: true, notiz: true, mwstSatz: true, aktuellerBestand: true, lieferanten: { select: { einkaufspreis: true, bevorzugt: true } } },
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
    const chargeNrTrim = typeof chargeNr === "string" ? chargeNr.trim() || null : null;

    // War die Lieferung beim Hinzufügen dieser Position bereits "geliefert" (d.h. eine
    // Rechnung existiert schon, ist aber noch nicht versendet), wurde der Lagerausgang für
    // die übrigen Positionen bereits gebucht (markiereLieferungGeliefertFallsGeplant()) —
    // das läuft für eine jetzt neu hinzugefügte Position nicht automatisch nach, muss also
    // hier direkt mit erledigt werden, sonst bliebe der Bestand für diese Position unbebucht.
    const bereitsGeliefert = lieferung.status === "geliefert";
    if (bereitsGeliefert && istChargeNrPflichtFuerLieferschein(artikel.kategorie, lieferung.datum ?? new Date()) && !chargeNrTrim) {
      return NextResponse.json({ error: `Chargennummer ist bei Tierfutter-Positionen ab 2027 Pflicht (Artikel „${artikel.name}“)` }, { status: 400 });
    }

    const pos = await prisma.$transaction(async (tx) => {
      const neuePos = await tx.lieferposition.create({
        data: {
          lieferungId,
          artikelId,
          menge: mengeNum,
          verkaufspreis: vk,
          einkaufspreis: ek,
          // Eingefroren bei Erstellung (analog verkaufspreis) — siehe Lieferposition.mwstSatz
          mwstSatz: artikel.mwstSatz,
          chargeNr: chargeNrTrim,
          notiz: posNotiz,
          preisInterpoliert: interpoliert,
          preisQuelleJahr: quelleJahr,
        },
        include: { artikel: { select: liefposArtikelSelect } },
      });

      if (bereitsGeliefert && !lieferung.istStreckengeschaeft && istLagerrelevant(artikel.kategorie)) {
        const neuerBestand = artikel.aktuellerBestand - mengeNum;
        await tx.artikel.update({ where: { id: artikelId }, data: { aktuellerBestand: neuerBestand } });
        await tx.lagerbewegung.create({
          data: { artikelId, typ: "ausgang", menge: -mengeNum, bestandNach: neuerBestand, lieferungId },
        });
        await tx.lieferposition.update({ where: { id: neuePos.id }, data: { lagerBereitsGebucht: true } });
        neuePos.lagerBereitsGebucht = true;
      }

      return neuePos;
    });
    return NextResponse.json(pos, { status: 201 });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
