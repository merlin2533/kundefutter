import { NextRequest, NextResponse } from "next/server";
import { ladeKategorieVerlauf } from "@/lib/kategorie-verlauf";
import { Sentry } from "@/lib/sentry";
export const dynamic = "force-dynamic";

// GET /api/statistik/kategorie-verlauf?kategorie=Saatgut&unterkategorie=Getreide&jahrVon=2023&jahrBis=2026&kundeSuche=
// Zeigt je Kunde, welche Artikel einer Kategorie/Unterkategorie in welchem Jahr geliefert wurden
// (Fruchtfolge-Nachvollziehbarkeit: welcher Kunde hatte welche Zwischenfrucht/welches Getreide).
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const { kunden, jahre } = await ladeKategorieVerlauf({
      kategorie: searchParams.get("kategorie"),
      unterkategorie: searchParams.get("unterkategorie"),
      jahrVon: parseInt(searchParams.get("jahrVon") ?? "", 10),
      jahrBis: parseInt(searchParams.get("jahrBis") ?? "", 10),
      kundeSuche: searchParams.get("kundeSuche"),
    });
    return NextResponse.json({ kunden, jahre });
  } catch (err) {
    Sentry.captureException(err);
    console.error("Statistik/Kategorie-Verlauf API Fehler:", err);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
