import { NextRequest, NextResponse } from "next/server";
import { getAiConfig, textToSpeech } from "@/lib/ai";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });

  try {
    const body = await req.json();
    const text = typeof body.text === "string" ? body.text.trim() : "";
    const voice: string | undefined = typeof body.voice === "string" && body.voice.trim() ? body.voice.trim() : undefined;

    if (!text) return NextResponse.json({ error: "Kein Text angegeben" }, { status: 400 });
    if (text.length > 4096) return NextResponse.json({ error: "Text zu lang (max. 4096 Zeichen)" }, { status: 400 });

    const cfg = await getAiConfig("tts");
    const audioBuffer = await textToSpeech(text, cfg, voice);

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": 'attachment; filename="sprachausgabe.mp3"',
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "TTS-Fehler";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
