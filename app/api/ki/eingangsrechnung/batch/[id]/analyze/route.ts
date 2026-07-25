import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Sentry } from "@/lib/sentry";
import { getUploadBase } from "@/lib/upload";
import { readFile } from "fs/promises";
import path from "path";
import { analyzeDocument, getAiConfig, logError, PROMPTS } from "@/lib/ai";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

const GUELTIGE_MWST = [0, 7, 19];
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

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
    const item = await prisma.kiEingangsrechnungBatchItem.findFirst({ where: { id: itemId, batchId } });
    if (!item) return NextResponse.json({ error: "Nicht gefunden" }, { status: 404 });

    const cfg = await getAiConfig("ocr");
    if (!cfg.mistralKey) {
      return NextResponse.json(
        { error: "Mistral API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." },
        { status: 400 }
      );
    }

    const customPrompt = await prisma.einstellung.findUnique({ where: { key: "ki.prompt.beleg" } });
    const prompt = customPrompt?.value?.trim() || PROMPTS.beleg;

    try {
      const buffer = await readFile(path.join(getUploadBase(), item.dateiPfad));
      const base64 = buffer.toString("base64");
      const result = await analyzeDocument(base64, prompt, "beleg", cfg);
      const p = result.parsed as Record<string, unknown>;

      const mwstRaw = Number(p.mwstSatz);
      const mwstSatz = GUELTIGE_MWST.includes(mwstRaw) ? mwstRaw : 19;

      const updated = await prisma.kiEingangsrechnungBatchItem.update({
        where: { id: itemId },
        data: {
          status: "analysiert",
          kiRohtext: result.raw,
          kiErgebnisJson: JSON.stringify({
            datum: typeof p.datum === "string" && DATE_PATTERN.test(p.datum) ? p.datum : null,
            belegNr: typeof p.belegNr === "string" ? p.belegNr : null,
            faelligAm: typeof p.faelligAm === "string" && DATE_PATTERN.test(p.faelligAm) ? p.faelligAm : null,
            beschreibung: typeof p.beschreibung === "string" ? p.beschreibung.substring(0, 80) : null,
            betragNetto: typeof p.betragNetto === "number" ? Math.round(p.betragNetto * 100) / 100 : null,
            betragBrutto: typeof p.betragBrutto === "number" ? Math.round(p.betragBrutto * 100) / 100 : null,
            mwstSatz,
            lieferant: typeof p.lieferant === "string" ? p.lieferant : null,
            iban:
              typeof p.iban === "string" && /^[A-Z]{2}[0-9A-Z]{10,30}$/.test(p.iban.replace(/\s/g, "").toUpperCase())
                ? p.iban.replace(/\s/g, "").toUpperCase()
                : null,
            bic: typeof p.bic === "string" && p.bic.trim() ? p.bic.trim().toUpperCase() : null,
          }),
          fehlerText: null,
          analysiertAm: new Date(),
        },
      });
      return NextResponse.json(updated);
    } catch (err) {
      Sentry.captureException(err);
      const message = err instanceof Error ? err.message : "Unbekannter Fehler";
      try {
        await logError("beleg", message);
      } catch (e) {
        Sentry.captureException(e);
      }
      const clientMessage = /API[-\s]?Key|api_key|401|403|authentication/i.test(message)
        ? "KI-Konfiguration ungültig"
        : "KI-Analyse fehlgeschlagen";
      const updated = await prisma.kiEingangsrechnungBatchItem.update({
        where: { id: itemId },
        data: { status: "fehler", fehlerText: clientMessage },
      });
      return NextResponse.json(updated);
    }
  } catch (e) {
    Sentry.captureException(e);
    console.error("KiEingangsrechnungBatch analyze error:", e);
    return NextResponse.json({ error: "Analyse fehlgeschlagen" }, { status: 500 });
  }
}
