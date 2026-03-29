/**
 * MATIF/Euronext Futures Preise via Yahoo Finance
 *
 * Symbole (Euronext Paris .PA):
 *   EBM.PA — Blé Meunier (Milling Wheat), EUR/t
 *   ERO.PA — Colza (Rapeseed), EUR/t
 *   EMA.PA — Maïs (Corn), EUR/t
 */

export interface TagespreisPunkt {
  datum: string;  // "2026-03-29"
  preis: number;  // EUR/t
}

export interface MatifProdukt {
  symbol: string;
  produktCode: string;   // "WEIZEN" | "RAPS" | "MAIS"
  produktName: string;
  preis: number;         // aktuellster Schlusskurs in EUR/t
  vorwoche: number | null;
  veraenderung: number | null;  // EUR/t Differenz
  datum: string;                 // letzter Handelstag
  verlauf: TagespreisPunkt[];    // letzte ≤20 Handelstage
  prognose1W: number | null;     // linearer Forecast +5 Handelstage
}

const MATIF_PRODUKTE = [
  { symbol: "EBM.PA", code: "WEIZEN", name: "Weizen (MATIF)" },
  { symbol: "ERO.PA", code: "RAPS",   name: "Raps (MATIF)"   },
  { symbol: "EMA.PA", code: "MAIS",   name: "Mais (MATIF)"   },
];

/** Lineare Regression → Forecast für +horizont Handelstage */
export function linearForecast(
  verlauf: TagespreisPunkt[],
  horizont = 5
): number | null {
  if (verlauf.length < 3) return null;
  const data = verlauf.slice(-15);
  const n = data.length;
  const xs = data.map((_, i) => i);
  const ys = data.map((d) => d.preis);

  const sumX  = xs.reduce((a, b) => a + b, 0);
  const sumY  = ys.reduce((a, b) => a + b, 0);
  const sumXY = xs.reduce((a, x, i) => a + x * ys[i], 0);
  const sumX2 = xs.reduce((a, x) => a + x * x, 0);

  const denom = n * sumX2 - sumX * sumX;
  if (denom === 0) return null;

  const slope     = (n * sumXY - sumX * sumY) / denom;
  const intercept = (sumY - slope * sumX) / n;

  return Math.round((intercept + slope * (n - 1 + horizont)) * 10) / 10;
}

/** Ruft Yahoo Finance ab und gibt MATIF-Futures zurück */
export async function fetchMatifPreise(): Promise<MatifProdukt[]> {
  const results: MatifProdukt[] = [];

  for (const prod of MATIF_PRODUKTE) {
    try {
      const url =
        `https://query1.finance.yahoo.com/v8/finance/chart/` +
        `${encodeURIComponent(prod.symbol)}?interval=1d&range=1mo`;

      const res = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 " +
            "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "application/json",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!res.ok) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result?.timestamp?.length) continue;

      const closes: (number | null)[] =
        result.indicators?.quote?.[0]?.close ?? [];

      const verlauf: TagespreisPunkt[] = [];
      for (let i = 0; i < result.timestamp.length; i++) {
        const c = closes[i];
        if (c != null && c > 0) {
          verlauf.push({
            datum: new Date(result.timestamp[i] * 1000)
              .toISOString()
              .slice(0, 10),
            preis: Math.round(c * 10) / 10,
          });
        }
      }

      if (verlauf.length === 0) continue;

      const aktuell = verlauf[verlauf.length - 1];
      // "Vorwoche" = ~5 Handelstage zurück
      const vwIdx    = Math.max(0, verlauf.length - 6);
      const vorwoche = verlauf.length >= 2 ? verlauf[vwIdx] : null;

      results.push({
        symbol:      prod.symbol,
        produktCode: prod.code,
        produktName: prod.name,
        preis:       aktuell.preis,
        vorwoche:    vorwoche?.preis ?? null,
        veraenderung:
          vorwoche != null
            ? Math.round((aktuell.preis - vorwoche.preis) * 10) / 10
            : null,
        datum:       aktuell.datum,
        verlauf:     verlauf.slice(-20),
        prognose1W:  linearForecast(verlauf),
      });
    } catch {
      // Symbol nicht verfügbar – überspringen
    }
  }

  return results;
}
