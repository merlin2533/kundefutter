/**
 * MATIF/Euronext Futures Preise via Yahoo Finance
 *
 * Symbole (Euronext Paris .PA):
 *   EBM.PA — Blé Meunier (Milling Wheat), EUR/t
 *   ERO.PA — Colza (Rapeseed), EUR/t
 *   EMA.PA — Maïs (Corn), EUR/t
 *
 * Yahoo Finance erfordert seit 2024 ein Crumb-Token + Session-Cookie.
 * Ablauf: fc.yahoo.com → Cookie → getcrumb → Crumb für Chart-API.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

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

// ─── Yahoo Finance Crumb-Authentifizierung ────────────────────────────────────

interface YahooAuth {
  crumb:     string;
  cookie:    string;
  expiresAt: number;
}

// Modul-Level-Cache (persistiert pro Prozess / Docker-Container)
let _auth: YahooAuth | null = null;

async function getYahooAuth(): Promise<YahooAuth | null> {
  if (_auth && _auth.expiresAt > Date.now()) return _auth;

  try {
    // Schritt 1: Session-Cookies über fc.yahoo.com holen
    const fcRes = await fetch("https://fc.yahoo.com/", {
      headers: { "User-Agent": UA, Accept: "*/*" },
      redirect: "follow",
      signal: AbortSignal.timeout(8_000),
    });

    // Alle Set-Cookie-Header sammeln (Node.js 18+ API)
    const setCookies: string[] =
      typeof (fcRes.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === "function"
        ? (fcRes.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
        : ([fcRes.headers.get("set-cookie")] as string[]).filter(Boolean);

    const cookie = setCookies
      .map((c) => c.split(";")[0])
      .filter(Boolean)
      .join("; ");

    // Schritt 2: Crumb-Token abrufen (query1 → query2 Fallback)
    for (const host of ["query1", "query2"]) {
      try {
        const crumbRes = await fetch(
          `https://${host}.finance.yahoo.com/v1/test/getcrumb`,
          {
            headers: { "User-Agent": UA, Cookie: cookie },
            signal: AbortSignal.timeout(6_000),
          }
        );
        if (!crumbRes.ok) continue;
        const crumb = (await crumbRes.text()).trim();
        // Plausibilitätsprüfung: Crumb ist kurz und enthält kein "error"
        if (!crumb || crumb.length > 30 || crumb.toLowerCase().includes("error")) continue;

        _auth = { crumb, cookie, expiresAt: Date.now() + 55 * 60 * 1_000 };
        return _auth;
      } catch {
        continue;
      }
    }
  } catch {
    // Auth-Fehler — wird unten ohne Crumb weiterversucht
  }

  return null;
}

// ─── Daten-Abruf ─────────────────────────────────────────────────────────────

/** Ruft Yahoo Finance ab und gibt MATIF-Futures zurück */
export async function fetchMatifPreise(): Promise<MatifProdukt[]> {
  const auth = await getYahooAuth();

  const headers: Record<string, string> = {
    "User-Agent": UA,
    Accept:       "application/json",
  };
  if (auth?.cookie) headers["Cookie"] = auth.cookie;

  const crumbParam = auth?.crumb
    ? `&crumb=${encodeURIComponent(auth.crumb)}`
    : "";

  const results: MatifProdukt[] = [];

  for (const prod of MATIF_PRODUKTE) {
    let parsed = false;

    for (const host of ["query1", "query2"]) {
      if (parsed) break;
      try {
        const url =
          `https://${host}.finance.yahoo.com/v8/finance/chart/` +
          `${encodeURIComponent(prod.symbol)}?interval=1d&range=1mo${crumbParam}`;

        const res = await fetch(url, {
          headers,
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
          datum:      aktuell.datum,
          verlauf:    verlauf.slice(-20),
          prognose1W: linearForecast(verlauf),
        });
        parsed = true;
      } catch {
        // Host nicht erreichbar – nächsten versuchen
      }
    }
  }

  return results;
}
