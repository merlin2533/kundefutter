import { NextRequest, NextResponse } from "next/server";
import { testConnection, type AiConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, modell, openaiKey, anthropicKey, mistralKey } = body as Record<string, unknown>;

    // Input-Validierung
    if (!provider || (provider !== "openai" && provider !== "anthropic" && provider !== "mistral")) {
      return NextResponse.json({ ok: false, error: "Ungültiger Provider" }, { status: 400 });
    }

    const defaultModell =
      provider === "anthropic" ? "claude-haiku-4-5-20251001" :
      provider === "mistral"   ? "mistral-small-latest" :
                                 "gpt-4o";
    const cfg: AiConfig = {
      provider: provider as "openai" | "anthropic" | "mistral",
      modell: (typeof modell === "string" && modell) ? modell : defaultModell,
      openaiKey:    typeof openaiKey    === "string" ? openaiKey    : undefined,
      anthropicKey: typeof anthropicKey === "string" ? anthropicKey : undefined,
      mistralKey:   typeof mistralKey   === "string" ? mistralKey   : undefined,
    };

    const result = await testConnection(cfg);
    return NextResponse.json(result);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
