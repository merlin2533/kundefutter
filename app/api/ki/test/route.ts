import { NextRequest, NextResponse } from "next/server";
import { testConnection, type AiConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { provider, modell, openaiKey, anthropicKey } = body as Record<string, unknown>;

    // Input-Validierung
    if (!provider || (provider !== "openai" && provider !== "anthropic")) {
      return NextResponse.json({ ok: false, error: "Ungültiger Provider" }, { status: 400 });
    }

    const cfg: AiConfig = {
      provider: provider as "openai" | "anthropic",
      modell: typeof modell === "string" ? modell : "gpt-4o",
      openaiKey: typeof openaiKey === "string" ? openaiKey : undefined,
      anthropicKey: typeof anthropicKey === "string" ? anthropicKey : undefined,
    };

    const result = await testConnection(cfg);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
