import { NextRequest, NextResponse } from "next/server";
import { getAiConfig, analyzeImage, PROMPTS } from "@/lib/ai";
import { getUploadBase } from "@/lib/upload";
import { prisma } from "@/lib/prisma";
import Anthropic from "@anthropic-ai/sdk";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";

// ─── Helper: Parse JSON from text ────────────────────────────────────────────

function parseJsonFromText(text: string): Record<string, unknown> {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      try { return JSON.parse(match[1]); } catch { /* fall through */ }
    }
    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) {
      try { return JSON.parse(braceMatch[0]); } catch { /* fall through */ }
    }
    return { rawText: text };
  }
}

// ─── Helper: Log KI usage manually (for direct Anthropic PDF calls) ──────────

async function logKiNutzung(
  provider: string, modell: string, feature: string,
  tokensIn: number, tokensOut: number, erfolgreich: boolean, fehler?: string
) {
  const KOSTEN_MAP: Record<string, { input: number; output: number }> = {
    "claude-sonnet-4-20250514": { input: 300, output: 1500 },
    "claude-haiku-4-5-20251001": { input: 80, output: 400 },
    "claude-opus-4-20250514": { input: 1500, output: 7500 },
  };
  const rate = KOSTEN_MAP[modell];
  const kostenCent = rate
    ? Math.round((tokensIn * rate.input + tokensOut * rate.output) / 1_000_000)
    : 0;

  try {
    await prisma.kiNutzung.create({
      data: { provider, modell, feature, tokensIn, tokensOut, kostenCent, erfolgreich, fehler },
    });
  } catch {
    // Logging errors are non-fatal
  }
}

// ─── Main POST handler ────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const isDev = process.env.NODE_ENV === "development";

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "Keine Datei übergeben" }, { status: 400 });
    }

    if (file.size > 30 * 1024 * 1024) {
      return NextResponse.json({ error: "Datei zu groß (max. 30 MB)" }, { status: 413 });
    }

    const isPdf = file.type === "application/pdf";
    if (!isPdf && !file.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Nur PDF oder Bilddateien erlaubt" },
        { status: 400 }
      );
    }

    // Load custom prompt or use default
    const promptRow = await prisma.einstellung.findUnique({
      where: { key: "ki.prompt.bodenprobe" },
    });
    const prompt = promptRow?.value?.trim() || PROMPTS.bodenprobe;

    const cfg = await getAiConfig();

    // ── Save file to disk (for belegPfad) ──────────────────────────────────
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").substring(0, 80);
    const filename = `${timestamp}-${safeName}`;
    const uploadDir = path.join(getUploadBase(), "bodenproben");

    await mkdir(uploadDir, { recursive: true });
    const bytes = await file.arrayBuffer();
    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, Buffer.from(bytes));

    const belegPfad = `bodenproben/${filename}`;
    const belegName = file.name;

    // ── Analyse via KI ──────────────────────────────────────────────────────
    let raw = "";
    let tokensIn = 0;
    let tokensOut = 0;

    if (isPdf && cfg.provider === "anthropic") {
      // Anthropic native PDF support — send PDF directly as document block
      if (!cfg.anthropicKey) {
        return NextResponse.json({ error: "Anthropic API-Key nicht konfiguriert" }, { status: 500 });
      }

      const base64Pdf = Buffer.from(bytes).toString("base64");
      const client = new Anthropic({ apiKey: cfg.anthropicKey });

      try {
        const response = await client.messages.create({
          model: cfg.modell,
          max_tokens: 4096,
          system: prompt,
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "document",
                  source: {
                    type: "base64",
                    media_type: "application/pdf",
                    data: base64Pdf,
                  },
                },
                {
                  type: "text",
                  text: "Analysiere diesen Bodenproben-Laborbericht und extrahiere alle Werte als JSON.",
                },
              ] as Parameters<typeof client.messages.create>[0]["messages"][0]["content"],
            },
          ],
        });

        const textBlock = response.content.find((b) => b.type === "text");
        raw = textBlock && "text" in textBlock ? textBlock.text : "{}";
        tokensIn = response.usage?.input_tokens || 0;
        tokensOut = response.usage?.output_tokens || 0;

        await logKiNutzung(cfg.provider, cfg.modell, "bodenprobe", tokensIn, tokensOut, true);
      } catch (err) {
        await logKiNutzung(
          cfg.provider, cfg.modell, "bodenprobe", 0, 0, false,
          err instanceof Error ? err.message : "Anthropic Fehler"
        );
        throw err;
      }
    } else if (isPdf && cfg.provider === "openai") {
      // OpenAI does not natively support PDF — return helpful error
      return NextResponse.json(
        { error: "PDF-Erkennung benötigt Anthropic als KI-Provider. Bitte in Einstellungen → KI auf Anthropic wechseln, oder ein Bild hochladen." },
        { status: 422 }
      );
    } else {
      // Image path — use existing analyzeImage
      const base64 = Buffer.from(bytes).toString("base64");
      const dataUrl = `data:${file.type};base64,${base64}`;
      const result = await analyzeImage(dataUrl, prompt, "bodenprobe", cfg);
      raw = result.raw;
      tokensIn = result.tokensIn;
      tokensOut = result.tokensOut;
    }

    // ── Parse and sanitize result ───────────────────────────────────────────
    const p = parseJsonFromText(raw);

    function strOrNull(v: unknown): string | null {
      return typeof v === "string" && v.trim() ? v.trim() : null;
    }
    function numOrNull(v: unknown): number | null {
      if (v == null || v === "") return null;
      const n = Number(v);
      return isNaN(n) ? null : n;
    }
    function klasseOrNull(v: unknown): string | null {
      const s = strOrNull(v);
      return s && ["A", "B", "C", "D", "E"].includes(s.toUpperCase()) ? s.toUpperCase() : null;
    }
    function datumOrNull(v: unknown): string | null {
      if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
      return null;
    }

    const data = {
      probenNr: strOrNull(p.probenNr),
      labor: strOrNull(p.labor),
      tiefe: strOrNull(p.tiefe),
      datum: datumOrNull(p.datum),
      pH: numOrNull(p.pH),
      phosphor: numOrNull(p.phosphor),
      kalium: numOrNull(p.kalium),
      magnesium: numOrNull(p.magnesium),
      bor: numOrNull(p.bor),
      schwefel: numOrNull(p.schwefel),
      zink: numOrNull(p.zink),
      kupfer: numOrNull(p.kupfer),
      mangan: numOrNull(p.mangan),
      kak: numOrNull(p.kak),
      kalkbedarf: numOrNull(p.kalkbedarf),
      humus: numOrNull(p.humus),
      nMin: numOrNull(p.nMin),
      cn: numOrNull(p.cn),
      bodenart: strOrNull(p.bodenart),
      klasse: klasseOrNull(p.klasse), // legacy fallback
      klasseP: klasseOrNull(p.klasseP),
      klasseK: klasseOrNull(p.klasseK),
      klasseMg: klasseOrNull(p.klasseMg),
      klasseBor: klasseOrNull(p.klasseBor),
      klasseSchwefel: klasseOrNull(p.klasseSchwefel),
      klasseZink: klasseOrNull(p.klasseZink),
      klasseKupfer: klasseOrNull(p.klasseKupfer),
      klasseMangan: klasseOrNull(p.klasseMangan),
      schlagName: strOrNull(p.schlagName),
      hinweis: strOrNull(p.hinweis),
    };

    const kostenCent = (() => {
      const KOSTEN_MAP: Record<string, { input: number; output: number }> = {
        "gpt-4o": { input: 250, output: 1000 },
        "gpt-4o-mini": { input: 15, output: 60 },
        "gpt-4.1": { input: 200, output: 800 },
        "gpt-4.1-mini": { input: 40, output: 160 },
        "claude-sonnet-4-20250514": { input: 300, output: 1500 },
        "claude-haiku-4-5-20251001": { input: 80, output: 400 },
        "claude-opus-4-20250514": { input: 1500, output: 7500 },
      };
      const rate = KOSTEN_MAP[cfg.modell];
      return rate ? Math.round((tokensIn * rate.input + tokensOut * rate.output) / 1_000_000) : 0;
    })();

    return NextResponse.json({
      data,
      belegPfad,
      belegName,
      tokens: tokensIn + tokensOut,
      kostenCent,
    });
  } catch (err) {
    const msg = isDev && err instanceof Error ? err.message : "KI-Analyse fehlgeschlagen";
    console.error("KI Bodenprobe-Analyse Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
