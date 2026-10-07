import { NextRequest, NextResponse } from "next/server";
import { ladeKategorieVerlauf } from "@/lib/kategorie-verlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/kategorie-verlauf?kategorie=Saatgut&unterkategorie=Getreide&unterkategorie=Zwischenfruchtmischung&von=2024-01-01&bis=2026-08-28&kundeSuche=&lieferantId=
// Zeigt je Kunde, welche Artikel einer Kategorie/Unterkategorie(n) im Zeitraum geliefert wurden
// oder bereits bestellt (aber noch nicht geliefert) sind — Fruchtfolge-Nachvollziehbarkeit:
// welcher Kunde hatte/bestellte welche Zwischenfrucht/welches Getreide. `unterkategorie` kann
// mehrfach als Query-Parameter angegeben werden (Mehrfachauswahl, ODER-verknüpft); ohne den
// Parameter werden alle Unterkategorien der gewählten Kategorie berücksichtigt. `lieferantId`
// filtert zusätzlich auf Artikel, deren aktuell bevorzugter Lieferant diesem entspricht.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const lieferantIdParam = searchParams.get("lieferantId");
    const lieferantId = lieferantIdParam ? parseInt(lieferantIdParam, 10) : null;
    const { kunden, jahre, von, bis, artikelUebersicht, gesamtProEinheit, lieferantUebersicht } = await ladeKategorieVerlauf({
      kategorie: searchParams.get("kategorie"),
      unterkategorien: searchParams.getAll("unterkategorie"),
      von: searchParams.get("von"),
      bis: searchParams.get("bis"),
      kundeSuche: searchParams.get("kundeSuche"),
      lieferantId: lieferantId !== null && !isNaN(lieferantId) ? lieferantId : null,
    });
    return NextResponse.json({ kunden, jahre, von, bis, artikelUebersicht, gesamtProEinheit, lieferantUebersicht });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Statistik/Kategorie-Verlauf API Fehler:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
