import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { parseAnlieferungZeile, resolveAnlieferungKunde, resolveArtikelRef } from "@/lib/anlieferung-import";

export const dynamic = "force-dynamic";

export interface AnlieferungVorschauZeile {
  zeile: number;
  status: "neu" | "uebersprungen" | "fehler";
  kunde?: string;
  artikel?: string;
  menge?: number;
  einheit?: string;
  datum?: string;
  externeNr?: string | null;
  grund?: string;
}

// POST /api/anlieferungen/import/vorschau — liest die Datei, löst Kunde/Artikel je Zeile auf
// und liefert eine Vorschau OHNE etwas anzulegen. Nutzt exakt dieselbe Parsing-/Auflösungslogik
// wie der tatsächliche Import (lib/anlieferung-import.ts), damit Vorschau und Commit nie
// auseinanderlaufen.
export async function POST(req: NextRequest) {
  try {
    const modul = await getModulConfig();
    const denyModul = requireModul(modul, "erzeugerabrechnung");
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

    const ergebnis: AnlieferungVorschauZeile[] = [];

    for (let i = 0; i < rows.length; i++) {
      const zeileNr = i + 2; // Header ist Zeile 1
      const geparst = parseAnlieferungZeile(rows[i], zeileNr);
      if (!geparst.ok) {
        ergebnis.push({ zeile: zeileNr, status: "fehler", grund: geparst.fehler.grund });
        continue;
      }
      const z = geparst.zeile;

      const [kunde, artikel] = await Promise.all([
        resolveAnlieferungKunde(prisma, z.kundeName),
        resolveArtikelRef(prisma, z.artikelRef),
      ]);
      if ("error" in kunde) {
        ergebnis.push({ zeile: zeileNr, status: "fehler", grund: kunde.error });
        continue;
      }
      if ("error" in artikel) {
        ergebnis.push({ zeile: zeileNr, status: "fehler", grund: artikel.error });
        continue;
      }

      let status: AnlieferungVorschauZeile["status"] = "neu";
      let grund: string | undefined;
      if (z.externeNr) {
        const vorhanden = await prisma.anlieferung.findFirst({
          where: { kundeId: kunde.id, externeNr: z.externeNr },
          select: { nummer: true },
        });
        if (vorhanden) {
          status = "uebersprungen";
          grund = `Bereits importiert als ${vorhanden.nummer} (Beleg „${z.externeNr}“)`;
        }
      }

      ergebnis.push({
        zeile: zeileNr,
        status,
        kunde: kunde.name,
        artikel: artikel.name,
        menge: z.menge,
        einheit: z.einheit,
        datum: z.datum.toISOString(),
        externeNr: z.externeNr,
        grund,
      });
    }

    const summary = {
      neu: ergebnis.filter((r) => r.status === "neu").length,
      uebersprungen: ergebnis.filter((r) => r.status === "uebersprungen").length,
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
