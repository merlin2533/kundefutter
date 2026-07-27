import { NextRequest, NextResponse } from "next/server";
import { log } from "@/lib/logger";
export const dynamic = "force-dynamic";

// Bestellvorschlag: gruppiert nach Lieferant
export async function GET(req: NextRequest) {
  try {
    const base = new URL(req.url);
    const progUrl = new URL("/api/prognose", base.origin);
    base.searchParams.forEach((v, k) => progUrl.searchParams.set(k, v));

    // Cookies durchreichen — /api/prognose liegt hinter der Session-Middleware.
    const res = await fetch(progUrl.toString(), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });
    // Ohne diese Prüfung würde ein Fehler der Upstream-Route hier zum
    // JSON-Parse-Crash mit unbrauchbarer Meldung.
    if (!res.ok) {
      log.error(
        `Prognose-Upstream antwortete mit HTTP ${res.status}`,
        undefined,
        {
          status: res.status,
          url: progUrl.pathname,
        },
      );
      return NextResponse.json(
        { error: "Prognosedaten konnten nicht geladen werden" },
        { status: 502 },
      );
    }
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

    const zuBestellen = prognosen.filter(
      (p) => p.bestellvorschlag && p.bestellmenge > 0,
    );

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
  } catch (err) {
    log.error("Bestellvorschlag konnte nicht erstellt werden", err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
