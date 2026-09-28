import { NextRequest, NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getModulConfig, requireModul } from "@/lib/modul-config";
import { getCurrentUser } from "@/lib/auth";
import { parseEierSortierungZeile, resolveArtikelRef, resolveAnlieferungRef, EierSortierungImportFehler } from "@/lib/eiersortierung-import";
import {
  EierSortierungValidierungsFehler,
  validiereEierSortierungPositionen,
  validiereAnlieferungFuerSortierung,
  erstelleEierSortierung,
  type EierSortierungPositionInput,
} from "@/lib/eiersortierung";

export const dynamic = "force-dynamic";

// POST /api/eiersortierung/import — Commit-Schritt nach der Vorschau (.../import/vorschau).
// Jede Zeile = eine eigene EierSortierung mit genau einer Position, angelegt über dieselbe
// erstelleEierSortierung() wie die manuelle Erfassung und der Demodaten-Loader (lib/eiersortierung.ts)
// — bucht dadurch identisch Lagerzugang (Lagerbewegung "eingang" + Artikel.aktuellerBestand).
// Jede Zeile läuft in einer EIGENEN Transaktion statt einer einzigen über die gesamte Datei,
// damit ein großer Import nicht das Transaktions-Timeout überschreitet.
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

    const me = await getCurrentUser();

    const ergebnisse: { ok: number; fehler: { zeile: number; grund: string }[]; created: number[] } = {
      ok: 0,
      fehler: [],
      created: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const zeileNr = i + 2;
      const geparst = parseEierSortierungZeile(rows[i], zeileNr);
      if (!geparst.ok) {
        ergebnisse.fehler.push(geparst.fehler);
        continue;
      }
      const z = geparst.zeile;

      try {
        const sortierung = await prisma.$transaction(async (tx) => {
          const artikel = await resolveArtikelRef(tx, z.artikelRef);
          if ("error" in artikel) throw new EierSortierungImportFehler(artikel.error);

          const anlieferung = await resolveAnlieferungRef(tx, z.anlieferungRef);
          if ("error" in anlieferung) throw new EierSortierungImportFehler(anlieferung.error);
          const anlieferungId = "id" in anlieferung ? anlieferung.id : null;
          if (anlieferungId !== null) {
            await validiereAnlieferungFuerSortierung(tx, anlieferungId);
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
          validiereEierSortierungPositionen([position]);

          return erstelleEierSortierung(tx, {
            datum: z.datum,
            anlieferungId,
            notiz: z.notiz,
            erstelltVon: me?.benutzername ?? null,
            positionen: [position],
          });
        });

        ergebnisse.ok++;
        ergebnisse.created.push(sortierung.id);
      } catch (err) {
        if (err instanceof EierSortierungImportFehler || err instanceof EierSortierungValidierungsFehler) {
          ergebnisse.fehler.push({ zeile: zeileNr, grund: err.message });
          continue;
        }
        Sentry.captureException(err);
        const isDev = process.env.NODE_ENV === "development";
        const msg = isDev && err instanceof Error ? err.message : "DB-Fehler";
        ergebnisse.fehler.push({ zeile: zeileNr, grund: msg });
      }
    }

    return NextResponse.json(ergebnisse);
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Import fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
