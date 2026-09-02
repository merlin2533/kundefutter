import { NextRequest, NextResponse } from "next/server";
import { getAiConfig, transcribeAudio } from "@/lib/ai";
import { Sentry } from "@/lib/sentry";

export const dynamic = "force-dynamic";

const VALID_FEATURES = ["crm", "sprachmemo", "lieferung", "bestellliste"] as const;
type Feature = (typeof VALID_FEATURES)[number];

export async function POST(req: NextRequest) {
  try {
    const fd = await req.formData();
    const audioFile = fd.get("audio") as File | null;
    const featureRaw = String(fd.get("feature") ?? "");
    const feature: Feature = VALID_FEATURES.includes(featureRaw as Feature)
      ? (featureRaw as Feature)
      : "sprachmemo";

    if (!audioFile) {
      return NextResponse.json({ error: "Keine Audiodatei übergeben" }, { status: 400 });
    }
    if (audioFile.size > 25 * 1024 * 1024) {
      return NextResponse.json({ error: "Audiodatei zu groß (max. 25 MB)" }, { status: 413 });
    }

    const cfg = await getAiConfig("transcription");
    if (!cfg.mistralKey) {
      return NextResponse.json(
        { error: "Mistral API-Key nicht konfiguriert. Bitte unter Einstellungen → KI hinterlegen." },
        { status: 400 }
      );
    }

    const bytes = await audioFile.arrayBuffer();
    const result = await transcribeAudio(
      { fileName: audioFile.name || "aufnahme.webm", content: bytes },
      feature,
      cfg
    );

    return NextResponse.json({ text: result.text, language: result.language });
  } catch (err) {
    Sentry.captureException(err);
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Transkription fehlgeschlagen";
    console.error("KI Transkription Fehler:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
