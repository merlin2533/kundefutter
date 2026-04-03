import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, analyzeText, getAiConfig, logError, PROMPTS } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const VALID_FEATURES = ["wareneingang", "lieferung", "crm"] as const;
type Feature = (typeof VALID_FEATURES)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, text, feature } = body as { image?: string; text?: string; feature: string };

    if (!image && !text) {
      return NextResponse.json({ error: "Kein Bild oder Text übermittelt" }, { status: 400 });
    }
    if (image && image.length > 10_000_000) {
      return NextResponse.json({ error: "Bild zu groß (max ~7.5MB)" }, { status: 413 });
    }
    if (!feature || !VALID_FEATURES.includes(feature as Feature)) {
      return NextResponse.json(
        { error: `Ungültiges Feature. Erlaubt: ${VALID_FEATURES.join(", ")}` },
        { status: 400 }
      );
    }

    const cfg = await getAiConfig();

    if (cfg.provider === "openai" && !cfg.openaiKey) {
      return NextResponse.json({ error: "OpenAI API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." }, { status: 400 });
    }
    if (cfg.provider === "anthropic" && !cfg.anthropicKey) {
      return NextResponse.json({ error: "Anthropic API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." }, { status: 400 });
    }

    // Lade ggf. benutzerdefinierten Prompt aus Einstellungen
    const customPrompt = await prisma.einstellung.findUnique({
      where: { key: `ki.prompt.${feature}` },
    });
    const prompt = (customPrompt?.value?.trim()) || PROMPTS[feature as Feature];

    // Text analysis (voice input) or image analysis
    const result = text
      ? await analyzeText(text, prompt, feature, cfg)
      : await analyzeImage(image!, prompt, feature, cfg);

    return NextResponse.json({
      provider: cfg.provider,
      modell: cfg.modell,
      ergebnis: result.parsed,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    try {
      await logError("analyze", message);
    } catch {
      // ignore logging errors
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
