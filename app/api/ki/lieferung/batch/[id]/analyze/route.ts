import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { readFile } from "fs/promises";
import path from "path";
import { analyzeDocument, getAiConfig, logError, PROMPTS } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, ctx: Ctx) {
  const { id: idStr } = await ctx.params;
  const batchId = parseInt(idStr, 10);
  if (isNaN(batchId)) return NextResponse.json({ error: "Ungültige ID" }, { status: 400 });

  let body;
  try {
    body = await req.json();
  } catch (err) {
    Sentry.captureException(err);
    return NextResponse.json({ error: "Ungültiges JSON" }, { status: 400 });
  }
  const itemId = parseInt(body.itemId, 10);
  if (!itemId || isNaN(itemId)) {
    return NextResponse.json({ error: "itemId erforderlich" }, { status: 400 });
  }

  try {
    const item = await prisma.kiLieferungBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const cfg = await getAiConfig("ocr");
    if (!cfg.mistralKey) {
      return NextResponse.json(
        { error: "Mistral API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." },
        { status: 400 }
      );
    }

    const customPrompt = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.lieferung" } });
    const prompt = customPrompt?.value?.trim() || PROMPTS.lieferung;

    try {
      const buffer = await readFile(path.join(getUploadBase(), item.dateiPfad));
      const base64 = buffer.toString("base64");
      const result = await analyzeDocument(base64, prompt, "lieferung", cfg);

      const updated = await prisma.kiLieferungBatchItem.update({
        where: { id: itemId },
        data: {
          status: "analysiert",
          kiRohtext: result.raw,
          kiErgebnisJson: JSON.stringify(result.parsed),
          fehlerText: null,
          analysiertAm: new Date(),
        },
      });
      return NextResponse.json(updated);
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      try {
        await logError("lieferung", message);
      } catch (e) {
        Sentry.captureException(e);
      }
      const clientMessage = /API[-\s]?Key|api_key|401|403|authentication/i.test(message)
        ? "KI-Konfiguration ungültig"
        : "KI-Analyse fehlgeschlagen";
      const updated = await prisma.kiLieferungBatchItem.update({
        where: { id: itemId },
        data: { status: "fehler", fehlerText: clientMessage },
      });
      return NextResponse.json(updated);
    }
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiLieferungBatch analyze error:", e);
    return NextResponse.json({ error: "Analyse fehlgeschlagen" }, { status: 500 });
  }
}
