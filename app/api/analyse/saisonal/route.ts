import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const MONAT_LABELS = ["Jan", "Feb", "Mär", "Apr", "Mai", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dez"];

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const jahreParam = searchParams.get("jahre");

    const heute = new Date();
    const aktuellesJahr = heute.getFullYear();

    let jahre: number[];
    if (jahreParam) {
      jahre = jahreParam.split(",").map(Number).filter((n) => !isNaN(n));
    } else {
      jahre = [aktuellesJahr - 2, aktuellesJahr - 1, aktuellesJahr];
    }

    const minJahr = Math.min(...jahre);
    const vonDate = new Date(minJahr, 0, 1);

    // Fetch all delivered Lieferungen with positionen in range
    const lieferungen = await prisma.lieferung.findMany({
      where: {
        status: "geliefert",
        datum: { gte: vonDate },
      },
      include: {
        positionen: {
          include: { artikel: { select: { id: true, name: true, kategorie: true } } },
        },
      },
      take: 10000,
    });

    // Build monat x jahr matrix (umsatz + count)
    type JahrDaten = { umsatz: number; anzahl: number };
    const matrix: Record<number, Record<number, JahrDaten>> = {};
    for (let m = 1; m <= 12; m++) {
      matrix[m] = {};
      for (const j of jahre) {
        matrix[m][j] = { umsatz: 0, anzahl: 0 };
      }
    }

    // Kategorie x monat matrix (all years combined)
    const kategorien = new Set<string>();
    // kategorieMatrix[monat-1][kategorie] = umsatz
    const kategorieMatrix: Record<number, Record<string, number>> = {};
    for (let m = 0; m < 12; m++) {
      kategorieMatrix[m] = {};
    }

    // artikelUmsatz per monat (all years combined) for top 5
    const artikelMonatMap = new Map<number, { name: string; umsatz: number[] }>();

    for (const l of lieferungen) {
      const datum = new Date(l.datum);
      const jahr = datum.getFullYear();
      const monat = datum.getMonth() + 1;

      if (!jahre.includes(jahr)) continue;

      const umsatz = l.positionen.reduce((s: number, p: { menge: number; verkaufspreis: number }) => s + p.menge * p.verkaufspreis, 0);
      matrix[monat][jahr].umsatz += umsatz;
      matrix[monat][jahr].anzahl += 1;

      for (const pos of l.positionen) {
        const posUmsatz = pos.menge * pos.verkaufspreis;
        const kat = pos.artikel.kategorie || "Sonstige";
        kategorien.add(kat);
        kategorieMatrix[monat - 1][kat] = (kategorieMatrix[monat - 1][kat] ?? 0) + posUmsatz;

        const key = pos.artikelId;
        if (!artikelMonatMap.has(key)) {
          artikelMonatMap.set(key, { name: pos.artikel.name, umsatz: Array(12).fill(0) });
        }
        const entry = artikelMonatMap.get(key)!;
        entry.umsatz[monat - 1] += posUmsatz;
      }
    }

    // Build monatsData response
    const monatsData = Array.from({ length: 12 }, (_, i) => {
      const monat = i + 1;
      const entry: Record<string, unknown> = {
        monat,
        label: MONAT_LABELS[i],
      };
      for (const j of jahre) {
        const d = matrix[monat][j];
        entry[String(j)] = {
          umsatz: Math.round(d.umsatz * 100) / 100,
          anzahl: d.anzahl,
        };
      }
      // Kategorie-Aufschlüsselung für diesen Monat
      const katEntry: Record<string, number> = {};
      for (const kat of kategorien) {
        katEntry[kat] = Math.round((kategorieMatrix[i][kat] ?? 0) * 100) / 100;
      }
      entry.kategorien = katEntry;
      return entry;
    });

    // Stärkster Monat je Kategorie
    const staerksterMonat: Record<string, { monat: string; umsatz: number }> = {};
    for (const kat of kategorien) {
      let maxUmsatz = 0;
      let maxMonat = "";
      for (let i = 0; i < 12; i++) {
        const u = kategorieMatrix[i][kat] ?? 0;
        if (u > maxUmsatz) {
          maxUmsatz = u;
          maxMonat = MONAT_LABELS[i];
        }
      }
      if (maxUmsatz > 0) {
        staerksterMonat[kat] = { monat: maxMonat, umsatz: Math.round(maxUmsatz * 100) / 100 };
      }
    }

    // Top 5 Artikel by total umsatz
    const topArtikel = Array.from(artikelMonatMap.entries())
      .map(([artikelId, v]) => ({
        artikelId,
        name: v.name,
        umsatzGesamt: Math.round(v.umsatz.reduce((s, x) => s + x, 0) * 100) / 100,
        umsatzProMonat: v.umsatz.map((u) => Math.round(u * 100) / 100),
      }))
      .sort((a, b) => b.umsatzGesamt - a.umsatzGesamt)
      .slice(0, 5);

    return NextResponse.json({
      jahre,
      monatsData,
      topArtikel,
      kategorien: Array.from(kategorien).sort(),
      staerksterMonat,
    });
  } catch (e) {
    console.error("Saisonal-Analyse Fehler:", e);
    return NextResponse.json({ error: "Datenbankfehler" }, { status: 500 });
  }
}
