/**
 * lib/kampagne-potenzial.ts
 * Einzige Quelle der Wahrheit für die Zielkunden-Liste einer Kampagne (Kunde + Umsatzpotenzial
 * aus passenden Bedarfen) — genutzt von `GET /api/kampagnen/[id]/kunden` (Bildschirmansicht,
 * Tab „Kunden & Potenzial" auf `/kampagnen/[id]`) UND dem neuen CSV-Export
 * `GET /api/exporte/kampagne`, damit beide nie auseinanderlaufen (Muster wie `sammleKatMeldung()`).
 */
import { prisma } from "@/lib/prisma";

export interface KampagnePotenzialBedarf {
  artikelId: number;
  artikelName: string;
  einheit: string;
  menge: number;
  intervallTage: number;
}

export interface KampagnePotenzialKunde {
  id: number;
  kundeId: number;
  name: string;
  firma: string | null;
  ort: string | null;
  kategorie: string | null;
  telefon: string | null;
  bedarfe: KampagnePotenzialBedarf[];
  potenzialMenge: number;
}

export interface KampagnePotenzialErgebnis {
  kampagne: { id: number; name: string };
  kunden: KampagnePotenzialKunde[];
}

export async function ladeKampagnePotenzial(kampagneId: number): Promise<KampagnePotenzialErgebnis | null> {
  const kampagne = await prisma.kampagne.findUnique({
    where: { id: kampagneId },
    include: {
      artikel: { select: { artikelId: true, sonderpreis: true } },
      kunden: {
        include: {
          kunde: {
            select: {
              id: true,
              name: true,
              firma: true,
              ort: true,
              kategorie: true,
              kontakte: { where: { typ: { in: ["telefon", "mobil"] } }, select: { wert: true, typ: true } },
              bedarfe: {
                where: { aktiv: true },
                include: { artikel: { select: { id: true, name: true, einheit: true } } },
              },
            },
          },
        },
        orderBy: { kunde: { name: "asc" } },
      },
    },
  });

  if (!kampagne) return null;

  const kampagneArtikelIds = new Set(kampagne.artikel.map((a) => a.artikelId));

  const kunden: KampagnePotenzialKunde[] = kampagne.kunden.map((kk) => {
    const k = kk.kunde;
    const matchingBedarfe = k.bedarfe.filter((b) => kampagneArtikelIds.has(b.artikelId));
    const potenzialMenge = matchingBedarfe.reduce((sum, b) => sum + b.menge, 0);

    return {
      id: kk.id,
      kundeId: k.id,
      name: k.name,
      firma: k.firma,
      ort: k.ort,
      kategorie: k.kategorie,
      telefon: k.kontakte[0]?.wert ?? null,
      bedarfe: matchingBedarfe.map((b) => ({
        artikelId: b.artikelId,
        artikelName: b.artikel.name,
        einheit: b.artikel.einheit,
        menge: b.menge,
        intervallTage: b.intervallTage,
      })),
      potenzialMenge,
    };
  });

  kunden.sort((a, b) => b.potenzialMenge - a.potenzialMenge);

  return { kampagne: { id: kampagne.id, name: kampagne.name }, kunden };
}

// Wie lib/csv.ts's esc() — bewusst auch bares \r escapen (nicht nur \n), sonst reißt eine
// Notiz/ein Artikelname mit Windows-Zeilenumbruch die Zeile in Excel unbemerkt auf zwei auf.
function csvQ(v: string | number): string {
  const s = String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * CSV der Zielkunden-Liste — für eine Mailing-Aktion außerhalb von AGRI-Office mitnehmbar.
 * Mit UTF-8-BOM (wie lib/datev.ts, nicht wie lib/kat-meldung.ts) — dieser Export ist explizit
 * für den Re-Import in Excel/eine Mailing-Software gedacht (Umlaute in Kunden-/Ortsnamen sonst
 * kaputt), nicht nur ein reines Zahlen-Dokument wie die KAT-Meldung. Zahlen bleiben bewusst mit
 * ASCII-Punkt (kein deutsches Dezimalkomma) — entspricht der bestehenden Konvention in
 * lib/datev.ts/lib/kat-meldung.ts, keiner der beiden formatiert Zahlen um.
 */
export function buildKampagnePotenzialCsv(ergebnis: KampagnePotenzialErgebnis): string {
  const BOM = "﻿";
  const header = ["Kunde", "Firma", "Ort", "Kategorie", "Telefon", "Potenzial-Menge", "Artikel (Bedarfe)"].join(";");
  const rows = ergebnis.kunden.map((k) =>
    [
      k.name,
      k.firma ?? "",
      k.ort ?? "",
      k.kategorie ?? "",
      k.telefon ?? "",
      k.potenzialMenge,
      k.bedarfe.map((b) => `${b.artikelName} (${b.menge} ${b.einheit})`).join(", "),
    ]
      .map(csvQ)
      .join(";"),
  );
  return BOM + [header, ...rows].join("\r\n");
}
