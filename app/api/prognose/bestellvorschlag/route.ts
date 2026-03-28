import { NextRequest, NextResponse } from "next/server";

// Bestellvorschlag: gruppiert nach Lieferant
export async function GET(req: NextRequest) {
  const base = new URL(req.url);
  const progUrl = new URL("/api/prognose", base.origin);
  base.searchParams.forEach((v, k) => progUrl.searchParams.set(k, v));

  const res = await fetch(progUrl.toString());
  const prognosen: {
    bestellvorschlag: boolean;
    bestellmenge: number;
    bevorzugterLieferant: {
      lieferantId: number;
      name: string;
      einkaufspreis: number;
      mindestbestellmenge: number;
    } | null;
    artikelId: number;
    artikelName: string;
    artikelnummer: string;
    einheit: string;
  }[] = await res.json();

  const zuBestellen = prognosen.filter((p) => p.bestellvorschlag && p.bestellmenge > 0);

  // Gruppieren nach Lieferant
  const nachLieferant: Record<
    string,
    {
      lieferantId: number;
      lieferantName: string;
      positionen: typeof zuBestellen;
      gesamtEinkaufswert: number;
    }
  > = {};

  for (const p of zuBestellen) {
    const key = p.bevorzugterLieferant
      ? String(p.bevorzugterLieferant.lieferantId)
      : "unbekannt";
    const name = p.bevorzugterLieferant?.name ?? "Kein Lieferant";

    if (!nachLieferant[key]) {
      nachLieferant[key] = {
        lieferantId: p.bevorzugterLieferant?.lieferantId ?? 0,
        lieferantName: name,
        positionen: [],
        gesamtEinkaufswert: 0,
      };
    }

    // Mindestbestellmenge berücksichtigen
    const min = p.bevorzugterLieferant?.mindestbestellmenge ?? 0;
    const bestellmenge = Math.max(p.bestellmenge, min);

    nachLieferant[key].positionen.push({ ...p, bestellmenge });
    nachLieferant[key].gesamtEinkaufswert +=
      bestellmenge * (p.bevorzugterLieferant?.einkaufspreis ?? 0);
  }

  return NextResponse.json(Object.values(nachLieferant));
}
