import { NextRequest, NextResponse } from "next/server";
import { addTage } from "@/lib/utils";
import { ermittleFaelligeBedarfe, erstelleWiederkehrendeLieferungen } from "@/lib/wiederkehrende-lieferungen";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";


// GET: Zeigt fällige wiederkehrende Lieferungen (nächste X Tage)
// ?tage=30  – Vorschau für die nächsten N Tage (default 30)
// ?nurFaellig=1 – nur überfällige (naechstesDatum <= heute)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tage = Number(searchParams.get("tage") ?? "30");
  const nurFaellig = searchParams.get("nurFaellig") === "1";
  const bis = nurFaellig ? new Date() : addTage(new Date(), tage);

  let faellig;
  try {
    faellig = await ermittleFaelligeBedarfe(bis);
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }

  faellig.sort((a, b) => a.naechstesDatum.getTime() - b.naechstesDatum.getTime());
  return NextResponse.json(faellig);
}

// POST: Legt aus Bedarfen automatisch geplante Lieferungen an
// Body: { bedarfIds: number[] }           – bestimmte Bedarfe anlegen
//       { alleAusloesen: true }           – alle fälligen Bedarfe anlegen
//       { ids: number[] }                 – Alias für bedarfIds
export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  let bedarfIds: number[] = body.bedarfIds ?? body.ids ?? [];

  try {
    if (body.alleAusloesen) {
      const faellig = await ermittleFaelligeBedarfe(new Date());
      bedarfIds = faellig.filter((f) => f.ueberfaellig).map((f) => f.bedarf.id);
    }

    if (bedarfIds.length === 0) {
      return NextResponse.json({ ausgeloest: 0, lieferungen: [] });
    }

    const angelegtIds = await erstelleWiederkehrendeLieferungen(bedarfIds);

    return NextResponse.json(
      { ausgeloest: angelegtIds.length, lieferungen: angelegtIds },
      { status: 201 }
    );
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}

