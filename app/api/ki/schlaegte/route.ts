import { NextRequest, NextResponse } from "next/server";
import { PROMPTS } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import { analyzeDocumentFile, parseJsonFromText, strOrNull, numOrNull } from "@/lib/ki-document";

export const dynamic = "force-dynamic";

// POST /api/ki/schlaegte — Multipart: file=PDF/Bild
//   → erkennt alle Schläge eines AFIG/HIT/iBALIS-Antrags
export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "Datei zu groß (max. 30 MB)" }, { status: 413 });
    if (file.type !== "application/pdf" && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur PDF oder Bilddateien erlaubt" }, { status: 400 });
    }

    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.schlaegte" } });
    const prompt = promptRow?.value?.trim() || PROMPTS.schlaegte;

    const result = await analyzeDocumentFile(file, prompt, "schlaegte",
      { maxTokens: 16000, userText: "Extrahiere alle Schläge des Antrags als JSON." });

    const p = parseJsonFromText(result.raw);
    const antragRaw = (p.antrag && typeof p.antrag === "object") ? p.antrag as Record<string, unknown> : {};
    const schlaegeRaw = Array.isArray(p.schlaege) ? p.schlaege as Record<string, unknown>[] : [];

    const antrag = {
      antragsteller: strOrNull(antragRaw.antragsteller),
      betriebsNr: strOrNull(antragRaw.betriebsNr),
      antragsJahr: numOrNull(antragRaw.antragsJahr),
    };

    const schlaege = schlaegeRaw.map(s => ({
      name: strOrNull(s.name) ?? "Unbenannt",
      flaeche: numOrNull(s.flaeche) ?? 0,
      fruchtart: strOrNull(s.fruchtart),
      sorte: strOrNull(s.sorte),
      vorfrucht: strOrNull(s.vorfrucht),
      aussaatJahr: numOrNull(s.aussaatJahr),
      feldstueckNr: strOrNull(s.feldstueckNr),
      gemarkung: strOrNull(s.gemarkung),
    })).filter(s => s.flaeche > 0); // 0-ha-Einträge ausfiltern (häufig Header/Zwischensummen)

    return NextResponse.json({
      antrag, schlaege,
      hinweis: strOrNull(p.hinweis),
      tokens: result.tokensIn + result.tokensOut,
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Schlaege-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
