import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { pickCol, parseNumber } from "@/lib/import-utils";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// POST /api/bodenproben/import — multipart CSV/Excel mit Spalten:
//   Schlag, Datum, ProbenNr, Labor, Tiefe, pH, P2O5, K2O, Mg, B, Humus, NMin, CN, Bodenart,
//   KlasseP, KlasseK, KlasseMg, KlasseBor (alternativ: "Versorgungsklasse P" etc.)
//
// Rückwärtskompatibilität: eine alte Sammelspalte "Klasse"/"Versorgungsklasse"
// wird auf KlasseP/K/Mg gespiegelt, sofern für den jeweiligen Nährstoff keine
// eigene Spalte existiert.
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
            schwefel: numFromCol(row, "Schwefel", "S", "SO3", "SO₃"),
            zink: numFromCol(row, "Zink", "Zn"),
            kupfer: numFromCol(row, "Kupfer", "Cu"),
            mangan: numFromCol(row, "Mangan", "Mn"),
            kak: numFromCol(row, "KAK", "Kationenaustauschkapazitaet"),
            kalkbedarf: numFromCol(row, "Kalkbedarf", "CaO", "Kalkung"),
            klasseP: klasseFromCol(row, ["KlasseP", "Klasse P", "Versorgungsklasse P", "PKlasse", "Klasse P2O5"], "Klasse", "Versorgungsklasse"),
            klasseK: klasseFromCol(row, ["KlasseK", "Klasse K", "Versorgungsklasse K", "KKlasse", "Klasse K2O"], "Klasse", "Versorgungsklasse"),
            klasseMg: klasseFromCol(row, ["KlasseMg", "Klasse Mg", "Versorgungsklasse Mg", "MgKlasse"], "Klasse", "Versorgungsklasse"),
            klasseBor: klasseFromCol(row, ["KlasseBor", "Klasse Bor", "Klasse B", "Versorgungsklasse Bor", "BorKlasse"]),
            klasseSchwefel: klasseFromCol(row, ["KlasseSchwefel", "Klasse S", "Versorgungsklasse S", "SKlasse"]),
            klasseZink: klasseFromCol(row, ["KlasseZink", "Klasse Zn", "Versorgungsklasse Zn", "ZnKlasse"]),
            klasseKupfer: klasseFromCol(row, ["KlasseKupfer", "Klasse Cu", "Versorgungsklasse Cu", "CuKlasse"]),
            klasseMangan: klasseFromCol(row, ["KlasseMangan", "Klasse Mn", "Versorgungsklasse Mn", "MnKlasse"]),
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

function klasseFromCol(row: Record<string, unknown>, primary: string[], ...fallback: string[]): string | null {
  const raw = pickCol(row, ...primary) || (fallback.length > 0 ? pickCol(row, ...fallback) : null);
  if (!raw) return null;
  const s = String(raw).trim().toUpperCase();
  return ["A", "B", "C", "D", "E"].includes(s) ? s : null;
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
