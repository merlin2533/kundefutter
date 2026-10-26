/**
 * lib/eier-fefo.ts
 * FEFO ("First Expired, First Out") für Eier: Beim Verkauf soll die Charge mit dem frühesten
 * MHD zuerst raus. Der Lagerbestand ist nicht je Charge geführt — der Rest je Charge ergibt
 * sich aus sortierter Menge abzüglich ausgelieferter/geplanter Menge derselben Chargennummer.
 * Rein (ohne DB), damit testbar; die Abfrage steht in app/api/eierkontrolle/fefo/route.ts.
 */
import { berechneEierMhd } from "./eier-mhd";

export interface FefoCharge {
  chargeNr: string;
  /** frühestes Legedatum der Charge (Basis des MHD), null = unbekannt */
  legedatum: Date | null;
  rest: number;
}

export interface FefoBewertung {
  stufe: "info" | "warnung" | null;
  hinweis: string | null;
  aelteste: { chargeNr: string; mhd: string | null; rest: number } | null;
}

const fmt = (d: Date) => d.toLocaleDateString("de-DE");

/** Rest je Charge (sortiert − verkauft), nur Chargen mit positivem Rest, früheste Legedatum
 * zuerst; Chargen ohne Legedatum ans Ende (MHD unbekannt, FEFO nicht beurteilbar). */
export function berechneChargenRest(
  sortiert: { chargeNr: string; menge: number; legedatum: Date | null }[],
  verkauft: Map<string, number>,
): FefoCharge[] {
  const map = new Map<string, FefoCharge>();
  for (const p of sortiert) {
    const c = map.get(p.chargeNr) ?? { chargeNr: p.chargeNr, legedatum: null, rest: 0 };
    c.rest += p.menge;
    if (p.legedatum && (!c.legedatum || p.legedatum < c.legedatum)) c.legedatum = p.legedatum;
    map.set(p.chargeNr, c);
  }
  return [...map.values()]
    .map((c) => ({ ...c, rest: c.rest - (verkauft.get(c.chargeNr) ?? 0) }))
    .filter((c) => c.rest > 1e-9)
    .sort((a, b) => {
      if (a.legedatum && b.legedatum) return a.legedatum.getTime() - b.legedatum.getTime();
      if (a.legedatum) return -1;
      if (b.legedatum) return 1;
      return a.chargeNr.localeCompare(b.chargeNr);
    });
}

export function bewerteFefo(chargen: FefoCharge[], gewaehlt: string | null, jetzt: Date = new Date()): FefoBewertung {
  const leer: FefoBewertung = { stufe: null, hinweis: null, aelteste: null };
  if (chargen.length === 0) return leer;

  const aelteste = chargen[0];
  const aeltesteMhd = aelteste.legedatum ? berechneEierMhd(aelteste.legedatum) : null;
  const info = { chargeNr: aelteste.chargeNr, mhd: aeltesteMhd ? fmt(aeltesteMhd) : null, rest: aelteste.rest };
  const aeltesteAbgelaufen = !!aeltesteMhd && aeltesteMhd.getTime() < jetzt.getTime();

  const gw = gewaehlt ? chargen.find((c) => c.chargeNr === gewaehlt) ?? null : null;
  const gwMhd = gw?.legedatum ? berechneEierMhd(gw.legedatum) : null;

  if (gw && gwMhd && gwMhd.getTime() < jetzt.getTime()) {
    return { stufe: "warnung", hinweis: `Charge ${gw.chargeNr} ist abgelaufen (MHD ${fmt(gwMhd)}) und darf nicht mehr verkauft werden.`, aelteste: info };
  }
  if (gewaehlt && gw && gw.chargeNr !== aelteste.chargeNr && aelteste.legedatum) {
    const spaeter = !gw.legedatum || gw.legedatum.getTime() > aelteste.legedatum.getTime();
    if (spaeter) {
      return {
        stufe: "warnung",
        hinweis: `FEFO: Charge ${aelteste.chargeNr} läuft früher ab (MHD ${info.mhd}, Rest ${aelteste.rest}) — bitte zuerst diese ausliefern.`,
        aelteste: info,
      };
    }
  }
  if (aeltesteAbgelaufen && (!gewaehlt || gewaehlt === aelteste.chargeNr)) {
    return { stufe: "warnung", hinweis: `Älteste Charge ${aelteste.chargeNr} ist abgelaufen (MHD ${info.mhd}, Rest ${aelteste.rest}) — aussortieren statt verkaufen.`, aelteste: info };
  }
  if (!gewaehlt) {
    return {
      stufe: "info",
      hinweis: `Älteste Charge mit Restbestand: ${aelteste.chargeNr}${info.mhd ? ` (MHD ${info.mhd}` : " (MHD unbekannt"}, Rest ${aelteste.rest}).`,
      aelteste: info,
    };
  }
  return { ...leer, aelteste: info };
}
