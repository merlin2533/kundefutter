import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { parseEierSortierungZeile, resolveArtikelRef, resolveAnlieferungRef } from "@/lib/eiersortierung-import";
import {
  EierSortierungValidierungsFehler,
  validiereEierSortierungPositionen,
  validiereAnlieferungFuerSortierung,
  type EierSortierungPositionInput,
} from "@/lib/eiersortierung";

export const dynamic = "force-dynamic";

export interface EierSortierungVorschauZeile {
  zeile: number;
  status: "neu" | "fehler";
  artikel?: string;
  gueteklasse?: string;
  gewichtsklasse?: string;
  menge?: number;
  datum?: string;
  anlieferung?: string | null;
  grund?: string;
}

// POST /api/eiersortierung/import/vorschau — liest die Datei, löst Artikel/Anlieferung je
// Zeile auf und validiert Güte-/Gewichtsklasse (dieselbe Whitelist wie die manuelle Erfassung,
// validiereEierSortierungPositionen()) — OHNE etwas anzulegen.
export async function POST(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "eierhandel");
    if (denyModul) return denyModul;

    const form = await req.formData();
    const file = form.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    if (rows.length === 0) {
      return NextResponse.json({ error: "Keine Zeilen in der Datei gefunden" }, { status: 400 });
    }

    const ergebnis: EierSortierungVorschauZeile[] = [];

    for (let i = 0; i < rows.length; i++) {
      const zeileNr = i + 2;
      const geparst = parseEierSortierungZeile(rows[i], zeileNr);
      if (!geparst.ok) {
        ergebnis.push({ zeile: zeileNr, status: "fehler", grund: geparst.fehler.grund });
        continue;
      }
      const z = geparst.zeile;

      const artikel = await resolveArtikelRef(prisma, z.artikelRef);
      if ("error" in artikel) {
        ergebnis.push({ zeile: zeileNr, status: "fehler", grund: artikel.error });
        continue;
      }

      const position: EierSortierungPositionInput = {
        artikelId: artikel.id,
        gueteklasse: z.gueteklasse,
        gewichtsklasse: z.gewichtsklasse,
        menge: z.menge,
        chargeNr: z.chargeNr,
        legedatum: z.legedatum,
        erzeugercode: z.erzeugercode,
      };
      try {
        validiereEierSortierungPositionen([position]);
      } catch (err) {
        if (err instanceof EierSortierungValidierungsFehler) {
          ergebnis.push({ zeile: zeileNr, status: "fehler", grund: err.message });
          continue;
        }
        throw err;
      }

      const anlieferung = await resolveAnlieferungRef(prisma, z.anlieferungRef);
      if ("error" in anlieferung) {
        ergebnis.push({ zeile: zeileNr, status: "fehler", grund: anlieferung.error });
        continue;
      }
      if ("id" in anlieferung) {
        try {
          await validiereAnlieferungFuerSortierung(prisma, anlieferung.id);
        } catch (err) {
          if (err instanceof EierSortierungValidierungsFehler) {
            ergebnis.push({ zeile: zeileNr, status: "fehler", grund: err.message });
            continue;
          }
          throw err;
        }
      }

      ergebnis.push({
        zeile: zeileNr,
        status: "neu",
        artikel: artikel.name,
        gueteklasse: z.gueteklasse,
        gewichtsklasse: z.gewichtsklasse,
        menge: z.menge,
        datum: z.datum.toISOString(),
        anlieferung: z.anlieferungRef,
      });
    }

    const summary = {
      neu: ergebnis.filter((r) => r.status === "neu").length,
      fehler: ergebnis.filter((r) => r.status === "fehler").length,
    };

    return NextResponse.json({ rows: ergebnis, summary });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Vorschau fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
