import { NextRequest, NextResponse } from "next/server";
import { testConnection, type AiConfig } from "@/lib/ai";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { modell, mistralKey } = body as Record<string, unknown>;

    const cfg: AiConfig = {
      modell: (typeof modell === "string" && modell) ? modell : "mistral-small-latest",
      mistralKey: typeof mistralKey === "string" ? mistralKey : undefined,
    };

    const result = await testConnection(cfg);
    return NextResponse.json(result);
  } catch (err) {
    const isDev = process.env.NODE_ENV === "development";
    const msg = isDev && err instanceof Error ? err.message : "Interner Fehler";
    return NextResponse.json({ ok: false, error: msg }, { status: 500 });
  }
}
