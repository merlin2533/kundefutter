import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { ladeEinkaufsabgleich } from "@/lib/einkaufsabgleich";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const EPSILON = 0.01;

// GET /api/einkaufsabgleich/export?filter=offen|gedeckt|alle&gruppe=&q=
// Excel-Export des Einkaufsabgleichs (gleiche Daten/Filter wie die Bildschirmansicht) — zum
// Ausdrucken/Mitnehmen gedacht (z.B. ins Lieferantengespräch). `gruppe` schränkt auf eine
// Artikelgruppe ein (ArtikelZeile.gruppe, siehe lib/einkaufsabgleich.ts), `q` auf Artikel/
// Artikelnummer (Teilstring, case-insensitive) — identische Filterung wie auf dem Bildschirm.
// Drei Sheets: Übersicht je Artikel (inkl. Artikelgruppe, sortiert danach), Aufschlüsselung des
// Kundenbedarfs (Vorbestellung/Auftrag/Angebot) und der Lieferantenbestellungen — dieselben
// Daten, die auch die aufklappbare Zeile auf dem Bildschirm zeigt, nur vollständig statt nur für
// eine Zeile.
export async function GET(req: NextRequest) {
  const modul = await getModulConfig();
  const denyModul = requireModul(modul, "fruehbezug");
  if (denyModul) return denyModul;

  try {
    const params = new URL(req.url).searchParams;
    const filter = params.get("filter") ?? "alle";
    const gruppe = params.get("gruppe") ?? "";
    const q = (params.get("q") ?? "").trim().toLowerCase();
    const zeilenAlle = await ladeEinkaufsabgleich();
    const zeilen = zeilenAlle.filter((z) => {
      if (filter === "offen" && z.restMenge <= EPSILON) return false;
      if (filter === "gedeckt" && z.restMenge > EPSILON) return false;
      if (gruppe && z.gruppe !== gruppe) return false;
      if (q && !z.artikelName.toLowerCase().includes(q) && !z.artikelnummer.toLowerCase().includes(q)) return false;
      return true;
    });

    const wb = XLSX.utils.book_new();

    const uebersichtHeader = ["Artikelgruppe", "Artikel", "Artikelnummer", "Einheit", "Kundenbedarf", "Bestellt", "Rest", "Status"];
    const uebersichtRows = zeilen.map((z) => [
      z.gruppe,
      z.artikelName,
      z.artikelnummer,
      z.einheit,
      z.kundenbedarfMenge,
      z.bestelltMenge,
      z.restMenge,
      z.restMenge > EPSILON ? "Offen" : z.kundenbedarfMenge <= EPSILON && z.bestelltMenge > 0 ? "Ohne Kundenbedarf bestellt" : "Gedeckt",
    ]);
    const wsUebersicht = XLSX.utils.aoa_to_sheet([uebersichtHeader, ...uebersichtRows]);
    wsUebersicht["!cols"] = [{ wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 24 }];
    XLSX.utils.book_append_sheet(wb, wsUebersicht, "Übersicht");

    const BELEG_TYP_LABEL: Record<string, string> = { vorbestellung: "Vorbestellung", lieferung: "Auftrag", angebot: "Angebot" };
    const kundenHeader = ["Artikelgruppe", "Artikel", "Quelle", "Beleg-Nr.", "Kunde", "Menge", "Einheit", "Status"];
    const kundenRows = zeilen.flatMap((z) =>
      z.kundenPositionen.map((p) => [
        z.gruppe,
        z.artikelName,
        BELEG_TYP_LABEL[p.quelle] ?? p.quelle,
        p.belegNummer,
        p.kunde ? p.kunde.firma || p.kunde.name : "",
        p.menge,
        p.einheit,
        p.status,
      ])
    );
    const wsKunden = XLSX.utils.aoa_to_sheet([kundenHeader, ...kundenRows]);
    wsKunden["!cols"] = [{ wch: 18 }, { wch: 32 }, { wch: 14 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 8 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, wsKunden, "Kundenbedarf");

    const bestellungHeader = ["Artikelgruppe", "Artikel", "Bestellung-Nr.", "Lieferant", "Menge", "Geliefert", "Einheit", "Status"];
    const bestellungRows = zeilen.flatMap((z) =>
      z.bestellungen.map((b) => [z.gruppe, z.artikelName, b.nummer, b.lieferantName, b.menge, b.mengeGeliefert, b.einheit, b.status])
    );
    const wsBestellungen = XLSX.utils.aoa_to_sheet([bestellungHeader, ...bestellungRows]);
    wsBestellungen["!cols"] = [{ wch: 18 }, { wch: 32 }, { wch: 16 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 8 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, wsBestellungen, "Lieferantenbestellungen");

    const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="einkaufsabgleich.xlsx"`,
      },
    });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Export fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
