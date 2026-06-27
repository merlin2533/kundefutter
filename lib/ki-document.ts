// Wiederverwendbares PDF/Bild → JSON-Helper für KI-Routen.
// Kapselt: Anthropic-Native-PDF-Pfad, OpenAI-PDF-Fehlermeldung, Bild-Pfad via analyzeImage(),
// strukturiertes Token/Kosten-Logging in KiNutzung.

import { getAiConfig, analyzeImage, KOSTEN_MAP, type AiConfig } from "@/lib/ai";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { Mistral } from "@mistralai/mistralai";

export interface KiDocResult {
  raw: string;
  tokensIn: number;
  tokensOut: number;
  cfg: AiConfig;
}

async function logKi(provider: string, modell: string, feature: string,
                     tokensIn: number, tokensOut: number, ok: boolean, fehler?: string) {
  const r = KOSTEN_MAP[modell];
  const kostenCent = r ? Math.round((tokensIn * r.input + tokensOut * r.output) / 1_000_000) : 0;
  try {
    await prisma.kiNutzung.create({
      data: { provider, modell, feature, tokensIn, tokensOut, kostenCent, erfolgreich: ok, fehler },
    });
  } catch { /* logging is non-fatal */ }
}

export async function analyzeDocumentFile(
  file: File,
  prompt: string,
  feature: string,
  opts: { maxTokens?: number; userText?: string } = {}
): Promise<KiDocResult> {
  const cfg = await getAiConfig("ocr");
  const isPdf = file.type === "application/pdf";
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  if (isPdf && cfg.provider === "anthropic") {
    if (!cfg.anthropicKey) throw new Error("Anthropic API-Key nicht konfiguriert");
    const client = new Anthropic({ apiKey: cfg.anthropicKey });
    try {
      const r = await client.messages.create({
        model: cfg.modell,
        max_tokens: opts.maxTokens ?? 8000,
        system: prompt,
        messages: [{
          role: "user",
          content: [
            { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } },
            { type: "text", text: opts.userText ?? "Extrahiere die Daten als JSON." },
          ] as Parameters<typeof client.messages.create>[0]["messages"][0]["content"],
        }],
      });
      const tb = r.content.find(b => b.type === "text");
      const raw = tb && "text" in tb ? tb.text : "{}";
      const tokensIn = r.usage?.input_tokens || 0;
      const tokensOut = r.usage?.output_tokens || 0;
      await logKi(cfg.provider, cfg.modell, feature, tokensIn, tokensOut, true);
      return { raw, tokensIn, tokensOut, cfg };
    } catch (err) {
      await logKi(cfg.provider, cfg.modell, feature, 0, 0, false,
        err instanceof Error ? err.message : "Anthropic Fehler");
      throw err;
    }
  }

  if (isPdf && cfg.provider === "mistral") {
    if (!cfg.mistralKey) throw new Error("Mistral API-Key nicht konfiguriert");
    try {
      // Schritt 1: OCR-Textextraktion
      const ocrRes = await fetch("https://api.mistral.ai/v1/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.mistralKey}` },
        body: JSON.stringify({
          model: "mistral-ocr-latest",
          document: { type: "base64", data: base64, mime_type: "application/pdf" },
        }),
      });
      if (!ocrRes.ok) {
        const errText = await ocrRes.text().catch(() => "OCR-Fehler");
        throw new Error(`Mistral OCR: ${errText}`);
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ocrData: any = await ocrRes.json();
      const documentText = (Array.isArray(ocrData.pages) ? ocrData.pages : [])
        .map((p: { markdown?: string }) => p.markdown || "")
        .join("\n\n")
        .trim();

      // Schritt 2: JSON-Extraktion via Sprachmodell
      const client = new Mistral({ apiKey: cfg.mistralKey });
      const chatResponse = await client.chat.complete({
        model: cfg.modell,
        maxTokens: opts.maxTokens ?? 8000,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: `${opts.userText ?? "Extrahiere die Daten als JSON."}\n\n${documentText}` },
        ],
      });
      const content = chatResponse.choices?.[0]?.message?.content;
      const raw = typeof content === "string" ? content : "{}";
      const tokensIn = chatResponse.usage?.promptTokens || 0;
      const tokensOut = chatResponse.usage?.completionTokens || 0;
      await logKi(cfg.provider, cfg.modell, feature, tokensIn, tokensOut, true);
      return { raw, tokensIn, tokensOut, cfg };
    } catch (err) {
      await logKi(cfg.provider, cfg.modell, feature, 0, 0, false,
        err instanceof Error ? err.message : "Mistral PDF Fehler");
      throw err;
    }
  }

  if (isPdf && cfg.provider === "openai") {
    throw new Error("PDF-Erkennung benötigt Anthropic oder Mistral als OCR-Provider. Bitte in Einstellungen → KI → Erkennung/OCR umstellen, oder ein Bild hochladen.");
  }

  // Bild-Pfad (alle Provider)
  const dataUrl = `data:${file.type};base64,${base64}`;
  const result = await analyzeImage(dataUrl, prompt, feature, cfg);
  return { raw: result.raw, tokensIn: result.tokensIn, tokensOut: result.tokensOut, cfg };
}

export function parseJsonFromText(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch { /* fall */ }
  const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (m) { try { return JSON.parse(m[1]); } catch { /* fall */ } }
  const b = text.match(/\{[\s\S]*\}/);
  if (b) { try { return JSON.parse(b[0]); } catch { /* fall */ } }
  return { rawText: text };
}

export function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}
export function numOrNull(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
