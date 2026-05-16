import { NextRequest, NextResponse } from "next/server";
import { getAiConfig, analyzeImage, PROMPTS } from "@/lib/ai";
import { getUploadBase } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

const TYPEN_WHITELIST = new Set([
  "PSM-Sachkunde",
  "Spritzgeraetekontrolle",
  "Duengerschulung",
  "Sprengstoff-Sachkunde",
  "Mais-Beize-Sachkunde",
  "Wildlebensmittel-Schulung",
  "Sonstige",
]);

function parseJsonFromText(text: string): Record<string, unknown> {
  try { return JSON.parse(text); } catch { /* fallthrough */ }
  const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (match) { try { return JSON.parse(match[1]); } catch { /* fallthrough */ } }
  const brace = text.match(/\{[\s\S]*\}/);
  if (brace) { try { return JSON.parse(brace[0]); } catch { /* fallthrough */ } }
  return { rawText: text };
}

async function logKi(provider: string, modell: string, tokensIn: number, tokensOut: number, ok: boolean, fehler?: string) {
  const RATES: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-20250514": { input: 300, output: 1500 },
    "claude-haiku-4-5-20251001": { input: 80, output: 400 },
    "claude-opus-4-20250514": { input: 1500, output: 7500 },
  };
  const r = RATES[modell];
  const kostenCent = r ? Math.round((tokensIn * r.input + tokensOut * r.output) / 1_000_000) : 0;
  try {
    await prisma.kiNutzung.create({
      data: { provider, modell, feature: "sachkundenachweis", tokensIn, tokensOut, kostenCent, erfolgreich: ok, fehler },
    });
  } catch { /* logging is non-fatal */ }
}

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";
  try {
    const fd = await req.formData();
    const file = fd.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    if (file.size > 30 * 1024 * 1024) return NextResponse.json({ error: "Datei zu groß (max. 30 MB)" }, { status: 413 });

    const isPdf = file.type === "application/pdf";
    if (!isPdf && !file.type.startsWith("image/")) {
      return NextResponse.json({ error: "Nur PDF oder Bilddateien erlaubt" }, { status: 400 });
    }

    const promptRow = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.sachkundenachweis" } });
    const prompt = promptRow?.value?.trim() || PROMPTS.sachkundenachweis;
    const cfg = await getAiConfig();

    // Datei speichern
    const ts = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
    const filename = `${ts}-${safeName}`;
    const uploadDir = path.join(getUploadBase(), "sachkunde");
    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    await writeFile(path.join(uploadDir, filename), Buffer.from(bytes));
    const belegPfad = `sachkunde/${filename}`;
    const belegName = file.name;

    let raw = "";
    let tokensIn = 0;
    let tokensOut = 0;

    if (isPdf && cfg.provider === "anthropic") {
      if (!cfg.anthropicKey) return NextResponse.json({ error: "Anthropic API-Key nicht konfiguriert" }, { status: 500 });
      const client = new Anthropic({ apiKey: cfg.anthropicKey });
      try {
        const r = await client.messages.create({
          model: cfg.modell,
          max_tokens: 1500,
          system: prompt,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(bytes).toString("base64") } },
              { type: "text", text: "Extrahiere die Sachkundenachweis-Daten als JSON." },
            ] as Parameters<typeof client.messages.create>[0]["messages"][0]["content"],
          }],
        });
        const tb = r.content.find(b => b.type === "text");
        raw = tb && "text" in tb ? tb.text : "{}";
        tokensIn = r.usage?.input_tokens || 0;
        tokensOut = r.usage?.output_tokens || 0;
        await logKi(cfg.provider, cfg.modell, tokensIn, tokensOut, true);
      } catch (err) {
        await logKi(cfg.provider, cfg.modell, 0, 0, false, err instanceof Error ? err.message : "Anthropic Fehler");
        throw err;
      }
    } else if (isPdf && cfg.provider === "openai") {
      return NextResponse.json({ error: "PDF-Erkennung benötigt Anthropic als Provider. Bitte in Einstellungen → KI wechseln oder ein Bild hochladen." }, { status: 422 });
    } else {
      const dataUrl = `data:${file.type};base64,${Buffer.from(bytes).toString("base64")}`;
      const result = await analyzeImage(dataUrl, prompt, "sachkundenachweis", cfg);
      raw = result.raw;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    }

    const p = parseJsonFromText(raw);
    function strOrNull(v: unknown): string | null {
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    function datumOrNull(v: unknown): string | null {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      return null;
    }
    const typRaw = strOrNull(p.typ);
    const data = {
      typ: typRaw && TYPEN_WHITELIST.has(typRaw) ? typRaw : "Sonstige",
      inhaberName: strOrNull(p.inhaberName),
      nummer: strOrNull(p.nummer),
      ausstellung: datumOrNull(p.ausstellung),
      gueltigBis: datumOrNull(p.gueltigBis),
      ausgestelltVon: strOrNull(p.ausgestelltVon),
      hinweis: strOrNull(p.hinweis),
    };

    return NextResponse.json({ data, belegPfad, belegName, tokens: tokensIn + tokensOut });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Sachkundenachweis-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
