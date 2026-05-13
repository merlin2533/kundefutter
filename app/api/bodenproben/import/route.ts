import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pickCol, parseNumber } from "@/lib/import-utils";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// POST /api/bodenproben/import — multipart CSV/Excel mit Spalten:
//   Schlag, Datum, ProbenNr, Labor, Tiefe, pH, P2O5, K2O, Mg, B, Humus, NMin, CN, Bodenart, Klasse
//
// Schlag wird per Name innerhalb eines (optionalen) Kunden gesucht.
export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const kundeIdRaw = form.get("kundeId");
    if (!file) return NextResponse.json({ error: "Keine Datei" }, { status: 400 });

    const kundeId = kundeIdRaw ? parseInt(String(kundeIdRaw), 10) : null;
    const buffer = Buffer.from(await file.arrayBuffer());
    const wb = XLSX.read(buffer, { type: "buffer" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    const ergebnisse: { ok: number; fehler: { zeile: number; grund: string }[]; created: number[] } = {
      ok: 0,
      fehler: [],
      created: [],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const schlagName = pickCol(row, "Schlag", "Schlagname", "Feld");
      const datumStr = pickCol(row, "Datum", "Probedatum", "Probenahme");

      if (!schlagName) {
        ergebnisse.fehler.push({ zeile: i + 2, grund: "Schlag fehlt" });
        continue;
      }
      if (!datumStr) {
        ergebnisse.fehler.push({ zeile: i + 2, grund: "Datum fehlt" });
        continue;
      }

      const schlagWhere: { name: string; kundeId?: number } = { name: schlagName };
      if (kundeId) schlagWhere.kundeId = kundeId;
      const schlag = await prisma.kundeSchlag.findFirst({ where: schlagWhere });
      if (!schlag) {
        ergebnisse.fehler.push({ zeile: i + 2, grund: `Schlag "${schlagName}" nicht gefunden` });
        continue;
      }

      const datum = parseDatum(datumStr);
      if (!datum) {
        ergebnisse.fehler.push({ zeile: i + 2, grund: `Datum ungültig: ${datumStr}` });
        continue;
      }

      try {
        const probe = await prisma.bodenprobe.create({
          data: {
            schlagId: schlag.id,
            datum,
            probenNr: pickCol(row, "ProbenNr", "Proben-Nr", "Probe") || null,
            labor: pickCol(row, "Labor", "Laborname") || null,
            tiefe: pickCol(row, "Tiefe", "Probentiefe") || null,
            pH: numFromCol(row, "pH", "pH-Wert"),
            phosphor: numFromCol(row, "P2O5", "Phosphor", "P"),
            kalium: numFromCol(row, "K2O", "Kalium", "K"),
            magnesium: numFromCol(row, "Mg", "Magnesium"),
            bor: numFromCol(row, "B", "Bor"),
            humus: numFromCol(row, "Humus", "Humus%"),
            nMin: numFromCol(row, "NMin", "N-Min", "Nmin"),
            cn: numFromCol(row, "CN", "C/N"),
            bodenart: pickCol(row, "Bodenart") || null,
            klasse: pickCol(row, "Klasse", "Versorgungsklasse") || null,
          },
        });
        ergebnisse.ok++;
        ergebnisse.created.push(probe.id);
      } catch (err) {
        const isDev = process.env.NODE_ENV === "development";
        const msg = isDev && err instanceof Error ? err.message : "DB-Fehler";
        ergebnisse.fehler.push({ zeile: i + 2, grund: msg });
      }
    }
    return NextResponse.json(ergebnisse);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Import fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

function numFromCol(row: Record<string, unknown>, ...keys: string[]): number | null {
  const v = pickCol(row, ...keys);
  if (!v) return null;
  const n = parseNumber(v);
  return n === 0 && v !== "0" ? null : n;
}

function parseDatum(s: string): Date | null {
  if (!s) return null;
  // DD.MM.YYYY
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const yr = y.length === 2 ? 2000 + parseInt(y, 10) : parseInt(y, 10);
    return new Date(yr, parseInt(mo, 10) - 1, parseInt(d, 10));
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
