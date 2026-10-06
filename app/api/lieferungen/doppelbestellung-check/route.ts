import { NextRequest, NextResponse } from "next/server";
import { pruefeDoppelbestellung } from "@/lib/doppelbestellung";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/lieferungen/doppelbestellung-check?kundeId=123&artikelId=456[&ausgenommenLieferungId=789]
// Liefert die jüngste Lieferposition desselben Kunden+Artikels innerhalb des konfigurierten
// Warnzeitraums (Einstellung "firma.doppelbestellungWarnungWochen", Standard 10 Wochen) — reine
// Lesevorschau für die Doppelbestellungs-Warnung in /lieferungen/neu, kein Lagerzugriff.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const kundeId = parseInt(searchParams.get("kundeId") ?? "", 10);
    const artikelId = parseInt(searchParams.get("artikelId") ?? "", 10);
    const ausgenommenParam = searchParams.get("ausgenommenLieferungId");
    const ausgenommenLieferungId = ausgenommenParam ? parseInt(ausgenommenParam, 10) : undefined;
    if (isNaN(kundeId) || isNaN(artikelId)) {
      return NextResponse.json({ error: "kundeId und artikelId erforderlich" }, { status: 400 });
    }
    const treffer = await pruefeDoppelbestellung(
      kundeId,
      artikelId,
      ausgenommenLieferungId !== undefined && !isNaN(ausgenommenLieferungId) ? ausgenommenLieferungId : undefined
    );
    return NextResponse.json({ treffer });
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
