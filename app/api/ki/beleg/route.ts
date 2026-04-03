import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, getAiConfig, PROMPTS } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const KATEGORIEN = [
  "Wareneinkauf",
  "Betriebsbedarf",
  "Fahrtkosten",
  "Bürobedarf",
  "Telefon/Internet",
  "Versicherung",
  "Miete",
  "Sonstige",
];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image } = body as { image?: string };
    if (!image) {
      return NextResponse.json({ error: "Kein Bild übergeben" }, { status: 400 });
    }

    // Allow custom prompt override from settings
    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.beleg" } });
    const prompt = (promptRow?.value?.trim()) || PROMPTS.beleg;

    const cfg = await getAiConfig();
    const result = await analyzeImage(image, prompt, "beleg", cfg);

    const p = result.parsed as Record<string, unknown>;

    // Sanitize and validate the extracted fields
    const kategorie = KATEGORIEN.includes(String(p.kategorie ?? "")) ? String(p.kategorie) : "Sonstige";
    const mwstRaw = Number(p.mwstSatz ?? 19);
    const mwstSatz = [0, 7, 19].includes(mwstRaw) ? mwstRaw : 19;

    return NextResponse.json({
      datum: typeof p.datum === "string" && /^\d{4}-\d{2}-\d{2}$/.test(p.datum) ? p.datum : null,
      belegNr: typeof p.belegNr === "string" ? p.belegNr : null,
      beschreibung: typeof p.beschreibung === "string" ? p.beschreibung.substring(0, 80) : null,
      betragNetto: typeof p.betragNetto === "number" ? Math.round(p.betragNetto * 100) / 100 : null,
      mwstSatz,
      kategorie,
      lieferant: typeof p.lieferant === "string" ? p.lieferant : null,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  } catch (err) {
    console.error("KI Beleg-Analyse Fehler:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen" },
      { status: 500 }
    );
  }
}
