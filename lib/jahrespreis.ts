// Preis-Jahresgültigkeiten: Auflösung eines Preises für ein bestimmtes Kalenderjahr,
// mit automatischer Interpolation auf das nächstgelegene bekannte Jahr, wenn für das
// angefragte Jahr kein expliziter Preis erfasst wurde.
//
// Interpolationsregel (bewusst einfach, kein linearer Preisverlauf): es wird immer der
// Preis des nächstgelegenen Jahres übernommen (kleinste |jahr - zielJahr|-Distanz).
// Bei Gleichstand (z.B. Preise für 2023 und 2025, Zieljahr 2024) gewinnt das ältere Jahr,
// da ein bereits abgerechneter/bekannter Preis als verlässlicher gilt als ein zukünftiger.
//
// Gibt es überhaupt keinen Jahrespreis, wird auf den skalaren Basispreis
// (Artikel.standardpreis / ArtikelLieferant.einkaufspreis / KundeArtikelPreis.preis)
// zurückgefallen — quelleJahr ist dann null, interpoliert bleibt false (es gibt schlicht
// keine Jahres-Historie, das ist kein "abweichendes Jahr").

import { prisma } from "@/lib/prisma";

export interface Jahreseintrag {
  jahr: number;
  preis: number;
}

export interface JahrespreisAufloesung {
  preis: number;
  jahr: number;               // angefragtes Jahr
  quelleJahr: number | null;  // Jahr, aus dem der Preis tatsächlich stammt
  interpoliert: boolean;      // true = quelleJahr !== jahr (Preis wurde übernommen)
  richtung: "aelter" | "juenger" | null; // Richtung der Übernahme, für Anzeige "↓ 2024" / "↑ 2026"
}

export function aktuellesJahr(): number {
  return new Date().getFullYear();
}

// Reiner Rechenkern, keine DB-Zugriffe — leicht testbar.
export function loeseJahrespreisAuf(
  eintraege: Jahreseintrag[],
  zielJahr: number,
  basispreis: number,
): JahrespreisAufloesung {
  const exakt = eintraege.find((e) => e.jahr === zielJahr);
  if (exakt) {
    return { preis: exakt.preis, jahr: zielJahr, quelleJahr: zielJahr, interpoliert: false, richtung: null };
  }
  if (eintraege.length === 0) {
    return { preis: basispreis, jahr: zielJahr, quelleJahr: null, interpoliert: false, richtung: null };
  }

  let beste: Jahreseintrag = eintraege[0];
  let besteDistanz = Math.abs(beste.jahr - zielJahr);
  for (const e of eintraege.slice(1)) {
    const distanz = Math.abs(e.jahr - zielJahr);
    if (distanz < besteDistanz || (distanz === besteDistanz && e.jahr < beste.jahr)) {
      beste = e;
      besteDistanz = distanz;
    }
  }

  return {
    preis: beste.preis,
    jahr: zielJahr,
    quelleJahr: beste.jahr,
    interpoliert: true,
    richtung: beste.jahr < zielJahr ? "aelter" : "juenger",
  };
}

// ─── Artikel-Verkaufspreis ────────────────────────────────────────────────────

export async function getArtikelPreisFuerJahr(artikelId: number, jahr: number): Promise<JahrespreisAufloesung> {
  const [artikel, jahrespreise] = await Promise.all([
    prisma.artikel.findUnique({ where: { id: artikelId }, select: { standardpreis: true } }),
    prisma.artikelJahrespreis.findMany({ where: { artikelId }, select: { jahr: true, preis: true } }),
  ]);
  return loeseJahrespreisAuf(jahrespreise, jahr, artikel?.standardpreis ?? 0);
}

// Bulk-Variante für Listen (Artikelliste, Angebot/Lieferung-Formulare) — eine Query
// statt N+1. `artikel` sollte bereits geladen sein (z.B. aus artikelSafeSelect).
export async function loeseArtikelPreiseFuerJahr(
  artikel: { id: number; standardpreis: number }[],
  jahr: number,
): Promise<Map<number, JahrespreisAufloesung>> {
  const ids = artikel.map((a) => a.id);
  const result = new Map<number, JahrespreisAufloesung>();
  if (ids.length === 0) return result;

  const eintraege = await prisma.artikelJahrespreis.findMany({
    where: { artikelId: { in: ids } },
    select: { artikelId: true, jahr: true, preis: true },
  });
  const byArtikel = new Map<number, Jahreseintrag[]>();
  for (const e of eintraege) {
    if (!byArtikel.has(e.artikelId)) byArtikel.set(e.artikelId, []);
    byArtikel.get(e.artikelId)!.push({ jahr: e.jahr, preis: e.preis });
  }
  for (const a of artikel) {
    result.set(a.id, loeseJahrespreisAuf(byArtikel.get(a.id) ?? [], jahr, a.standardpreis));
  }
  return result;
}

// Schreibt Artikel.standardpreis + ArtikelPreisHistorie so fort, dass sie stets dem
// aufgelösten Preis für das aktuelle Jahr entsprechen (Artikel.standardpreis bleibt damit
// der "aktuellste bekannte Wert" für Stellen im Code, die noch keinen Jahresbezug kennen).
// Wird nach jedem Anlegen/Ändern/Löschen eines ArtikelJahrespreis aufgerufen.
export async function syncArtikelStandardpreis(artikelId: number): Promise<void> {
  const artikel = await prisma.artikel.findUnique({ where: { id: artikelId }, select: { standardpreis: true } });
  if (!artikel) return;
  const jahrespreise = await prisma.artikelJahrespreis.findMany({ where: { artikelId }, select: { jahr: true, preis: true } });
  if (jahrespreise.length === 0) return; // kein Jahrespreis erfasst → Standardpreis bleibt manuell gepflegt

  const aufgeloest = loeseJahrespreisAuf(jahrespreise, aktuellesJahr(), artikel.standardpreis);
  if (aufgeloest.preis === artikel.standardpreis) return;

  await prisma.$transaction([
    prisma.artikel.update({ where: { id: artikelId }, data: { standardpreis: aufgeloest.preis, preisStand: new Date() } }),
    prisma.artikelPreisHistorie.create({
      data: {
        artikelId,
        alterPreis: artikel.standardpreis,
        neuerPreis: aufgeloest.preis,
        notiz: aufgeloest.interpoliert
          ? `Automatisch aus Jahrespreis ${aufgeloest.quelleJahr} übernommen (kein Preis für ${aktuellesJahr()} erfasst)`
          : `Automatisch aus Jahrespreis ${aufgeloest.quelleJahr} übernommen`,
      },
    }),
  ]);
}

// ─── Einkaufspreis je Lieferant ───────────────────────────────────────────────

export async function getEinkaufspreisFuerJahr(artikelLieferantId: number, jahr: number): Promise<JahrespreisAufloesung> {
  const [al, jahrespreise] = await Promise.all([
    prisma.artikelLieferant.findUnique({ where: { id: artikelLieferantId }, select: { einkaufspreis: true } }),
    prisma.artikelLieferantJahrespreis.findMany({ where: { artikelLieferantId }, select: { jahr: true, einkaufspreis: true } }),
  ]);
  return loeseJahrespreisAuf(
    jahrespreise.map((j) => ({ jahr: j.jahr, preis: j.einkaufspreis })),
    jahr,
    al?.einkaufspreis ?? 0,
  );
}

export async function syncEinkaufspreis(artikelLieferantId: number): Promise<void> {
  const al = await prisma.artikelLieferant.findUnique({ where: { id: artikelLieferantId }, select: { einkaufspreis: true } });
  if (!al) return;
  const jahrespreise = await prisma.artikelLieferantJahrespreis.findMany({
    where: { artikelLieferantId },
    select: { jahr: true, einkaufspreis: true },
  });
  if (jahrespreise.length === 0) return;

  const aufgeloest = loeseJahrespreisAuf(
    jahrespreise.map((j) => ({ jahr: j.jahr, preis: j.einkaufspreis })),
    aktuellesJahr(),
    al.einkaufspreis,
  );
  if (aufgeloest.preis === al.einkaufspreis) return;
  await prisma.artikelLieferant.update({ where: { id: artikelLieferantId }, data: { einkaufspreis: aufgeloest.preis } });
}

// ─── Kunden-Sonderpreis ───────────────────────────────────────────────────────

export async function getKundePreisFuerJahr(kundeArtikelPreisId: number, jahr: number): Promise<JahrespreisAufloesung> {
  const [kap, jahrespreise] = await Promise.all([
    prisma.kundeArtikelPreis.findUnique({ where: { id: kundeArtikelPreisId }, select: { preis: true } }),
    prisma.kundeArtikelPreisJahr.findMany({ where: { kundeArtikelPreisId }, select: { jahr: true, preis: true } }),
  ]);
  return loeseJahrespreisAuf(jahrespreise, jahr, kap?.preis ?? 0);
}

// Bulk-Variante für die Sonderpreisliste eines Kunden (/api/kunden/[id]/preise, Preisauskunft).
export async function loeseKundePreiseFuerJahr(
  kundePreise: { id: number; preis: number }[],
  jahr: number,
): Promise<Map<number, JahrespreisAufloesung>> {
  const ids = kundePreise.map((k) => k.id);
  const result = new Map<number, JahrespreisAufloesung>();
  if (ids.length === 0) return result;

  const eintraege = await prisma.kundeArtikelPreisJahr.findMany({
    where: { kundeArtikelPreisId: { in: ids } },
    select: { kundeArtikelPreisId: true, jahr: true, preis: true },
  });
  const byKap = new Map<number, Jahreseintrag[]>();
  for (const e of eintraege) {
    if (!byKap.has(e.kundeArtikelPreisId)) byKap.set(e.kundeArtikelPreisId, []);
    byKap.get(e.kundeArtikelPreisId)!.push({ jahr: e.jahr, preis: e.preis });
  }
  for (const k of kundePreise) {
    result.set(k.id, loeseJahrespreisAuf(byKap.get(k.id) ?? [], jahr, k.preis));
  }
  return result;
}

export async function syncKundePreis(kundeArtikelPreisId: number): Promise<void> {
  const kap = await prisma.kundeArtikelPreis.findUnique({ where: { id: kundeArtikelPreisId }, select: { preis: true } });
  if (!kap) return;
  const jahrespreise = await prisma.kundeArtikelPreisJahr.findMany({
    where: { kundeArtikelPreisId },
    select: { jahr: true, preis: true },
  });
  if (jahrespreise.length === 0) return;

  const aufgeloest = loeseJahrespreisAuf(jahrespreise, aktuellesJahr(), kap.preis);
  if (aufgeloest.preis === kap.preis) return;
  await prisma.kundeArtikelPreis.update({ where: { id: kundeArtikelPreisId }, data: { preis: aufgeloest.preis } });
}
