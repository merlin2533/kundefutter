import { prisma } from "@/lib/prisma";
import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface AiConfig {
  provider: "openai" | "anthropic";
  modell: string;
  openaiKey?: string;
  anthropicKey?: string;
}

export interface AiAnalyzeResult {
  raw: string;
  parsed: Record<string, unknown>;
  tokensIn: number;
  tokensOut: number;
}

// ─── Kosten pro 1M Tokens (in Cent) ─────────────────────────────────────────

const KOSTEN_MAP: Record<string, { input: number; output: number }> = {
  "gpt-4o":             { input: 250, output: 1000 },
  "gpt-4o-mini":        { input: 15,  output: 60 },
  "gpt-4.1":            { input: 200, output: 800 },
  "gpt-4.1-mini":       { input: 40,  output: 160 },
  "gpt-4.1-nano":       { input: 10,  output: 40 },
  "claude-sonnet-4-20250514":   { input: 300, output: 1500 },
  "claude-haiku-4-5-20251001": { input: 80,  output: 400 },
  "claude-opus-4-20250514":     { input: 1500, output: 7500 },
};

function berechneKosten(modell: string, tokensIn: number, tokensOut: number): number {
  const rate = KOSTEN_MAP[modell];
  if (!rate) return 0;
  return Math.round((tokensIn * rate.input + tokensOut * rate.output) / 1_000_000);
}

// ─── Config aus DB laden ─────────────────────────────────────────────────────

export async function getAiConfig(): Promise<AiConfig> {
  const rows = await prisma.einstellung.findMany({
    where: { key: { startsWith: "ki." } },
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  return {
    provider: (map["ki.provider"] as "openai" | "anthropic") || "openai",
    modell: map["ki.modell"] || "gpt-4o",
    openaiKey: map["ki.openai_key"],
    anthropicKey: map["ki.anthropic_key"],
  };
}

// ─── Bild analysieren ────────────────────────────────────────────────────────

export async function analyzeImage(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  config?: AiConfig
): Promise<AiAnalyzeResult> {
  const cfg = config || (await getAiConfig());

  if (cfg.provider === "anthropic") {
    return analyzeWithAnthropic(base64Image, systemPrompt, feature, cfg);
  }
  return analyzeWithOpenAI(base64Image, systemPrompt, feature, cfg);
}

// ─── OpenAI ──────────────────────────────────────────────────────────────────

async function analyzeWithOpenAI(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.openaiKey) throw new Error("OpenAI API-Key nicht konfiguriert");

  const client = new OpenAI({ apiKey: cfg.openaiKey });

  const mediaType = detectMediaType(base64Image);
  const imageUrl = base64Image.startsWith("data:")
    ? base64Image
    : `data:${mediaType};base64,${base64Image}`;

  const response = await client.chat.completions.create({
    model: cfg.modell,
    max_tokens: 4096,
    messages: [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: { url: imageUrl, detail: "high" },
          },
          {
            type: "text",
            text: "Analysiere dieses Bild und extrahiere die relevanten Informationen als JSON.",
          },
        ],
      },
    ],
  });

  const text = response.choices[0]?.message?.content || "{}";
  const tokensIn = response.usage?.prompt_tokens || 0;
  const tokensOut = response.usage?.completion_tokens || 0;

  const parsed = parseJsonFromText(text);

  await logUsage(cfg, feature, tokensIn, tokensOut, true);

  return { raw: text, parsed, tokensIn, tokensOut };
}

// ─── Anthropic ───────────────────────────────────────────────────────────────

async function analyzeWithAnthropic(
  base64Image: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.anthropicKey) throw new Error("Anthropic API-Key nicht konfiguriert");

  const client = new Anthropic({ apiKey: cfg.anthropicKey });

  const cleanBase64 = base64Image.startsWith("data:")
    ? base64Image.split(",")[1]
    : base64Image;

  const mediaType = detectMediaType(base64Image) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  const response = await client.messages.create({
    model: cfg.modell,
    max_tokens: 4096,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: { type: "base64", media_type: mediaType, data: cleanBase64 },
          },
          {
            type: "text",
            text: "Analysiere dieses Bild und extrahiere die relevanten Informationen als JSON.",
          },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  const text = textBlock && "text" in textBlock ? textBlock.text : "{}";
  const tokensIn = response.usage?.input_tokens || 0;
  const tokensOut = response.usage?.output_tokens || 0;

  const parsed = parseJsonFromText(text);

  await logUsage(cfg, feature, tokensIn, tokensOut, true);

  return { raw: text, parsed, tokensIn, tokensOut };
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function detectMediaType(base64: string): string {
  if (base64.startsWith("data:image/png")) return "image/png";
  if (base64.startsWith("data:image/webp")) return "image/webp";
  if (base64.startsWith("data:image/gif")) return "image/gif";
  return "image/jpeg";
}

function parseJsonFromText(text: string): Record<string, unknown> {
  // Versuche JSON direkt zu parsen
  try {
    return JSON.parse(text);
  } catch {
    // Suche nach JSON-Block in Markdown Code-Fences
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // fall through
      }
    }
    // Suche nach erstem { ... } Block
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]);
      } catch {
        // fall through
      }
    }
    return { rawText: text };
  }
}

async function logUsage(
  cfg: AiConfig,
  feature: string,
  tokensIn: number,
  tokensOut: number,
  erfolgreich: boolean,
  fehler?: string
) {
  try {
    await prisma.kiNutzung.create({
      data: {
        provider: cfg.provider,
        modell: cfg.modell,
        feature,
        tokensIn,
        tokensOut,
        kostenCent: berechneKosten(cfg.modell, tokensIn, tokensOut),
        erfolgreich,
        fehler,
      },
    });
  } catch {
    // Logging-Fehler nicht nach oben durchreichen
    console.error("KI-Nutzung konnte nicht gespeichert werden");
  }
}

export async function logError(feature: string, error: string) {
  const cfg = await getAiConfig();
  await logUsage(cfg, feature, 0, 0, false, error);
}

// ─── Verbindungstest ─────────────────────────────────────────────────────────

export async function testConnection(cfg: AiConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    if (cfg.provider === "openai") {
      if (!cfg.openaiKey) return { ok: false, error: "Kein API-Key" };
      const client = new OpenAI({ apiKey: cfg.openaiKey });
      await client.models.list();
      return { ok: true };
    } else {
      if (!cfg.anthropicKey) return { ok: false, error: "Kein API-Key" };
      const client = new Anthropic({ apiKey: cfg.anthropicKey });
      await client.messages.create({
        model: cfg.modell || "claude-haiku-4-5-20251001",
        max_tokens: 10,
        messages: [{ role: "user", content: "test" }],
      });
      return { ok: true };
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Unbekannter Fehler" };
  }
}

// ─── Feature-spezifische Prompts ─────────────────────────────────────────────

export const PROMPTS = {
  wareneingang: `Du bist ein Experte für die Analyse von Lieferscheinen in der Agrarbranche (Futter, Dünger, Saatgut).
Analysiere das Bild eines Lieferscheins und extrahiere alle relevanten Informationen.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "lieferant": "Name des Lieferanten (falls erkennbar)",
  "lieferscheinNr": "Nummer des Lieferscheins (falls erkennbar)",
  "datum": "Datum im Format YYYY-MM-DD (falls erkennbar)",
  "positionen": [
    {
      "name": "Artikelbezeichnung",
      "artikelnummer": "Artikelnummer falls vorhanden",
      "menge": 100,
      "einheit": "kg|t|Sack|Liter|Stück",
      "einzelpreis": 12.50
    }
  ]
}

Wenn ein Feld nicht erkennbar ist, setze null. Extrahiere ALLE Positionen.`,

  lieferung: `Du bist ein Experte für die Analyse von Bestellungen und Aufträgen in der Agrarbranche.
Analysiere das Bild und extrahiere Kunden- und Artikelinformationen.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "kunde": {
    "name": "Kundenname",
    "firma": "Firmenname falls vorhanden",
    "ort": "Ort falls erkennbar"
  },
  "datum": "YYYY-MM-DD",
  "positionen": [
    {
      "name": "Artikelbezeichnung",
      "artikelnummer": "Artikelnummer falls vorhanden",
      "menge": 100,
      "einheit": "kg|t|Sack|Liter|Stück",
      "einzelpreis": 12.50
    }
  ]
}

Wenn ein Feld nicht erkennbar ist, setze null.`,

  crm: `Du bist ein CRM-Assistent für ein Agrarunternehmen.
Analysiere das Bild und extrahiere Kundeninformationen und relevante Notizen.
Optimiere den Text für eine professionelle CRM-Aktivität.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "kunde": {
    "name": "Kundenname",
    "firma": "Firmenname falls vorhanden"
  },
  "betreff": "Kurzer Betreff der Aktivität",
  "inhalt": "Optimierter, professioneller Text der Notiz/Aktivität",
  "typ": "besuch|anruf|email|notiz"
}

Wenn ein Feld nicht erkennbar ist, setze null.`,
};
