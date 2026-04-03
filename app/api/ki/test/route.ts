import { NextRequest, NextResponse } from "next/server";
import { testConnection, type AiConfig } from "@/lib/ai";

export async function POST(req: NextRequest) {
  try {
    const cfg = (await req.json()) as AiConfig;
    const result = await testConnection(cfg);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ ok: false, error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
