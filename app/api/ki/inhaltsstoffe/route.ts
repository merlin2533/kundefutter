import { NextRequest, NextResponse } from "next/server";
import { analyzeText, PROMPTS, getAiConfig } from "@/lib/ai";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  let body;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }

  const { name, kategorie } = body;
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "Produktname ist erforderlich" }, { status: 400 });
  }

  try {
    // Lade ggf. benutzerdefinierten Prompt aus Einstellungen
    const customPrompt = await prisma.einstellung.findUnique({
      where: { key: "ki.prompt.inhaltsstoffe" },
    });
    const systemPrompt = customPrompt?.value || PROMPTS.inhaltsstoffe;

    const userText = kategorie
      ? `Produkt: "${name.trim()}" (Kategorie: ${kategorie})`
      : `Produkt: "${name.trim()}"`;

    const result = await analyzeText(userText, systemPrompt, "inhaltsstoffe");

    const parsed = result.parsed as {
      inhaltsstoffe?: { name: string; menge?: number | null; einheit?: string | null }[];
      aehnlicheProdukte?: string[];
      hinweis?: string;
    };

    return NextResponse.json({
      inhaltsstoffe: parsed.inhaltsstoffe ?? [],
      aehnlicheProdukte: parsed.aehnlicheProdukte ?? [],
      hinweis: parsed.hinweis ?? null,
      tokensIn: result.tokensIn,
      tokensOut: result.tokensOut,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "KI-Fehler";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
