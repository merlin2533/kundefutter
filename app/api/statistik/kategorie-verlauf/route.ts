import { NextRequest, NextResponse } from "next/server";
import { ladeKategorieVerlauf } from "@/lib/kategorie-verlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/kategorie-verlauf?kategorie=Saatgut&unterkategorie=Getreide&von=2024-01-01&bis=2026-08-28&kundeSuche=
// Zeigt je Kunde, welche Artikel einer Kategorie/Unterkategorie im Zeitraum geliefert wurden
// oder bereits bestellt (aber noch nicht geliefert) sind — Fruchtfolge-Nachvollziehbarkeit:
// welcher Kunde hatte/bestellte welche Zwischenfrucht/welches Getreide.
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { kunden, jahre, von, bis } = await ladeKategorieVerlauf({
      kategorie: searchParams.get("kategorie"),
      unterkategorie: searchParams.get("unterkategorie"),
      von: searchParams.get("von"),
      bis: searchParams.get("bis"),
      kundeSuche: searchParams.get("kundeSuche"),
    });
    return NextResponse.json({ kunden, jahre, von, bis });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Statistik/Kategorie-Verlauf API Fehler:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
