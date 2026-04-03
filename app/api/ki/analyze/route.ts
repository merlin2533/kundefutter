import { NextRequest, NextResponse } from "next/server";
import { analyzeImage, getAiConfig, logError, PROMPTS } from "@/lib/ai";

export const dynamic = "force-dynamic";

const VALID_FEATURES = ["wareneingang", "lieferung", "crm"] as const;
type Feature = (typeof VALID_FEATURES)[number];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { image, feature } = body as { image: string; feature: string };

    if (!image || typeof image !== "string") {
      return NextResponse.json({ error: "Kein Bild übermittelt" }, { status: 400 });
    }
    if (image.length > 10_000_000) {
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

    const prompt = PROMPTS[feature as Feature];
    const result = await analyzeImage(image, prompt, feature, cfg);

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
