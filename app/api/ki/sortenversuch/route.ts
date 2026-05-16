import { NextRequest, NextResponse } from "next/server";
import { PROMPTS } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { analyzeDocumentFile, parseJsonFromText, strOrNull, numOrNull } from "@/lib/ki-document";
import * as XLSX from "xlsx";

export const dynamic = "force-dynamic";

// POST /api/ki/sortenversuch — Multipart: file=PDF/Bild/XLSX/CSV
// → erkennt Sortenversuchs-Auswertung mit Versuch-Header und Positionen pro Sorte
export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "Datei zu groß (max. 30 MB)" }, { status: 413 });

    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.sortenversuch" } });
    const prompt = promptRow?.value?.trim() || PROMPTS.sortenversuch;

    const isXlsx = file.name.toLowerCase().match(/\.(xlsx|xls|csv|ods)$/);

    let raw: string;
    let tokensIn = 0;
    let tokensOut = 0;

    if (isXlsx) {
      // Excel/CSV vor dem KI-Call zu Text umwandeln (KI bekommt Tabelle als Plain-Text)
      const buffer = Buffer.from(await file.arrayBuffer());
      const wb = XLSX.read(buffer, { type: "buffer" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const csv = XLSX.utils.sheet_to_csv(ws);
      // Plain-Text via analyzeText
      const { analyzeText, getAiConfig } = await import("@/lib/ai");
      const cfg = await getAiConfig();
      const result = await analyzeText(
        `Dateiname: ${file.name}\nSheet: ${wb.SheetNames[0]}\n\n${csv}`,
        prompt, "sortenversuch", cfg
      );
      raw = result.raw;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    } else if (file.type === "application/pdf" || file.type.startsWith("image/")) {
      const r = await analyzeDocumentFile(file, prompt, "sortenversuch",
        { maxTokens: 12000, userText: "Extrahiere Versuch und alle Sortenpositionen als JSON." });
      raw = r.raw;
      tokensIn = r.tokensIn;
      tokensOut = r.tokensOut;
    } else {
      return NextResponse.json({ error: "Nur PDF, Bild oder Excel/CSV erlaubt" }, { status: 400 });
    }

    const p = parseJsonFromText(raw);
    const vRaw = (p.versuch && typeof p.versuch === "object") ? p.versuch as Record<string, unknown> : {};
    const posRaw = Array.isArray(p.positionen) ? p.positionen as Record<string, unknown>[] : [];

    const versuch = {
      name: strOrNull(vRaw.name) ?? "Unbenannter Versuch",
      jahr: numOrNull(vRaw.jahr) ?? new Date().getFullYear(),
      kultur: strOrNull(vRaw.kultur) ?? "",
      standort: strOrNull(vRaw.standort),
      flaeche: numOrNull(vRaw.flaeche),
      startDatum: strOrNull(vRaw.startDatum),
      endeDatum: strOrNull(vRaw.endeDatum),
    };

    const positionen = posRaw.map(s => ({
      sorte: strOrNull(s.sorte) ?? "—",
      saatstaerke: numOrNull(s.saatstaerke),
      ertragDtHa: numOrNull(s.ertragDtHa),
      feuchteProzent: numOrNull(s.feuchteProzent),
      proteinProzent: numOrNull(s.proteinProzent),
      hektolitergew: numOrNull(s.hektolitergew),
      bonitur: numOrNull(s.bonitur),
      reife: strOrNull(s.reife),
    })).filter(p => p.sorte && p.sorte !== "—");

    return NextResponse.json({
      versuch, positionen,
      hinweis: strOrNull(p.hinweis),
      tokens: tokensIn + tokensOut,
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Sortenversuch-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
