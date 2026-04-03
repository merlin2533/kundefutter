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
    take: 50,
  });
  const map: Record<string, string> = {};
  for (const r of rows) map[r.key] = r.value;

  const raw = map["ki.provider"];
  const provider = (raw === "openai" || raw === "anthropic") ? raw : "openai";

  return {
    provider,
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

  try {
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
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "OpenAI Fehler");
    throw err;
  }
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
    ? (base64Image.split(",")[1] ?? "")
    : base64Image;
  if (!cleanBase64) throw new Error("Ungültiges Bildformat");

  const mediaType = detectMediaType(base64Image) as "image/jpeg" | "image/png" | "image/gif" | "image/webp";

  try {
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
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Anthropic Fehler");
    throw err;
  }
}

// ─── Text analysieren (Spracheingabe) ────────────────────────────────────────

export async function analyzeText(
  text: string,
  systemPrompt: string,
  feature: string,
  config?: AiConfig
): Promise<AiAnalyzeResult> {
  const cfg = config || (await getAiConfig());

  if (cfg.provider === "anthropic") {
    return analyzeTextWithAnthropic(text, systemPrompt, feature, cfg);
  }
  return analyzeTextWithOpenAI(text, systemPrompt, feature, cfg);
}

async function analyzeTextWithOpenAI(
  text: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.openaiKey) throw new Error("OpenAI API-Key nicht konfiguriert");

  const client = new OpenAI({ apiKey: cfg.openaiKey });

  try {
    const response = await client.chat.completions.create({
      model: cfg.modell,
      max_tokens: 4096,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Analysiere den folgenden Text (von einer Spracheingabe) und extrahiere die relevanten Informationen als JSON:\n\n${text}`,
        },
      ],
    });

    const responseText = response.choices[0]?.message?.content || "{}";
    const tokensIn = response.usage?.prompt_tokens || 0;
    const tokensOut = response.usage?.completion_tokens || 0;

    const parsed = parseJsonFromText(responseText);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);

    return { raw: responseText, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "OpenAI Fehler");
    throw err;
  }
}

async function analyzeTextWithAnthropic(
  text: string,
  systemPrompt: string,
  feature: string,
  cfg: AiConfig
): Promise<AiAnalyzeResult> {
  if (!cfg.anthropicKey) throw new Error("Anthropic API-Key nicht konfiguriert");

  const client = new Anthropic({ apiKey: cfg.anthropicKey });

  try {
    const response = await client.messages.create({
      model: cfg.modell,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: `Analysiere den folgenden Text (von einer Spracheingabe) und extrahiere die relevanten Informationen als JSON:\n\n${text}`,
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const responseText = textBlock && "text" in textBlock ? textBlock.text : "{}";
    const tokensIn = response.usage?.input_tokens || 0;
    const tokensOut = response.usage?.output_tokens || 0;

    const parsed = parseJsonFromText(responseText);
    await logUsage(cfg, feature, tokensIn, tokensOut, true);

    return { raw: responseText, parsed, tokensIn, tokensOut };
  } catch (err) {
    await logUsage(cfg, feature, 0, 0, false, err instanceof Error ? err.message : "Anthropic Fehler");
    throw err;
  }
}

// ─── Hilfsfunktionen ─────────────────────────────────────────────────────────

function detectMediaType(base64: string): string {
  if (base64.startsWith("data:image/png")) return "image/png";
  if (base64.startsWith("data:image/webp")) return "image/webp";
  if (base64.startsWith("data:image/gif")) return "image/gif";
  if (base64.startsWith("data:")) return "image/jpeg";
  // Raw Base64: Magic Bytes prüfen
  if (base64.startsWith("iVBOR")) return "image/png";
  if (base64.startsWith("R0lGO")) return "image/gif";
  if (base64.startsWith("UklGR")) return "image/webp";
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
  try {
    const cfg = await getAiConfig();
    await logUsage(cfg, feature, 0, 0, false, error);
  } catch {
    console.error("logError fehlgeschlagen:", error);
  }
}

// ─── Verbindungstest ─────────────────────────────────────────────────────────

export async function testConnection(cfg: AiConfig): Promise<{ ok: boolean; error?: string }> {
  try {
    if (cfg.provider === "openai") {
      if (!cfg.openaiKey) return { ok: false, error: "Kein API-Key" };
      const client = new OpenAI({ apiKey: cfg.openaiKey });
      await client.models.retrieve(cfg.modell || "gpt-4o");
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
Analysiere den Input (Bild oder Text/Spracheingabe) und extrahiere Kundeninformationen und relevante Notizen.
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

  inhaltsstoffe: `Du bist ein Experte für Agrarprodukte (Futtermittel, Ergänzungsfutter, Mineralfutter, Düngemittel, Saatgut, Pflanzenhilfsmittel).
Recherchiere die Inhaltsstoffe / Zusammensetzung des genannten Produkts anhand seines Namens.

Antworte AUSSCHLIESSLICH mit gültigem JSON in diesem Format:
{
  "inhaltsstoffe": [
    { "name": "Rohprotein", "menge": 12.5, "einheit": "%" },
    { "name": "Schwefel", "menge": 90, "einheit": "%" }
  ],
  "hinweis": "Optionaler Hinweis falls das Produkt nicht eindeutig identifiziert werden konnte"
}

Regeln:
- Gib nur Inhaltsstoffe an, die du sicher kennst oder die sich aus dem Produktnamen eindeutig ableiten lassen. Erfinde KEINE Werte.
- "menge" kann null sein wenn der Wert unbekannt ist; "einheit" leer lassen wenn nicht anwendbar.
- Einheiten: typischerweise "%", "mg/kg", "g/kg", "MJ/kg", "g/l", "IE/kg"

Produkttypen und relevante Inhaltsstoffe:

PFERDEFUTTER / ERGÄNZUNGSFUTTER (z.B. marstall, Agrobs, Pavo):
  Grundfutter/Müsli: Rohprotein, Rohfett, Rohfaser, Rohasche, Stärke, Zucker, Calcium, Phosphor, Natrium, Magnesium, Energie (MJ DE/kg)
  Mineralfutter/Ergänzung: je nach Produkt die deklarierten Spurenelemente (Zn, Cu, Mn, Fe, I, Se, Co), Vitamine (A, D3, E, B1, B2, Biotin), Aminosäuren (Lysin, Methionin)
  Produkt-Hinweise marstall:
    - "Magnesium" → Hauptwirkstoff Magnesium (Mg), Angabe in % oder mg/kg
    - "Biotin & Zink" → Biotin (μg/kg), Zink (Zn, mg/kg)
    - "Elektrolyte" → Na, K, Cl, Mg
    - "Vitamin E & Selen" → Vitamin E (mg/kg oder IE/kg), Selen (Se, mg/kg)
    - "Force" / Mineralfutter → Rohprotein, Rohasche, Ca, P, Na, Mg + Spurenelemente
    - "FlexoFit" → Glucosamin, Chondroitin, MSM, Teufelskralle
    - "ProAir" → Menthol, ätherische Öle, Eukalyptus
    - "ProGastro" → Pektin, Leinsamen, Bentonit, MOS
    - "Huf-Regulator" → Biotin, Zink, Methionin, Kieselsäure
    - "Darm-Regulator" → Probiotika, Präbiotika (FOS/MOS), Bentonit
    - "Kollagen" → Kollagenhydrolysat, Aminosäurenprofil
    - "Leinöl" → Omega-3 (ALA), Omega-6, Rohfett
    - "Mash" → Weizenkleie, Leinsamen, Rohfaser, Rohprotein
    - "Granutop" → Flohsamenschalen, Leinsamen, Inulin (FOS)
    - "Amino-Muskel" → Rohprotein, Lysin, Methionin, BCAA
    - "MineralOrganic+" → organisch gebundene Spurenelemente (Zn, Cu, Mn, Se)
    - Wiesen-Cobs/Fasern/Chips → Rohfaser, Rohprotein, Stärke, Energie

DÜNGEMITTEL / SCHWEFELPRODUKTE (z.B. BvG, Compo, SKW):
  S-Produkte: Schwefel (S, %), Bentonit (%), ggf. Bor (B, %), Selen (Se, %), Stickstoff (N, %)
  Flüssigschwefel: S (%), Dichte (g/l)
  N-Dünger: N gesamt, davon NO3-N, NH4-N, Harnstoff-N; ggf. S, MgO, CaO
  P/K-Dünger: P2O5, K2O; ggf. S, Na, Cl
  Spurennährstoffe: B, Cu, Fe, Mn, Mo, Zn, Se – jeweils in %

PFLANZENHILFSMITTEL / EFFEKTIVE MIKROORGANISMEN:
  Wirkstoff und Konzentration, pH-Wert, ggf. Zuckergehalt

SAATGUT:
  Sortenname, Keimfähigkeit (%), TKG (g), Tausendkorngewicht

- WICHTIG: Wenn du das exakte Produkt nicht kennst, ordne es anhand des Namens einem ähnlichen/verwandten Produkt zu und gib dessen Werte als Näherung zurück.
- Wenn du ähnliche Produkte findest, fülle "aehnlicheProdukte" mit bis zu 3 Vorschlägen.
- Nur wenn du gar keine Zuordnung machen kannst, gib ein leeres Array und einen Hinweis zurück.

Erweitertes Antwortformat:
{
  "inhaltsstoffe": [...],
  "aehnlicheProdukte": ["Produktname 1 (Hersteller)", "Produktname 2"],
  "hinweis": "Optionaler Hinweis"
}`,
};
